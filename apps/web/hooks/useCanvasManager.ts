"use client";

import { RefObject, useCallback, useRef, useState } from "react";
import { detectShape, SlidingWindowDetector } from "@repo/pattern-detection";
import type { Point, LiveDetection } from "@repo/pattern-detection";
import type { ToolType } from "../components/DrawingToolSelector";

const PATTERN_CONFIDENCE_THRESHOLD = 0.75; // Increased from 0.55 to be stricter

export type ShapeType = ToolType | "completion";

interface Shape {
  shapeType: ShapeType;
  shapeData: Record<string, unknown>;
}

export function useCanvasManager({
  canvasRef,
  tool,
  shapes,
  onSendDrawEventAction,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  tool: ToolType;
  shapes: Shape[];
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
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
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
      // Live preview
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
        ctx.strokeRect(start.x, start.y, pos.x - start.x, pos.y - start.y);
      } else if (tool === "line") {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }
    }
  }, [tool]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isDrawing.current || !start) return;
    isDrawing.current = false;

    const end = getPos(e);

    if (tool === "line" || tool === "rectangle" || tool === "eraser") {
      const shapeData = {
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        stroke: "#000",
      };
      onSendDrawEventAction(tool, shapeData);
      renderCanvas(); // Clear live preview
    } else if (tool === "pencil") {
      const pathData = { path: [...pencilPath.current], stroke: "#000" };
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
  }, [tool, start, onSendDrawEventAction]);

  const drawShape = (ctx: CanvasRenderingContext2D, shape: Shape) => {
    const stroke = (shape.shapeData.stroke as string) || "#000";
    ctx.strokeStyle = stroke;

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
      
      const first = path[0];
      if (!first) return;
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < path.length; i++) {
        const p = path[i];
        if (p) ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    } else if (shape.shapeType === "eraser") {
      const { x1, y1, x2, y2 } = shape.shapeData as { x1: number; y1: number; x2: number; y2: number };
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.globalCompositeOperation = "source-over"; // Reset
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

  return {
    handleMouseDown,
    handleMouseUp,
    handleMouseMove,
    renderCanvas,
    /** Current live detection from the sliding window (null if none). */
    liveDetection,
  };
}
