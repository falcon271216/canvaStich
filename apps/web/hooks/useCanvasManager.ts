"use client";

import { RefObject, useCallback, useRef, useState } from "react";
import { detectShape, SlidingWindowDetector } from "@repo/pattern-detection";
import type { Point, LiveDetection } from "@repo/pattern-detection";
import type { ToolType } from "../components/DrawingToolSelector";
import { renderWireframeSymbol } from "../components/WireframeRenderers";

const PATTERN_CONFIDENCE_THRESHOLD = 0.75;
/** Minimum erase hit area so a click still removes the shape under the cursor */
const MIN_ERASE_SIZE = 12;

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

function rectsOverlap(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

function shapeIntersectsEraseRegion(
  shape: Shape,
  erase: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  if (shape.shapeType === "pencil") {
    const path = shape.shapeData.path as { x: number; y: number }[] | undefined;
    if (!path?.length) return false;
    // Point-in-rect, or segment crosses erase region
    for (let i = 0; i < path.length; i++) {
      const p = path[i]!;
      if (p.x >= erase.minX && p.x <= erase.maxX && p.y >= erase.minY && p.y <= erase.maxY) {
        return true;
      }
      if (i > 0) {
        const prev = path[i - 1]!;
        const segMinX = Math.min(prev.x, p.x);
        const segMaxX = Math.max(prev.x, p.x);
        const segMinY = Math.min(prev.y, p.y);
        const segMaxY = Math.max(prev.y, p.y);
        if (rectsOverlap(erase, { minX: segMinX, minY: segMinY, maxX: segMaxX, maxY: segMaxY })) {
          return true;
        }
      }
    }
    return false;
  }

  if (shape.shapeType === "line") {
    const { x1, y1, x2, y2 } = shape.shapeData as {
      x1: number; y1: number; x2: number; y2: number;
    };
    // Endpoint hit
    for (const [x, y] of [[x1, y1], [x2, y2]] as const) {
      if (x >= erase.minX && x <= erase.maxX && y >= erase.minY && y <= erase.maxY) return true;
    }
    // Bounding-box overlap for the segment
    return rectsOverlap(erase, {
      minX: Math.min(x1, x2),
      minY: Math.min(y1, y2),
      maxX: Math.max(x1, x2),
      maxY: Math.max(y1, y2),
    });
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

export function useCanvasManager({
  canvasRef,
  tool,
  shapes,
  color,
  strokeWidth,
  onSendDrawEventAction,
  onEraseShapes,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  tool: ToolType;
  shapes: Shape[];
  color: string;
  strokeWidth: number;
  onSendDrawEventAction: (type: ShapeType, data: Record<string, unknown>, shapeId?: string) => void;
  onEraseShapes: (shapeIds: string[]) => void;
}) {
  const startRef = useRef<Point | null>(null);
  const isDrawing = useRef(false);
  const pencilPath = useRef<Point[]>([]);
  const slidingDetector = useRef(new SlidingWindowDetector({ windowSize: 32, step: 6 }));
  const [liveDetection, setLiveDetection] = useState<LiveDetection | null>(null);
  const getPos = (e: React.MouseEvent): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const canvas = canvasRef.current;
    if (!rect || !canvas) {
      return { x: 0, y: 0, t: performance.now() };
    }
    // Map CSS pixels to canvas buffer coordinates (handles DPI / CSS scaling)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      t: performance.now(),
    };
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
    } else if (shape.shapeType === "rectangle") {
      const { x1, y1, x2, y2 } = shape.shapeData as { x1: number; y1: number; x2: number; y2: number };
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
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

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    shapes.forEach((shape) => drawShape(ctx, shape));

    if (liveDetection && liveDetection.smoothedConfidence >= 0.45) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = "#6366f1";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#6366f1";
      ctx.fillText(
        `${liveDetection.label} (${(liveDetection.smoothedConfidence * 100).toFixed(0)}%)`,
        10,
        canvas.height - 10,
      );
      ctx.restore();
    }
  }, [shapes, liveDetection, canvasRef]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (tool === "select") return;
    const pos = getPos(e);
    startRef.current = pos;
    isDrawing.current = true;

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

      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;

      const path = pencilPath.current;
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      if (path.length >= 2) {
        const prev = path[path.length - 2]!;
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }
    } else if (tool === "eraser" || tool === "rectangle" || tool === "line") {
      renderCanvas();
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx || !start) return;

      if (tool === "eraser") {
        ctx.save();
        ctx.fillStyle = "rgba(239, 68, 68, 0.15)";
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.fillRect(start.x, start.y, pos.x - start.x, pos.y - start.y);
        ctx.strokeRect(start.x, start.y, pos.x - start.x, pos.y - start.y);
        ctx.restore();
      } else if (tool === "rectangle") {
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeWidth;
        ctx.strokeRect(start.x, start.y, pos.x - start.x, pos.y - start.y);
      } else if (tool === "line") {
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeWidth;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }
    }
  }, [tool, color, strokeWidth, renderCanvas, canvasRef]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    const start = startRef.current;
    startRef.current = null;
    if (!start) return;

    const end = getPos(e);

    if (tool === "eraser") {
      let minX = Math.min(start.x, end.x);
      let minY = Math.min(start.y, end.y);
      let maxX = Math.max(start.x, end.x);
      let maxY = Math.max(start.y, end.y);

      // Click / tiny drag: expand to a usable hit target under the cursor
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
      const idsToRemove = shapes
        .filter((shape) => shapeIntersectsEraseRegion(shape, erase))
        .map((shape) => shape.id);

      if (idsToRemove.length > 0) {
        onEraseShapes(idsToRemove);
      }
      return;
    }

    if (tool === "line" || tool === "rectangle") {
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

    if (tool === "pencil") {
      const shapeId = createShapeId();
      const pathData = { path: [...pencilPath.current], stroke: color, lineWidth: strokeWidth };
      onSendDrawEventAction(tool, pathData, shapeId);

      if (pencilPath.current.length >= 8) {
        import("../lib/ml").then(({ predictPattern }) => {
          predictPattern(pencilPath.current).then((mlPredictions) => {
            const result = detectShape(pencilPath.current);
            if (
              result.confidence >= PATTERN_CONFIDENCE_THRESHOLD &&
              result.completion &&
              result.label !== "unknown"
            ) {
              onSendDrawEventAction("analysis", {
                completion: result.completion,
                detectedLabel: result.label,
                confidence: result.confidence,
                method: result.method,
                dtwDistance: result.dtwMatch?.normalizedDistance ?? null,
                velocityProfile: result.strokeFeatures?.velocityProfile ?? null,
                strokeDuration: result.strokeFeatures?.duration ?? null,
                meanSpeed: result.strokeFeatures?.meanSpeed ?? null,
                speedPeaks: result.strokeFeatures?.speedPeaks ?? null,
                mlPredictions: mlPredictions,
              });
            } else if (mlPredictions && mlPredictions.length > 0) {
              const topPred = mlPredictions[0];
              if (topPred && topPred.probability > 0.4) {
                onSendDrawEventAction("analysis", {
                  completion: { type: "path", path: [...pencilPath.current], stroke: "#a855f7" },
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
      }

      setLiveDetection(null);
      slidingDetector.current.reset();
    }
  }, [tool, color, strokeWidth, onSendDrawEventAction, onEraseShapes, shapes]);

  return {
    handleMouseDown,
    handleMouseUp,
    handleMouseMove,
    renderCanvas,
    liveDetection,
  };
}
