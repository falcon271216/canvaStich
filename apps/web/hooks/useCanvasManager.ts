"use client";

import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { detectShape, SlidingWindowDetector } from "@repo/pattern-detection";
import type { Point, LiveDetection } from "@repo/pattern-detection";
import type { ToolType } from "../components/DrawingToolSelector";
import { renderWireframeSymbol } from "../components/WireframeRenderers";
import type { ViewportState } from "./useBoardViewport";
import { applyCameraTransform, resetCameraTransform, screenToWorld } from "../lib/viewportCoords";

export type ShapeType = ToolType | "completion" | "analysis" | "emoji" | "clear_shape" | "wireframe";

export interface Shape {
  id: string;
  shapeType: ShapeType;
  shapeData: Record<string, unknown>;
}

export function createShapeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `shape-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const PATTERN_CONFIDENCE_THRESHOLD = 0.75;
/** Minimum erase hit area so a click still removes the shape under the cursor */
const MIN_ERASE_SIZE = 16;
/** Extra padding around erase box for easier hits */
const ERASE_PADDING = 6;

type EraseRect = { minX: number; minY: number; maxX: number; maxY: number };

function expandEraseRect(rect: EraseRect, padding = ERASE_PADDING): EraseRect {
  return {
    minX: rect.minX - padding,
    minY: rect.minY - padding,
    maxX: rect.maxX + padding,
    maxY: rect.maxY + padding,
  };
}

function pointInRect(x: number, y: number, r: EraseRect): boolean {
  return x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY;
}

function rectsOverlap(
  a: EraseRect,
  b: EraseRect,
): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

/** Liang–Barsky style segment vs axis-aligned rect */
function segmentIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: EraseRect,
): boolean {
  if (pointInRect(x1, y1, rect) || pointInRect(x2, y2, rect)) return true;

  const edges: [number, number, number, number][] = [
    [rect.minX, rect.minY, rect.maxX, rect.minY],
    [rect.maxX, rect.minY, rect.maxX, rect.maxY],
    [rect.maxX, rect.maxY, rect.minX, rect.maxY],
    [rect.minX, rect.maxY, rect.minX, rect.minY],
  ];

  for (const [ex1, ey1, ex2, ey2] of edges) {
    if (segmentsCross(x1, y1, x2, y2, ex1, ey1, ex2, ey2)) return true;
  }
  return false;
}

function segmentsCross(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number,
): boolean {
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(d) < 1e-10) return false;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function circleIntersectsRect(cx: number, cy: number, rx: number, ry: number, rect: EraseRect): boolean {
  const closestX = Math.max(rect.minX, Math.min(cx, rect.maxX));
  const closestY = Math.max(rect.minY, Math.min(cy, rect.maxY));
  const dx = (closestX - cx) / (rx || 1);
  const dy = (closestY - cy) / (ry || 1);
  return dx * dx + dy * dy <= 1;
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  lineWidth: number,
) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 4) return;
  const headLen = Math.min(18, Math.max(8, len * 0.25));
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLen * Math.cos(angle - Math.PI / 7),
    y2 - headLen * Math.sin(angle - Math.PI / 7),
  );
  ctx.lineTo(
    x2 - headLen * Math.cos(angle + Math.PI / 7),
    y2 - headLen * Math.sin(angle + Math.PI / 7),
  );
  ctx.closePath();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
}

function shapeIntersectsEraseRegion(
  shape: Shape,
  rawErase: EraseRect,
): boolean {
  const erase = expandEraseRect(rawErase);

  if (shape.shapeType === "pencil") {
    const path = shape.shapeData.path as { x: number; y: number }[] | undefined;
    const lw = (shape.shapeData.lineWidth as number) || 2;
    const pad = Math.max(ERASE_PADDING, lw);
    const padded = expandEraseRect(rawErase, pad);
    if (!path?.length) return false;
    for (let i = 0; i < path.length; i++) {
      const p = path[i]!;
      if (pointInRect(p.x, p.y, padded)) return true;
      if (i > 0) {
        const prev = path[i - 1]!;
        if (segmentIntersectsRect(prev.x, prev.y, p.x, p.y, padded)) return true;
      }
    }
    return false;
  }

  if (shape.shapeType === "line" || shape.shapeType === "arrow") {
    const { x1, y1, x2, y2 } = shape.shapeData as {
      x1: number; y1: number; x2: number; y2: number;
    };
    const lw = (shape.shapeData.lineWidth as number) || 2;
    const padded = expandEraseRect(rawErase, Math.max(ERASE_PADDING, lw * 2));
    return segmentIntersectsRect(x1, y1, x2, y2, padded);
  }

  if (shape.shapeType === "rectangle") {
    const { x1, y1, x2, y2 } = shape.shapeData as {
      x1: number; y1: number; x2: number; y2: number;
    };
    return rectsOverlap(erase, {
      minX: Math.min(x1, x2),
      minY: Math.min(y1, y2),
      maxX: Math.max(x1, x2),
      maxY: Math.max(y1, y2),
    });
  }

  if (shape.shapeType === "circle") {
    const { cx, cy, rx, ry } = shape.shapeData as {
      cx: number; cy: number; rx: number; ry: number;
    };
    return circleIntersectsRect(cx, cy, rx, ry, erase);
  }

  if (shape.shapeType === "wireframe" || shape.shapeType === "emoji") {
    const data = shape.shapeData as { x?: number; y?: number; w?: number; h?: number };
    if (data.x == null || data.y == null || data.w == null || data.h == null) return false;
    return rectsOverlap(erase, {
      minX: data.x,
      minY: data.y,
      maxX: data.x + data.w,
      maxY: data.y + data.h,
    });
  }

  if (shape.shapeType === "completion") {
    const comp = shape.shapeData.completion as Record<string, unknown> | undefined;
    if (!comp) return false;
    if (typeof comp.cx === "number" && typeof comp.r === "number" && typeof comp.cy === "number") {
      return rectsOverlap(erase, {
        minX: comp.cx - comp.r,
        minY: comp.cy - comp.r,
        maxX: comp.cx + comp.r,
        maxY: comp.cy + comp.r,
      });
    }
    if (typeof comp.x === "number" && typeof comp.w === "number" && typeof comp.y === "number" && typeof comp.h === "number") {
      return rectsOverlap(erase, {
        minX: comp.x,
        minY: comp.y,
        maxX: comp.x + comp.w,
        maxY: comp.y + comp.h,
      });
    }
    if (Array.isArray(comp.path)) {
      return (comp.path as { x: number; y: number }[]).some(
        (p) => p.x >= erase.minX && p.x <= erase.maxX && p.y >= erase.minY && p.y <= erase.maxY,
      );
    }
    if (typeof comp.x1 === "number" && typeof comp.y1 === "number" && typeof comp.x2 === "number" && typeof comp.y2 === "number") {
      return rectsOverlap(erase, {
        minX: Math.min(comp.x1, comp.x2, (comp.x3 as number) ?? comp.x1),
        minY: Math.min(comp.y1, comp.y2, (comp.y3 as number) ?? comp.y1),
        maxX: Math.max(comp.x1, comp.x2, (comp.x3 as number) ?? comp.x1),
        maxY: Math.max(comp.y1, comp.y2, (comp.y3 as number) ?? comp.y1),
      });
    }
  }

  return false;
}

/** UI component types that should be auto-completed as wireframe symbols. */
const AUTO_COMPLETE_UI_TYPES = new Set([
  'button',
  'input_field',
  'checkbox',
  'radio',
  'dropdown',
  'search_bar',
  'divider',
  'text_label',
  'image_placeholder',
  'avatar',
  'rating',
  'testimonial',
  'notification_bell',
]);

/** Minimum area (px²) for card auto-completion (skip if looks like a container). */
const CARD_MAX_AREA_FOR_COMPLETION = 15000;

export function useCanvasManager({
  canvasRef,
  viewportRef,
  viewport,
  tool,
  shapes,
  color,
  strokeWidth,
  onSendDrawEventAction,
  onEraseShapes,
  onShapeCompleted,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  viewportRef: RefObject<HTMLElement | null>;
  viewport: ViewportState;
  tool: ToolType;
  shapes: Shape[];
  color: string;
  strokeWidth: number;
  onSendDrawEventAction: (type: ShapeType, data: Record<string, unknown>, shapeId?: string) => void;
  onEraseShapes: (shapeIds: string[]) => void;
  /** Called when a freehand stroke is confidently classified as a UI component. */
  onShapeCompleted?: (pencilShapeId: string, uiType: string, bbox: { x: number; y: number; w: number; h: number }) => void;
}) {
  const startRef = useRef<Point | null>(null);
  const isDrawing = useRef(false);
  const pencilPath = useRef<Point[]>([]);
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const onEraseShapesRef = useRef(onEraseShapes);
  onEraseShapesRef.current = onEraseShapes;
  const erasedThisStrokeRef = useRef<Set<string>>(new Set());
  const viewportStateRef = useRef(viewport);
  viewportStateRef.current = viewport;
  const colorRef = useRef(color);
  colorRef.current = color;
  const strokeWidthRef = useRef(strokeWidth);
  strokeWidthRef.current = strokeWidth;
  const slidingDetector = useRef(new SlidingWindowDetector({ windowSize: 32, step: 6 }));
  const [liveDetection, setLiveDetection] = useState<LiveDetection | null>(null);
  const [eraserPreview, setEraserPreview] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  const performErase = useCallback((start: Point, end: Point) => {
    let minX = Math.min(start.x, end.x);
    let minY = Math.min(start.y, end.y);
    let maxX = Math.max(start.x, end.x);
    let maxY = Math.max(start.y, end.y);

    if (maxX - minX < MIN_ERASE_SIZE) {
      const cx = (minX + maxX) / 2;
      minX = cx - MIN_ERASE_SIZE / 2;
      maxX = cx + MIN_ERASE_SIZE / 2;
    }
    if (maxY - minY < MIN_ERASE_SIZE) {
      const cy = (minY + maxY) / 2;
      minY = cy - MIN_ERASE_SIZE / 2;
      maxY = cy + MIN_ERASE_SIZE / 2;
    }

    const erase = { minX, minY, maxX, maxY };
    const idsToRemove = shapesRef.current
      .filter((shape) => shapeIntersectsEraseRegion(shape, erase))
      .map((shape) => shape.id)
      .filter((id) => !erasedThisStrokeRef.current.has(id));

    if (idsToRemove.length > 0) {
      idsToRemove.forEach((id) => erasedThisStrokeRef.current.add(id));
      const idSet = new Set(idsToRemove);
      shapesRef.current = shapesRef.current.filter((s) => !idSet.has(s.id));
      onEraseShapesRef.current(idsToRemove);
    }
  }, []);

  const renderCanvasRef = useRef<() => void>(() => {});

  const finishEraserStroke = useCallback((start: Point, end: Point) => {
    performErase(start, end);
    setEraserPreview(null);
    renderCanvasRef.current();
  }, [performErase]);
  const getPos = (e: React.MouseEvent): Point => {
    const viewportEl = viewportRef.current;
    if (!viewportEl) {
      return { x: 0, y: 0, t: performance.now() };
    }
    const rect = viewportEl.getBoundingClientRect();
    const world = screenToWorld(e.clientX, e.clientY, rect, viewportStateRef.current);
    return { x: world.x, y: world.y, t: performance.now() };
  };

  const getPosFromClient = (clientX: number, clientY: number): Point => {
    const viewportEl = viewportRef.current;
    if (!viewportEl) {
      return { x: 0, y: 0, t: performance.now() };
    }
    const rect = viewportEl.getBoundingClientRect();
    const world = screenToWorld(clientX, clientY, rect, viewportStateRef.current);
    return { x: world.x, y: world.y, t: performance.now() };
  };

  const drawInProgressPencil = (ctx: CanvasRenderingContext2D) => {
    const path = pencilPath.current;
    if (path.length < 2) return;
    ctx.strokeStyle = colorRef.current;
    ctx.lineWidth = strokeWidthRef.current;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    const first = path[0]!;
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < path.length; i++) {
      const p = path[i];
      if (p) ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  };

  const drawShape = (ctx: CanvasRenderingContext2D, shape: Shape) => {
    const stroke = (shape.shapeData.stroke as string) || "#000";
    const lw = (shape.shapeData.lineWidth as number) || 1;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;

    if (shape.shapeType === "completion") {
      const comp = shape.shapeData.completion as {
        type: string;
        stroke?: string;
        cx?: number;
        cy?: number;
        r?: number;
        x?: number;
        y?: number;
        w?: number;
        h?: number;
        x1?: number;
        y1?: number;
        x2?: number;
        y2?: number;
        x3?: number;
        y3?: number;
        path?: { x: number; y: number }[];
      };
      if (!comp) return;
      ctx.strokeStyle = comp.stroke || stroke;
      if (comp.type === "circle" && comp.cx != null && comp.cy != null && comp.r != null) {
        ctx.beginPath();
        ctx.arc(comp.cx, comp.cy, comp.r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (comp.type === "rectangle" && comp.x != null && comp.y != null && comp.w != null && comp.h != null) {
        ctx.strokeRect(comp.x, comp.y, comp.w, comp.h);
      } else if (comp.type === "line" && comp.x1 != null && comp.y1 != null && comp.x2 != null && comp.y2 != null) {
        ctx.beginPath();
        ctx.moveTo(comp.x1, comp.y1);
        ctx.lineTo(comp.x2, comp.y2);
        ctx.stroke();
      } else if (comp.type === "triangle" && comp.x1 != null && comp.y1 != null && comp.x2 != null && comp.y2 != null && comp.x3 != null && comp.y3 != null) {
        ctx.beginPath();
        ctx.moveTo(comp.x1, comp.y1);
        ctx.lineTo(comp.x2, comp.y2);
        ctx.lineTo(comp.x3, comp.y3);
        ctx.closePath();
        ctx.stroke();
      } else if (comp.type === "path" && Array.isArray(comp.path) && comp.path.length >= 2) {
        const p0 = comp.path[0];
        if (!p0) return;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < comp.path.length; i++) {
          const p = comp.path[i];
          if (p) ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
      return;
    }

    if (shape.shapeType === "clear_shape" || shape.shapeType === "eraser" || shape.shapeType === "analysis") {
      return;
    }

    ctx.beginPath();
    if (shape.shapeType === "line") {
      const { x1, y1, x2, y2 } = shape.shapeData as { x1: number; y1: number; x2: number; y2: number };
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else if (shape.shapeType === "arrow") {
      const { x1, y1, x2, y2 } = shape.shapeData as { x1: number; y1: number; x2: number; y2: number };
      ctx.lineCap = "round";
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      drawArrowHead(ctx, x1, y1, x2, y2, lw);
    } else if (shape.shapeType === "rectangle") {
      const { x1, y1, x2, y2 } = shape.shapeData as { x1: number; y1: number; x2: number; y2: number };
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    } else if (shape.shapeType === "circle") {
      const { cx, cy, rx, ry } = shape.shapeData as { cx: number; cy: number; rx: number; ry: number };
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (shape.shapeType === "pencil") {
      const { path } = shape.shapeData as { path: { x: number; y: number }[] };
      if (!path || path.length < 2) return;

      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      const first = path[0];
      if (!first) return;
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < path.length; i++) {
        const p = path[i];
        if (p) ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    } else if (shape.shapeType === "emoji") {
      const { x, y, w, h, text } = shape.shapeData as { x: number; y: number; w: number; h: number; text: string };
      const size = Math.min(Math.max(w, h, 40), 250);
      ctx.font = `${size}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x + w / 2, y + h / 2);
    } else if (shape.shapeType === "wireframe") {
      const data = shape.shapeData as { wireframeType: string; x: number; y: number; w: number; h: number };
      if (data.wireframeType && data.x != null) {
        renderWireframeSymbol(ctx, data.wireframeType, {
          x: data.x,
          y: data.y,
          w: data.w,
          h: data.h,
        });
      }
    }
  };

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    resetCameraTransform(ctx);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    applyCameraTransform(ctx, viewportStateRef.current);

    shapesRef.current.forEach((shape) => drawShape(ctx, shape));

    if (isDrawing.current && toolRef.current === "pencil") {
      drawInProgressPencil(ctx);
    }

    if (liveDetection && liveDetection.smoothedConfidence >= 0.45) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = "#6366f1";
      ctx.lineWidth = 2 / viewportStateRef.current.zoom;
      ctx.setLineDash([6, 4]);
      ctx.font = `${12 / viewportStateRef.current.zoom}px sans-serif`;
      ctx.fillStyle = "#6366f1";
      const last = pencilPath.current[pencilPath.current.length - 1];
      const lx = last?.x ?? 0;
      const ly = last?.y ?? 24;
      ctx.fillText(
        `${liveDetection.label} (${(liveDetection.smoothedConfidence * 100).toFixed(0)}%)`,
        lx,
        ly - 12,
      );
      ctx.restore();
    }
  }, [liveDetection, canvasRef]);

  renderCanvasRef.current = renderCanvas;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (tool === "select") return;
    const pos = getPos(e);
    startRef.current = pos;
    isDrawing.current = true;

    if (tool === "eraser") {
      erasedThisStrokeRef.current.clear();
    }

    if (tool === "pencil") {
      pencilPath.current = [pos];
      slidingDetector.current.reset();
      slidingDetector.current.addPoint(pos);
      setLiveDetection(null);
    }
  }, [tool]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing.current) return;
    const pos = getPos(e);
    const start = startRef.current;

    if (tool === "pencil") {
      pencilPath.current.push(pos);

      slidingDetector.current.addPoint(pos);
      const live = slidingDetector.current.getLatestDetection();
      if (live && live.smoothedConfidence >= 0.45) {
        setLiveDetection(live);
      }

      renderCanvas();
    } else if (
      tool === "eraser" ||
      tool === "rectangle" ||
      tool === "line" ||
      tool === "arrow" ||
      tool === "circle"
    ) {
      if (tool === "eraser") {
        if (!start) return;
        renderCanvas();
        const x = Math.min(start.x, pos.x);
        const y = Math.min(start.y, pos.y);
        const w = Math.abs(pos.x - start.x);
        const h = Math.abs(pos.y - start.y);
        setEraserPreview({ x, y, w, h });
        performErase(start, pos);
        return;
      }

      renderCanvas();
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx || !start) return;
      applyCameraTransform(ctx, viewportStateRef.current);

      if (tool === "rectangle") {
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeWidth;
        ctx.strokeRect(start.x, start.y, pos.x - start.x, pos.y - start.y);
      } else if (tool === "circle") {
        const cx = (start.x + pos.x) / 2;
        const cy = (start.y + pos.y) / 2;
        const rx = Math.abs(pos.x - start.x) / 2;
        const ry = Math.abs(pos.y - start.y) / 2;
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeWidth;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (tool === "line") {
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeWidth;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else if (tool === "arrow") {
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        drawArrowHead(ctx, start.x, start.y, pos.x, pos.y, strokeWidth);
      }
    }
  }, [tool, color, strokeWidth, renderCanvas, canvasRef, performErase]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    const start = startRef.current;
    startRef.current = null;
    if (!start) return;

    const end = getPos(e);

    if (tool === "eraser") {
      finishEraserStroke(start, end);
      return;
    }

    if (tool === "line" || tool === "arrow" || tool === "rectangle") {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      if (Math.hypot(dx, dy) < 3) return;

      const shapeId = createShapeId();
      const shapeData = {
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        stroke: color,
        lineWidth: strokeWidth,
      };
      onSendDrawEventAction(tool, shapeData, shapeId);
      return;
    }

    if (tool === "circle") {
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      if (rx < 2 && ry < 2) return;

      const shapeId = createShapeId();
      const shapeData = {
        cx: (start.x + end.x) / 2,
        cy: (start.y + end.y) / 2,
        rx,
        ry,
        stroke: color,
        lineWidth: strokeWidth,
      };
      onSendDrawEventAction(tool, shapeData, shapeId);
      return;
    }

    if (tool === "pencil") {
      const shapeId = createShapeId();
      const capturedPath = [...pencilPath.current];
      const pathData = { path: capturedPath, stroke: color, lineWidth: strokeWidth };
      onSendDrawEventAction(tool, pathData, shapeId);

      if (capturedPath.length >= 8) {
        // ── UI component auto-completion (runs first, has priority) ──
        import("@repo/pattern-detection").then(({ classifyUIComponent, boundingBox }) => {
          const canvasEl = canvasRef.current;
          const canvasArea = canvasEl ? canvasEl.width * canvasEl.height : 1600 * 900;
          const result = classifyUIComponent([capturedPath], canvasArea);

          const shouldComplete =
            result.confidence >= 0.65 &&
            (
              AUTO_COMPLETE_UI_TYPES.has(result.type) ||
              (result.type === 'card' &&
                result.boundingBox.width * result.boundingBox.height < CARD_MAX_AREA_FOR_COMPLETION)
            );

          if (shouldComplete && onShapeCompleted) {
            onShapeCompleted(shapeId, result.type, {
              x: result.boundingBox.x,
              y: result.boundingBox.y,
              w: result.boundingBox.width,
              h: result.boundingBox.height,
            });
            // Skip geometric completion since UI wireframe will replace the stroke
            return;
          }

          // ── Fallback: geometric + ML completion (basic shapes) ──
          import("../lib/ml").then(({ predictPattern }) => {
            predictPattern(capturedPath).then((mlPredictions) => {
              const geoResult = detectShape(capturedPath);
              if (
                geoResult.confidence >= PATTERN_CONFIDENCE_THRESHOLD &&
                geoResult.completion &&
                geoResult.label !== "unknown"
              ) {
                onSendDrawEventAction("analysis", {
                  completion: geoResult.completion,
                  detectedLabel: geoResult.label,
                  confidence: geoResult.confidence,
                  method: geoResult.method,
                  dtwDistance: geoResult.dtwMatch?.normalizedDistance ?? null,
                  velocityProfile: geoResult.strokeFeatures?.velocityProfile ?? null,
                  strokeDuration: geoResult.strokeFeatures?.duration ?? null,
                  meanSpeed: geoResult.strokeFeatures?.meanSpeed ?? null,
                  speedPeaks: geoResult.strokeFeatures?.speedPeaks ?? null,
                  mlPredictions: mlPredictions,
                });
              } else if (mlPredictions && mlPredictions.length > 0) {
                const topPred = mlPredictions[0];
                if (topPred && topPred.probability > 0.4) {
                  onSendDrawEventAction("analysis", {
                    completion: { type: "path", path: capturedPath, stroke: "#a855f7" },
                    detectedLabel: topPred.className,
                    confidence: topPred.probability,
                    method: "cnn",
                    dtwDistance: null,
                    velocityProfile: null,
                    strokeDuration: null,
                    meanSpeed: null,
                    speedPeaks: null,
                    mlPredictions: mlPredictions,
                  });
                }
              }
            });
          });
        });
      }

      setLiveDetection(null);
      slidingDetector.current.reset();
    }
  }, [tool, color, strokeWidth, onSendDrawEventAction, finishEraserStroke]);

  /* ── Touch event handlers (mobile/tablet) ── */

  /**
   * Convert a TouchEvent into a synthetic position the same way getPos() does
   * for mouse events. Uses the first changed touch point.
   */
  const getTouchPos = (e: React.TouchEvent | TouchEvent): Point | null => {
    const touch = (e as TouchEvent).changedTouches?.[0] ?? (e as React.TouchEvent).changedTouches?.[0];
    if (!touch) return null;
    const viewportEl = viewportRef.current;
    if (!viewportEl) return { x: 0, y: 0, t: performance.now() };
    const rect = viewportEl.getBoundingClientRect();
    const world = screenToWorld(touch.clientX, touch.clientY, rect, viewportStateRef.current);
    return { x: world.x, y: world.y, t: performance.now() };
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only handle single-finger touches (two fingers = pinch/pan)
    if (e.touches.length !== 1) return;
    if (toolRef.current === "select") return;
    e.preventDefault();

    const pos = getTouchPos(e);
    if (!pos) return;
    startRef.current = pos;
    isDrawing.current = true;

    if (toolRef.current === "eraser") {
      erasedThisStrokeRef.current.clear();
    }
    if (toolRef.current === "pencil") {
      pencilPath.current = [pos];
      slidingDetector.current.reset();
      slidingDetector.current.addPoint(pos);
      setLiveDetection(null);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    if (!isDrawing.current) return;
    e.preventDefault();

    const pos = getTouchPos(e);
    if (!pos) return;
    const start = startRef.current;
    const tool = toolRef.current;

    if (tool === "pencil") {
      pencilPath.current.push(pos);
      slidingDetector.current.addPoint(pos);
      const live = slidingDetector.current.getLatestDetection();
      if (live && live.smoothedConfidence >= 0.45) {
        setLiveDetection(live);
      }
      renderCanvasRef.current();
    } else if (tool === "eraser") {
      if (!start) return;
      renderCanvasRef.current();
      const x = Math.min(start.x, pos.x);
      const y = Math.min(start.y, pos.y);
      const w = Math.abs(pos.x - start.x);
      const h = Math.abs(pos.y - start.y);
      setEraserPreview({ x, y, w, h });
      performErase(start, pos);
    } else if (tool === "rectangle" || tool === "circle" || tool === "line" || tool === "arrow") {
      renderCanvasRef.current();
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx || !start) return;
      applyCameraTransform(ctx, viewportStateRef.current);
      const strokeC = colorRef.current;
      const lw = strokeWidthRef.current;
      ctx.strokeStyle = strokeC;
      ctx.lineWidth = lw;
      if (tool === "rectangle") {
        ctx.strokeRect(start.x, start.y, pos.x - start.x, pos.y - start.y);
      } else if (tool === "circle") {
        const cx = (start.x + pos.x) / 2;
        const cy = (start.y + pos.y) / 2;
        const rx = Math.abs(pos.x - start.x) / 2;
        const ry = Math.abs(pos.y - start.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (tool === "line") {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else if (tool === "arrow") {
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        drawArrowHead(ctx, start.x, start.y, pos.x, pos.y, lw);
      }
    }
  }, [performErase, canvasRef]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();

    const pos = getTouchPos(e);
    const start = startRef.current;
    const tool = toolRef.current;

    isDrawing.current = false;
    startRef.current = null;

    if (tool === "eraser") {
      if (pos && start) finishEraserStroke(start, pos);
      return;
    }

    if ((tool === "line" || tool === "arrow" || tool === "rectangle") && start && pos) {
      const dx = pos.x - start.x;
      const dy = pos.y - start.y;
      if (Math.hypot(dx, dy) < 3) return;
      const shapeId = createShapeId();
      const shapeData = { x1: start.x, y1: start.y, x2: pos.x, y2: pos.y, stroke: colorRef.current, lineWidth: strokeWidthRef.current };
      onSendDrawEventAction(tool, shapeData, shapeId);
      return;
    }

    if (tool === "circle" && start && pos) {
      const rx = Math.abs(pos.x - start.x) / 2;
      const ry = Math.abs(pos.y - start.y) / 2;
      if (rx < 2 && ry < 2) return;
      const shapeId = createShapeId();
      const shapeData = { cx: (start.x + pos.x) / 2, cy: (start.y + pos.y) / 2, rx, ry, stroke: colorRef.current, lineWidth: strokeWidthRef.current };
      onSendDrawEventAction(tool, shapeData, shapeId);
      return;
    }

    if (tool === "pencil") {
      // Reuse the same pencil-finish logic by synthesising a fake MouseEvent
      // via a direct call — we can’t call handleMouseUp here (it reads from
      // getPos which needs a React.MouseEvent), so we inline the finish.
      const shapeId = createShapeId();
      const capturedPath = [...pencilPath.current];
      if (capturedPath.length < 2) { setLiveDetection(null); slidingDetector.current.reset(); return; }
      const pathData = { path: capturedPath, stroke: colorRef.current, lineWidth: strokeWidthRef.current };
      onSendDrawEventAction("pencil", pathData, shapeId);

      if (capturedPath.length >= 8) {
        import("@repo/pattern-detection").then(({ classifyUIComponent }) => {
          const canvasEl = canvasRef.current;
          const canvasArea = canvasEl ? canvasEl.width * canvasEl.height : 1600 * 900;
          const result = classifyUIComponent([capturedPath], canvasArea);
          const shouldComplete =
            result.confidence >= 0.65 &&
            (
              AUTO_COMPLETE_UI_TYPES.has(result.type) ||
              (result.type === 'card' && result.boundingBox.width * result.boundingBox.height < CARD_MAX_AREA_FOR_COMPLETION)
            );
          if (shouldComplete && onShapeCompleted) {
            onShapeCompleted(shapeId, result.type, {
              x: result.boundingBox.x, y: result.boundingBox.y,
              w: result.boundingBox.width, h: result.boundingBox.height,
            });
            return;
          }
          import("../lib/ml").then(({ predictPattern }) => {
            predictPattern(capturedPath).then((mlPredictions) => {
              const geoResult = detectShape(capturedPath);
              if (geoResult.confidence >= PATTERN_CONFIDENCE_THRESHOLD && geoResult.completion && geoResult.label !== "unknown") {
                onSendDrawEventAction("analysis", { completion: geoResult.completion, detectedLabel: geoResult.label, confidence: geoResult.confidence, method: geoResult.method, dtwDistance: geoResult.dtwMatch?.normalizedDistance ?? null, velocityProfile: geoResult.strokeFeatures?.velocityProfile ?? null, strokeDuration: geoResult.strokeFeatures?.duration ?? null, meanSpeed: geoResult.strokeFeatures?.meanSpeed ?? null, speedPeaks: geoResult.strokeFeatures?.speedPeaks ?? null, mlPredictions });
              } else if (mlPredictions?.length) {
                const topPred = mlPredictions[0];
                if (topPred && topPred.probability > 0.4) {
                  onSendDrawEventAction("analysis", { completion: { type: "path", path: capturedPath, stroke: "#a855f7" }, detectedLabel: topPred.className, confidence: topPred.probability, method: "cnn", dtwDistance: null, velocityProfile: null, strokeDuration: null, meanSpeed: null, speedPeaks: null, mlPredictions });
                }
              }
            });
          });
        });
      }
      setLiveDetection(null);
      slidingDetector.current.reset();
    }
  }, [onSendDrawEventAction, finishEraserStroke, canvasRef]);

  /* Finish eraser drag even when pointer leaves the canvas */
  useEffect(() => {
    const onWindowMouseUp = (e: MouseEvent) => {
      if (!isDrawing.current || toolRef.current !== "eraser") return;
      const start = startRef.current;
      if (!start) return;

      isDrawing.current = false;
      startRef.current = null;

      const end = getPosFromClient(e.clientX, e.clientY);
      performErase(start, end);
      setEraserPreview(null);
      renderCanvasRef.current();
    };

    window.addEventListener("mouseup", onWindowMouseUp);
    return () => window.removeEventListener("mouseup", onWindowMouseUp);
  }, [canvasRef, performErase, viewportRef]);

  useEffect(() => {
    if (tool !== "eraser") {
      setEraserPreview(null);
    }
  }, [tool]);

  return {
    handleMouseDown,
    handleMouseUp,
    handleMouseMove,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    renderCanvas,
    liveDetection,
    eraserPreview,
  };
}
