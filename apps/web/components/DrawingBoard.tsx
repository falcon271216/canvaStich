"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useDrawingSocket } from "../hooks/useDrawingSocket";
import { useCanvasManager, type ShapeType } from "../hooks/useCanvasManager";
import DrawingToolSelector, { ToolType } from "./DrawingToolSelector";
import { Cpu, Zap } from "lucide-react";
import AnalysisPanel from "./AnalysisPanel";
import type {
  UIDetectionResult,
  LayoutNode,
  UIComponentType,
  DetectedComponent,
} from "@repo/pattern-detection";
import {
  classifyUIComponent,
  clusterComponents,
  buildContainmentTree,
  updateNodeType,
} from "@repo/pattern-detection";
import { getComponentColor } from "./panels/DetectionPanel";

type Shape = { shapeType: ShapeType; shapeData: Record<string, unknown> };

export default function DrawingBoard({ roomId, token }: { roomId: string; token: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<ToolType>("pencil");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [canvasSize, setCanvasSize] = useState({ w: 900, h: 600 });

  /* ── SketchUI state ── */
  const [detections, setDetections] = useState<(UIDetectionResult & { id: string })[]>([]);
  const [layoutTree, setLayoutTree] = useState<LayoutNode | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);

  const { sendDrawEvent } = useDrawingSocket({
    token,
    roomId,
    onDrawEventAction: (event) => {
      if (event.shapeType === "clear_shape") {
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

  /* ── Run SketchUI pipeline whenever shapes change ── */
  const runDetectionPipeline = useCallback(() => {
    const pencilShapes = shapes.filter(s => s.shapeType === "pencil");
    if (pencilShapes.length === 0) {
      setDetections([]);
      setLayoutTree(null);
      return;
    }

    const canvasArea = canvasSize.w * canvasSize.h;

    // Step 1: Classify each pencil stroke independently
    const detected: DetectedComponent[] = pencilShapes.map((s, idx) => {
      const path = (s.shapeData as any).path as { x: number; y: number; t?: number }[];
      if (!path || path.length < 5) {
        return null;
      }
      const result = classifyUIComponent([path], canvasArea);
      return {
        id: `comp_${idx}`,
        type: result.type,
        confidence: result.confidence,
        boundingBox: result.boundingBox,
        strokes: [path],
      } as DetectedComponent;
    }).filter(Boolean) as DetectedComponent[];

    // Step 2: Cluster nearby components
    const groups = clusterComponents(detected, 50);

    // Step 3: Re-classify clustered groups (multi-stroke components)
    const mergedComponents: DetectedComponent[] = groups.map((group, gIdx) => {
      if (group.components.length === 1) {
        return group.components[0]!;
      }
      // Re-classify the merged strokes
      const allStrokes = group.components.flatMap(c => c.strokes);
      const result = classifyUIComponent(allStrokes, canvasArea);
      return {
        id: `merged_${gIdx}`,
        type: result.type,
        confidence: result.confidence,
        boundingBox: result.boundingBox,
        strokes: allStrokes,
      };
    });

    // Step 4: Build detection results for the panel
    const detResults: (UIDetectionResult & { id: string })[] = mergedComponents.map(c => ({
      id: c.id,
      type: c.type,
      confidence: c.confidence,
      boundingBox: c.boundingBox,
      method: 'ensemble' as const,
      allScores: [],
    }));
    setDetections(detResults);

    // Step 5: Build layout tree
    if (mergedComponents.length > 0) {
      const tree = buildContainmentTree(mergedComponents);
      setLayoutTree(tree);
    } else {
      setLayoutTree(null);
    }
  }, [shapes, canvasSize]);

  // Debounce pipeline runs
  useEffect(() => {
    const timer = setTimeout(runDetectionPipeline, 300);
    return () => clearTimeout(timer);
  }, [runDetectionPipeline]);

  const handleSelectComponent = useCallback((id: string) => {
    setSelectedComponentId(prev => prev === id ? null : id);
  }, []);

  const handleUpdateNodeType = useCallback((nodeId: string, newType: UIComponentType) => {
    if (layoutTree) {
      const updatedTree = JSON.parse(JSON.stringify(layoutTree)) as LayoutNode;
      updateNodeType(updatedTree, nodeId, newType);
      setLayoutTree(updatedTree);
    }
  }, [layoutTree]);

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

  /* ── Render canvas + detection overlays ── */
  useEffect(() => {
    renderCanvas();

    // Draw bounding box overlays for detected components
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    for (const det of detections) {
      const bbox = det.boundingBox;
      const color = getComponentColor(det.type);
      const isSelected = selectedComponentId === det.id;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.setLineDash(isSelected ? [] : [6, 4]);
      ctx.globalAlpha = isSelected ? 0.9 : 0.5;
      ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);

      // Label
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.fillStyle = color;
      ctx.globalAlpha = isSelected ? 1 : 0.7;
      const label = det.type.replace(/_/g, ' ');
      const textW = ctx.measureText(label).width;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      // Background for label
      ctx.fillRect(bbox.x - 1, bbox.y - 16, textW + 8, 16);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, bbox.x + 3, bbox.y - 4);
      ctx.restore();
    }
  }, [renderCanvas, shapes, detections, selectedComponentId]);

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
          <span>UI components detected via <strong>SketchUI</strong> pipeline</span>
        </div>

        {/* AutoDraw Magic button */}
        {shapes.filter(s => s.shapeType === "pencil").length > 0 && (
          <button
            onClick={async () => {
              const pencilShapes = shapes.filter(s => s.shapeType === "pencil");
              if (pencilShapes.length === 0) return;

              const { predictPattern, EMOJI_MAP } = await import("../lib/ml");

              const getBounds = (paths: any[]) => {
                const flat = paths.flat();
                const minX = Math.min(...flat.map((p: any) => p.x));
                const maxX = Math.max(...flat.map((p: any) => p.x));
                const minY = Math.min(...flat.map((p: any) => p.y));
                const maxY = Math.max(...flat.map((p: any) => p.y));
                return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
              };

              let clusters: typeof pencilShapes[] = [];
              pencilShapes.forEach(shape => {
                const path = (shape.shapeData as any).path;
                const bounds = getBounds([path]);

                const intersecting = clusters.filter(cluster => {
                  const cBounds = getBounds(cluster.map(s => (s.shapeData as any).path));
                  const padding = 30;
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

              for (const cluster of clusters) {
                const paths = cluster.map(s => (s.shapeData as any).path);
                const predictions = await predictPattern(paths);

                if (predictions && predictions.length > 0) {
                  const topClass = predictions[0]!.className;
                  const emoji = EMOJI_MAP[topClass] || "✨";
                  const bounds = getBounds(paths);

                  cluster.forEach(s => sendDrawEvent("clear_shape", s.shapeData));
                  setShapes(prev => prev.filter(s => !cluster.includes(s)));

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

      {/* SketchUI 3-Tab Panel */}
      <AnalysisPanel
        detections={detections}
        layoutTree={layoutTree}
        selectedComponentId={selectedComponentId}
        onSelectComponent={handleSelectComponent}
        onUpdateNodeType={handleUpdateNodeType}
      />
    </div>
  );
}
