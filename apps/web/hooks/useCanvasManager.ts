"use client";

import { RefObject, useCallback, useRef, useState } from "react";
import { detectShape, SlidingWindowDetector } from "@repo/pattern-detection";
import type { Point, LiveDetection } from "@repo/pattern-detection";
import type { ToolType } from "../components/DrawingToolSelector";
import { renderWireframeSymbol } from "../components/WireframeRenderers";

const PATTERN_CONFIDENCE_THRESHOLD = 0.75; // Increased from 0.55 to be stricter

export type ShapeType = ToolType | "completion" | "analysis" | "emoji" | "clear_shape" | "wireframe";

interface Shape {
  shapeType: ShapeType;
  shapeData: Record<string, unknown>;
}

export function useCanvasManager({
  canvasRef,
  tool,
  shapes,
  color,
  strokeWidth,
  onSendDrawEventAction,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  tool: ToolType;
  shapes: Shape[];
  color: string;
  strokeWidth: number;
  onSendDrawEventAction: (type: ShapeType, data: Record<string, unknown>) => void;
}) {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const isDrawing = useRef(false);
  const pencilPath = useRef<Point[]>([]);
  /** Sliding window detector for real-time pattern feedback. */
  const slidingDetector = useRef(new SlidingWindowDetector({ windowSize: 32, step: 6 }));
  /** Latest live detection to render ghost preview. */
  const [liveDetection, setLiveDetection] = useState<LiveDetection | null>(null);

  const getPos = (e: React.MouseEvent): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return {
      x: e.clientX - (rect?.left || 0),
      y: e.clientY - (rect?.top || 0),
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
      if (path.length < 2) return;
      
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
    } else if (shape.shapeType === "eraser") {
      // Eraser shapes are handled via shape removal in handleMouseUp.
      // Nothing to render — the erased shapes are already removed from the array.
      return;
    } else if (shape.shapeType === "emoji") {
      const { x, y, w, h, text } = shape.shapeData as { x: number; y: number; w: number; h: number; text: string };
      // Calculate a reasonable size: at least 40px, but capped at 250px so it doesn't overflow the screen
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

    // Draw ghost preview from sliding window detection
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
  }, [shapes, liveDetection]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const pos = getPos(e);
    setStart(pos);
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

    if (tool === "pencil") {
      pencilPath.current.push(pos);

      // Feed the sliding window detector
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
      // Live preview — use latest renderCanvas so remote shapes are not erased
      renderCanvas();
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx || !start) return;

      if (tool === "eraser") {
        ctx.save();
        ctx.fillStyle = "rgba(255, 0, 0, 0.15)";
        ctx.strokeStyle = "#ef4444";
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
  }, [tool, color, strokeWidth, renderCanvas, start]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isDrawing.current || !start) return;
    isDrawing.current = false;

    const end = getPos(e);

    if (tool === "eraser") {
      // Compute the eraser rectangle (normalize coordinates)
      const ex1 = Math.min(start.x, end.x);
      const ey1 = Math.min(start.y, end.y);
      const ex2 = Math.max(start.x, end.x);
      const ey2 = Math.max(start.y, end.y);

      // Find shapes that intersect the eraser region
      const toRemove: Shape[] = [];
      const toKeep: Shape[] = [];

      for (const shape of shapes) {
        let intersects = false;

        if (shape.shapeType === "pencil") {
          const path = (shape.shapeData as any).path as { x: number; y: number }[];
          if (path) {
            intersects = path.some(
              (p) => p.x >= ex1 && p.x <= ex2 && p.y >= ey1 && p.y <= ey2
            );
          }
        } else if (shape.shapeType === "line" || shape.shapeType === "rectangle") {
          const { x1: sx1, y1: sy1, x2: sx2, y2: sy2 } = shape.shapeData as any;
          // Check if the two rectangles overlap
          const sMinX = Math.min(sx1, sx2);
          const sMaxX = Math.max(sx1, sx2);
          const sMinY = Math.min(sy1, sy2);
          const sMaxY = Math.max(sy1, sy2);
          intersects = !(sMaxX < ex1 || sMinX > ex2 || sMaxY < ey1 || sMinY > ey2);
        } else if (shape.shapeType === "wireframe" || shape.shapeType === "emoji") {
          const data = shape.shapeData as any;
          if (data.x != null && data.w != null) {
            intersects = !(
              data.x + data.w < ex1 || data.x > ex2 ||
              data.y + data.h < ey1 || data.y > ey2
            );
          }
        } else if (shape.shapeType === "completion") {
          const comp = (shape.shapeData as any).completion;
          if (comp) {
            if (comp.cx != null && comp.r != null) {
              // Circle
              intersects = !(
                comp.cx + comp.r < ex1 || comp.cx - comp.r > ex2 ||
                comp.cy + comp.r < ey1 || comp.cy - comp.r > ey2
              );
            } else if (comp.x != null && comp.w != null) {
              intersects = !(
                comp.x + comp.w < ex1 || comp.x > ex2 ||
                comp.y + comp.h < ey1 || comp.y > ey2
              );
            } else if (comp.path) {
              intersects = comp.path.some(
                (p: any) => p.x >= ex1 && p.x <= ex2 && p.y >= ey1 && p.y <= ey2
              );
            }
          }
        }

        if (intersects) {
          toRemove.push(shape);
        } else {
          toKeep.push(shape);
        }
      }

      // Remove intersecting shapes and broadcast clear events
      if (toRemove.length > 0) {
        for (const shape of toRemove) {
          onSendDrawEventAction("clear_shape" as ShapeType, shape.shapeData);
        }
      }

      renderCanvas();
    } else if (tool === "line" || tool === "rectangle") {
      const shapeData = {
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        stroke: color,
        lineWidth: strokeWidth,
      };
      onSendDrawEventAction(tool, shapeData);
      renderCanvas(); // Clear live preview
    } else if (tool === "pencil") {
      const pathData = { path: [...pencilPath.current], stroke: color, lineWidth: strokeWidth };
      onSendDrawEventAction(tool, pathData);

      if (tool === "pencil" && pencilPath.current.length >= 8) {
        // Run both Tier 1 (DTW) and Tier 2 (ML) asynchronously
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
                mlPredictions: mlPredictions, // <-- Attaching TFJS Deep Learning Results
              });
            } else if (mlPredictions && mlPredictions.length > 0) {
              // If DTW failed to find a geometric shape, use the ML prediction
              const topPred = mlPredictions[0];
              if (topPred && topPred.probability > 0.4) {
                onSendDrawEventAction("analysis", {
                  completion: { type: "path", path: [...pencilPath.current], stroke: "#a855f7" }, // Highlight ML shapes
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

      // Clean up sliding window state
      if (tool === "pencil") {
        setLiveDetection(null);
        slidingDetector.current.reset();
      }
    }

    setStart(null);
  }, [tool, start, color, strokeWidth, onSendDrawEventAction, renderCanvas, shapes]);

  return {
    handleMouseDown,
    handleMouseUp,
    handleMouseMove,
    renderCanvas,
    /** Current live detection from the sliding window (null if none). */
    liveDetection,
  };
}
