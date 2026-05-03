"use client";

import { useEffect, useRef, useState } from "react";
import { useDrawingSocket } from "../hooks/useDrawingSocket";
import { useCanvasManager, type ShapeType } from "../hooks/useCanvasManager";
import DrawingToolSelector, { ToolType } from "./DrawingToolSelector";
import { Cpu, Zap } from "lucide-react";

import AnalysisPanel from "./AnalysisPanel";

type Shape = { shapeType: ShapeType; shapeData: Record<string, unknown> };

export default function DrawingBoard({ roomId, token }: { roomId: string; token: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<ToolType>("pencil");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [canvasSize, setCanvasSize] = useState({ w: 900, h: 600 });
  
  // Store the latest analysis data to show in the panel
  const [latestAnalysis, setLatestAnalysis] = useState<any | null>(null);

  const { sendDrawEvent } = useDrawingSocket({
    token,
    roomId,
    onDrawEventAction: (event) => {
      setShapes((prev) => [
        ...prev,
        { shapeType: event.shapeType as ShapeType, shapeData: event.shapeData as Record<string, unknown> },
      ]);
      
      // Extract analysis data if it's a completion event
      if (event.shapeType === "completion") {
        setLatestAnalysis({
          detectedLabel: event.shapeData.detectedLabel,
          confidence: event.shapeData.confidence,
          method: event.shapeData.method,
          dtwDistance: event.shapeData.dtwDistance,
          velocityProfile: event.shapeData.velocityProfile,
          strokeDuration: event.shapeData.strokeDuration,
          meanSpeed: event.shapeData.meanSpeed,
          speedPeaks: event.shapeData.speedPeaks,
        });
      }
    },
  });

  const apiBase = process.env.NEXT_PUBLIC_HTTP_API ?? "http://localhost:4000";
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

  // Resize canvas to fill container
  useEffect(() => {
    const resize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({ w: Math.floor(rect.width - 32), h: Math.floor(rect.height - 32) });
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

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
    <div style={{ display: "flex", width: "100%", height: "100%", overflow: "hidden" }}>
      <div className="draw-board" ref={containerRef}>
        <DrawingToolSelector currentTool={tool} setToolAction={setTool} />
        <canvas
          ref={canvasRef}
          width={canvasSize.w}
          height={canvasSize.h}
          className="draw-canvas"
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        />

        {/* Live detection indicator */}
        {liveDetection && liveDetection.smoothedConfidence >= 0.45 && (
          <div className="draw-live-detection">
            <span className="draw-live-dot" />
            <Cpu size={13} />
            Detecting:{" "}
            <strong style={{ marginLeft: 2 }}>{liveDetection.label}</strong>
            <span className="badge badge-accent" style={{ marginLeft: 4 }}>
              {(liveDetection.smoothedConfidence * 100).toFixed(0)}%
            </span>
          </div>
        )}

        <div className="draw-hint">
          <Zap size={12} />
          <span>Strokes analysed by <strong>DTW</strong> in real-time</span>
        </div>
      </div>
      
      {/* Real-time Analysis Panel */}
      <AnalysisPanel data={latestAnalysis} />
    </div>
  );
}
