"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useDrawingSocket } from "../hooks/useDrawingSocket";
import { useCanvasManager, type ShapeType } from "../hooks/useCanvasManager";
import DrawingToolSelector, { ToolType } from "./DrawingToolSelector";
import { Cpu, Zap } from "lucide-react";
import AnalysisPanel, { type AnalysisPanelHandle } from "./AnalysisPanel";
import ChatPanel, { type ChatMessage } from "./ChatPanel";
import LiveCursors, { type CursorData } from "./LiveCursors";
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
  upgradeWithCompositeSymbols,
} from "@repo/pattern-detection";
import { getComponentColor } from "./panels/DetectionPanel";

type Shape = { shapeType: ShapeType; shapeData: Record<string, unknown> };

export default function DrawingBoard({ roomId, token }: { roomId: string; token: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<ToolType>("pencil");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [canvasSize, setCanvasSize] = useState({ w: 900, h: 600 });

  /* ── Color & stroke state ── */
  const [color, setColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(2);

  /* ── Undo/Redo state ── */
  const undoStackRef = useRef<Shape[][]>([]);
  const redoStackRef = useRef<Shape[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const isUndoRedoAction = useRef(false);

  /* ── SketchUI state ── */
  const [detections, setDetections] = useState<(UIDetectionResult & { id: string })[]>([]);
  const [layoutTree, setLayoutTree] = useState<LayoutNode | null>(null);
  const [autoGenerate, setAutoGenerate] = useState(false);
  const analysisPanelRef = useRef<AnalysisPanelHandle>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);

  /* ── Chat state ── */
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);

  /* ── Live cursors state ── */
  const cursorsRef = useRef<Map<string, CursorData>>(new Map());
  const [cursorsVersion, setCursorsVersion] = useState(0);

  /* ── Identity state ── */
  const [myUserId, setMyUserId] = useState<string | null>(null);

  /* ── Room users state ── */
  const [roomUsers, setRoomUsers] = useState<{ userId: string; userName: string }[]>([]);

  const { sendDrawEvent, sendCursorMove, sendChatMessage } = useDrawingSocket({
    token,
    roomId,
    onDrawEventAction: (event) => {
      // Skip events that originated from this client — we already added
      // them to local state in onSendDrawEventAction. Only process
      // shapes from other users (remote collaboration events).
      if (event.fromUserId && event.fromUserId === myUserId) return;

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
    onCursorMoveAction: (data) => {
      cursorsRef.current.set(data.userId, { ...data, lastUpdate: Date.now() });
      setCursorsVersion((v) => v + 1);
    },
    onChatMessageAction: (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    },
    onUserJoinedAction: (user) => {
      setRoomUsers((prev) => {
        if (prev.find((u) => u.userId === user.userId)) return prev;
        return [...prev, user];
      });
    },
    onUserLeftAction: (data) => {
      setRoomUsers((prev) => prev.filter((u) => u.userId !== data.userId));
      cursorsRef.current.delete(data.userId);
      setCursorsVersion((v) => v + 1);
    },
    onRoomUsersAction: (users) => {
      setRoomUsers(users);
    },
    onIdentityAction: (data) => {
      setMyUserId(data.userId);
    },
  });

  /* ── Track shape changes for undo/redo ── */
  const prevShapesRef = useRef<Shape[]>([]);
  useEffect(() => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
    } else if (shapes !== prevShapesRef.current && prevShapesRef.current.length > 0) {
      undoStackRef.current.push(prevShapesRef.current);
      if (undoStackRef.current.length > 50) undoStackRef.current.shift();
      redoStackRef.current = [];
    }
    prevShapesRef.current = shapes;
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }, [shapes]);

  const handleUndo = useCallback(() => {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    isUndoRedoAction.current = true;
    redoStackRef.current.push(shapes);
    setShapes(prev);
  }, [shapes]);

  const handleRedo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    isUndoRedoAction.current = true;
    undoStackRef.current.push(shapes);
    setShapes(next);
  }, [shapes]);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo, handleRedo]);

  /* ── Load initial drawings ── */
  const apiBase = process.env.NEXT_PUBLIC_HTTP_API ?? "http://localhost:4000";
  useEffect(() => {
    fetch(`${apiBase}/drawings/${roomId}`)
      .then((res) => res.json())
      .then((data) => {
        const list = (data.drawings ?? []) as { type?: string; data?: unknown }[];
        const loaded = list.map((d) => ({
          shapeType: (d.type ?? "pencil") as ShapeType,
          shapeData: (d.data ?? {}) as Record<string, unknown>,
        }));
        prevShapesRef.current = loaded;
        setShapes(loaded);
      })
      .catch(() => {});
  }, [roomId, apiBase]);

  /* ── Load chat history ── */
  useEffect(() => {
    fetch(`${apiBase}/messages/${roomId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.messages) setChatMessages(data.messages);
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

  /* ── Export canvas as PNG ── */
  const handleExport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create a temp canvas with white background
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d")!;
    tempCtx.fillStyle = "#ffffff";
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(canvas, 0, 0);

    const link = document.createElement("a");
    link.download = `sketchui-room-${roomId}.png`;
    link.href = tempCanvas.toDataURL("image/png");
    link.click();
  }, [roomId]);

  /* ── Cursor tracking ── */
  const cursorThrottleRef = useRef(0);
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    const now = Date.now();
    if (now - cursorThrottleRef.current > 50) {
      cursorThrottleRef.current = now;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        sendCursorMove(e.clientX - rect.left, e.clientY - rect.top, color);
      }
    }
  }, [sendCursorMove, color]);

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

    // Step 4: Composite wireframe symbol analysis (v2)
    // Multi-stroke clusters get checked for known wireframe patterns
    // (rect+X = image, hamburger = nav, stacked rects = list, etc.)
    const upgradedComponents = upgradeWithCompositeSymbols(mergedComponents);

    // Step 5: Build detection results for the panel
    const detResults: (UIDetectionResult & { id: string })[] = upgradedComponents.map(c => ({
      id: c.id,
      type: c.type,
      confidence: c.confidence,
      boundingBox: c.boundingBox,
      method: 'ensemble' as const,
      allScores: [],
    }));
    setDetections(detResults);

    // Step 6: Build layout tree
    if (upgradedComponents.length > 0) {
      const tree = buildContainmentTree(upgradedComponents);
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
    color,
    strokeWidth,
    onSendDrawEventAction: (type, data) => {
      // Always add to local state immediately so detection pipeline works
      // even when WebSocket is not connected
      if (type === "clear_shape") {
        setShapes(prev => prev.filter(s =>
          JSON.stringify(s.shapeData) !== JSON.stringify(data)
        ));
      } else if (type !== "analysis") {
        setShapes(prev => [...prev, { shapeType: type as ShapeType, shapeData: data }]);
      }
      // Also broadcast via WebSocket for collaboration
      sendDrawEvent(type, data);
    },
  });

  /* ── Combined mouse move handler (canvas drawing + cursor broadcast) ── */
  const combinedMouseMove = useCallback((e: React.MouseEvent) => {
    handleMouseMove(e);
    handleCanvasMouseMove(e);
  }, [handleMouseMove, handleCanvasMouseMove]);

  /* ── Render canvas + detection overlays ── */
  useEffect(() => {
    renderCanvas();

    // Draw bounding box overlays for detected components
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    for (const det of detections) {
      const bbox = det.boundingBox;
      const bboxColor = getComponentColor(det.type);
      const isSelected = selectedComponentId === det.id;

      ctx.save();
      ctx.strokeStyle = bboxColor;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.setLineDash(isSelected ? [] : [6, 4]);
      ctx.globalAlpha = isSelected ? 0.9 : 0.5;
      ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);

      // Label
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.fillStyle = bboxColor;
      ctx.globalAlpha = isSelected ? 1 : 0.7;
      const label = det.type.replace(/_/g, ' ');
      const textW = ctx.measureText(label).width;
      ctx.fillStyle = bboxColor;
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
        <DrawingToolSelector
          currentTool={tool}
          setToolAction={setTool}
          color={color}
          onColorChange={setColor}
          strokeWidth={strokeWidth}
          onStrokeWidthChange={setStrokeWidth}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          onExport={handleExport}
        />

        <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <canvas
            ref={canvasRef}
            width={canvasSize.w}
            height={canvasSize.h}
            className="draw-canvas"
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseMove={combinedMouseMove}
          />

          {/* Live cursors overlay */}
          <LiveCursors cursors={cursorsRef.current} key={cursorsVersion} />
        </div>

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

        {/* AutoDraw Magic → Premium UI Generation */}
        {shapes.filter(s => s.shapeType === "pencil").length > 0 && (
          <button
            onClick={() => {
              // 1. Force re-run detection pipeline
              runDetectionPipeline();

              // 2. Show component count
              const count = detections.length;
              console.log(`✨ ${count} components detected → generating premium UI...`);

              // 3. Switch to Code tab
              analysisPanelRef.current?.switchToTab("code");

              // 4. Trigger auto-generation
              setAutoGenerate(true);
            }}
            className="autodraw-magic-btn"
          >
            ✨ AutoDraw Magic
          </button>
        )}

        {/* Chat panel */}
        <ChatPanel
          messages={chatMessages}
          onSendMessage={sendChatMessage}
          isOpen={chatOpen}
          onToggle={() => setChatOpen((o) => !o)}
          currentUserId={myUserId ?? undefined}
        />
      </div>

      {/* SketchUI 3-Tab Panel */}
      <AnalysisPanel
        ref={analysisPanelRef}
        detections={detections}
        layoutTree={layoutTree}
        selectedComponentId={selectedComponentId}
        onSelectComponent={handleSelectComponent}
        onUpdateNodeType={handleUpdateNodeType}
        canvasWidth={canvasSize.w}
        canvasHeight={canvasSize.h}
        autoGenerate={autoGenerate}
        onGenerationComplete={() => setAutoGenerate(false)}
      />
    </div>
  );
}
