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
      // Always store the latest analysis data
      if (event.shapeType === "completion" || event.shapeType === "analysis") {
        setLatestAnalysis({
          detectedLabel: event.shapeData.detectedLabel,
          confidence: event.shapeData.confidence,
          method: event.shapeData.method,
          dtwDistance: event.shapeData.dtwDistance,
          velocityProfile: event.shapeData.velocityProfile,
          strokeDuration: event.shapeData.strokeDuration,
          meanSpeed: event.shapeData.meanSpeed,
          speedPeaks: event.shapeData.speedPeaks,
          mlPredictions: event.shapeData.mlPredictions,
          originalShapeData: event.shapeData, // Save original data for manual beautification
        });
      }

      // Only draw shapes that are NOT pure analysis
      if (event.shapeType === "clear_shape") {
        // Clear specific shapes
        setShapes((prev) => prev.filter(s => 
          JSON.stringify(s.shapeData) !== JSON.stringify(event.shapeData)
        ));
      } else if (event.shapeType !== "analysis") {
        setShapes((prev) => [
          ...prev,
          { shapeType: event.shapeType as ShapeType, shapeData: event.shapeData as Record<string, unknown> },
        ]);
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

        {shapes.filter(s => s.shapeType === "pencil").length > 0 && (
          <button
            onClick={async () => {
              const pencilShapes = shapes.filter(s => s.shapeType === "pencil");
              if (pencilShapes.length === 0) return;
              
              const { predictPattern, EMOJI_MAP } = await import("../lib/ml");
              
              // Helper to get bounds
              const getBounds = (paths: any[]) => {
                const flat = paths.flat();
                const minX = Math.min(...flat.map(p => p.x));
                const maxX = Math.max(...flat.map(p => p.x));
                const minY = Math.min(...flat.map(p => p.y));
                const maxY = Math.max(...flat.map(p => p.y));
                return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
              };

              // Spatial Clustering: Group strokes that overlap or are very close
              let clusters: typeof pencilShapes[] = [];
              pencilShapes.forEach(shape => {
                const path = (shape.shapeData as any).path;
                const bounds = getBounds([path]);
                
                const intersecting = clusters.filter(cluster => {
                  const cBounds = getBounds(cluster.map(s => (s.shapeData as any).path));
                  const padding = 30; // 30px proximity threshold
                  return !(
                    bounds.minX > cBounds.maxX + padding ||
                    bounds.maxX < cBounds.minX - padding ||
                    bounds.minY > cBounds.maxY + padding ||
                    bounds.maxY < cBounds.minY - padding
                  );
                });
                
                const remaining = clusters.filter(c => !intersecting.includes(c));
                remaining.push([...intersecting.flat(), shape]);
                clusters = remaining;
              });

              // Process each cluster independently
              for (const cluster of clusters) {
                const paths = cluster.map(s => (s.shapeData as any).path);
                const predictions = await predictPattern(paths);
                
                if (predictions && predictions.length > 0) {
                  const topClass = predictions[0]!.className;
                  const emoji = EMOJI_MAP[topClass] || "✨";
                  const bounds = getBounds(paths);
                  
                  // Erase original pencil strokes for this cluster
                  cluster.forEach(s => sendDrawEvent("clear_shape", s.shapeData));
                  setShapes(prev => prev.filter(s => !cluster.includes(s)));
                  
                  // Add Emoji shape
                  const emojiShape = {
                    x: bounds.minX,
                    y: bounds.minY,
                    w: bounds.w,
                    h: bounds.h,
                    text: emoji,
                  };
                  
                  sendDrawEvent("emoji", emojiShape);
                  setShapes(prev => [...prev, { shapeType: "emoji" as ShapeType, shapeData: emojiShape }]);
                }
              }
            }}
            style={{
              position: "absolute",
              bottom: "20px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "linear-gradient(135deg, #a855f7, #6366f1)",
              color: "white",
              border: "none",
              padding: "0.75rem 1.5rem",
              borderRadius: "999px",
              fontWeight: "bold",
              cursor: "pointer",
              boxShadow: "0 4px 15px rgba(168, 85, 247, 0.4)",
              zIndex: 10,
              fontSize: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem"
            }}
          >
            ✨ AutoDraw Magic
          </button>
        )}
      </div>
      
      {/* Real-time Analysis Panel */}
      <AnalysisPanel 
        data={latestAnalysis} 
        onBeautify={
          latestAnalysis?.originalShapeData 
            ? () => sendDrawEvent("completion", latestAnalysis.originalShapeData) 
            : undefined
        } 
      />
    </div>
  );
}
