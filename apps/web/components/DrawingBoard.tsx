"use client";

import { useEffect, useRef, useState } from "react";
import { useDrawingSocket } from "../hooks/useDrawingSocket";
import { useCanvasManager, type ShapeType } from "../hooks/useCanvasManager";
import DrawingToolSelector, { ToolType } from "./DrawingToolSelector";

type Shape = { shapeType: ShapeType; shapeData: Record<string, unknown> };

export default function DrawingBoard({ roomId, token }: { roomId: string; token: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<ToolType>("pencil");
  const [shapes, setShapes] = useState<Shape[]>([]);

  const { sendDrawEvent } = useDrawingSocket({
    token,
    roomId,
    onDrawEventAction: (event) => {
      setShapes((prev) => [
        ...prev,
        { shapeType: event.shapeType as ShapeType, shapeData: event.shapeData as Record<string, unknown> },
      ]);
    },
  });

  const apiBase = process.env.NEXT_PUBLIC_HTTP_API ?? "http://localhost:3001";
  useEffect(() => {
    fetch(`${apiBase}/drawings/${roomId}`)
      .then((res) => res.json())
      .then((data) => {
        const list = (data.drawings ?? []) as { type?: string; data?: unknown }[];
        setShapes(
          list.map((d) => ({
            shapeType: (d.type ?? "pencil") as ShapeType,
            shapeData: (d.data ?? {}) as Record<string, unknown>,
          }))
        );
      })
      .catch(() => {});
  }, [roomId, apiBase]);

  const {
    handleMouseDown,
    handleMouseUp,
    handleMouseMove,
    renderCanvas,
    liveDetection,
  } = useCanvasManager({
    canvasRef,
    tool,
    shapes,
    onSendDrawEventAction: sendDrawEvent,
  });

  useEffect(renderCanvas, [renderCanvas, shapes]);

  return (
    <div className="draw-board">
      <DrawingToolSelector currentTool={tool} setToolAction={setTool} />
      <canvas
        ref={canvasRef}
        width={1000}
        height={700}
        className="draw-canvas"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      />
      {/* Live detection indicator — shows real-time sliding-window pattern match */}
      {liveDetection && liveDetection.smoothedConfidence >= 0.45 && (
        <div className="draw-live-detection">
          <span className="draw-live-dot" />
          Detecting:{" "}
          <strong>{liveDetection.label}</strong>{" "}
          ({(liveDetection.smoothedConfidence * 100).toFixed(0)}% confidence)
        </div>
      )}
      <p className="draw-hint">
        Draw with the pencil — strokes are analysed in real-time using{" "}
        <strong>DTW</strong> (Dynamic Time Warping) and auto-completed.
      </p>
    </div>
  );
}
