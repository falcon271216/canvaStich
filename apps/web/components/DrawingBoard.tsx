"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useDrawingSocket } from "../hooks/useDrawingSocket";
import {
  useCanvasManager,
  createShapeId,
  type Shape,
  type ShapeType,
} from "../hooks/useCanvasManager";
import DrawingToolSelector, { ToolType } from "./DrawingToolSelector";
import { Cpu, Zap, ArrowLeft, BarChart3, Radio, Users } from "lucide-react";
import AnalysisPanel, { type AnalysisPanelHandle } from "./AnalysisPanel";
import ChatPanel, { type ChatMessage } from "./ChatPanel";
import LiveCursors, { type CursorData } from "./LiveCursors";
import ComponentPalette, { type PaletteDropEvent } from "./ComponentPalette";
import AnnotationEditor, { type ComponentAnnotation } from "./AnnotationEditor";
import { TransformOverlay } from "./TransformOverlay";
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
import PanelResizeHandle from "./PanelResizeHandle";
import { useBoardViewport } from "../hooks/useBoardViewport";
import { applyCameraTransform, screenToWorld } from "../lib/viewportCoords";
import { detectionsAtPoint } from "../lib/detectionHitTest";
import {
  COMPOSITE_DISPLAY_NAMES,
  isWireframeGroupChild,
  scaleWireframeRect,
  type WireframeShapeData,
} from "../lib/wireframeGroups";
import { Minus, Plus, Maximize2 } from "lucide-react";

type BoardDetection = UIDetectionResult & {
  id: string;
  hidden?: boolean;
  compositeType?: string;
};

export default function DrawingBoard({ roomId, token }: { roomId: string; token: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<ToolType>("select");
  const [shapes, setShapes] = useState<Shape[]>([]);

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

  /* ── Palette state ── */
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [paletteWidth, setPaletteWidth] = useState(200);

  /* ── Analysis Panel state ── */
  const [analysisPanelCollapsed, setAnalysisPanelCollapsed] = useState(false);
  const [analysisPanelWidth, setAnalysisPanelWidth] = useState(320);

  const clampPaletteWidth = useCallback((w: number) => Math.min(420, Math.max(160, w)), []);
  const clampAnalysisWidth = useCallback((w: number) => Math.min(560, Math.max(240, w)), []);

  const handlePaletteResize = useCallback(
    (deltaX: number) => setPaletteWidth((w) => clampPaletteWidth(w + deltaX)),
    [clampPaletteWidth],
  );

  const handleAnalysisResize = useCallback(
    (deltaX: number) => setAnalysisPanelWidth((w) => clampAnalysisWidth(w + deltaX)),
    [clampAnalysisWidth],
  );

  /* ── Annotation state ── */
  const [annotations, setAnnotations] = useState<Map<string, ComponentAnnotation>>(new Map());
  const [editingAnnotation, setEditingAnnotation] = useState<{
    componentId: string;
    componentType: string;
    position: { x: number; y: number };
  } | null>(null);

  /* ── Live cursors state ── */
  const cursorsRef = useRef<Map<string, CursorData>>(new Map());
  const [cursorsVersion, setCursorsVersion] = useState(0);

  /* ── Identity state ── */
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myUserName, setMyUserName] = useState<string>("You");
  const myUserIdRef = useRef<string | null>(null);

  /* ── Room users state ── */
  const [roomUsers, setRoomUsers] = useState<{ userId: string; userName: string }[]>([]);

  const { sendDrawEvent, sendCursorMove, sendChatMessage } = useDrawingSocket({
    token,
    roomId,
    onDrawEventAction: (event) => {
      // All draw_event messages received here are from OTHER users —
      // the server (broadcastToRoom) already excludes the sender.
      if (event.shapeType === "clear_shape") {
        const data = event.shapeData as {
          shapeIds?: string[];
          shapeId?: string;
          shapes?: Record<string, unknown>[];
        };
        const ids = new Set(
          data.shapeIds ?? (data.shapeId ? [data.shapeId] : []),
        );
        const payloads = (data.shapes ?? []).map((s) => JSON.stringify(s));
        if (ids.size === 0 && payloads.length === 0) return;
        setShapes((prev) =>
          prev.filter((s) => {
            if (ids.has(s.id)) return false;
            if (payloads.includes(JSON.stringify(s.shapeData))) return false;
            return true;
          }),
        );
      } else if (event.shapeType !== "analysis") {
        const data = event.shapeData as Record<string, unknown>;
        const id =
          (typeof data.__id === "string" && data.__id) || createShapeId();
        const { __id: _omit, ...shapeData } = data;
        setShapes((prev) => {
          if (prev.some((s) => s.id === id)) return prev;
          return [
            ...prev,
            { id, shapeType: event.shapeType as ShapeType, shapeData },
          ];
        });
      }
    },
    onCursorMoveAction: (data) => {
      cursorsRef.current.set(data.userId, { ...data, lastUpdate: Date.now() });
      setCursorsVersion((v) => v + 1);
    },
    onChatMessageAction: (msg) => {
      setChatMessages((prev) => {
        const serverMsg: ChatMessage = {
          key: msg.id != null ? `msg-${msg.id}` : `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          id: msg.id,
          userId: msg.userId,
          userName: msg.userName,
          content: msg.content,
          createdAt: msg.createdAt,
        };

        // Already have this DB message
        if (serverMsg.id != null && prev.some((m) => m.id === serverMsg.id)) {
          return prev;
        }

        // Replace optimistic placeholder (no id, same content; match user when known)
        const pendingIdx = prev.findIndex((m) => {
          if (m.id != null || m.content !== serverMsg.content) return false;
          if (!m.userId || !serverMsg.userId) return true;
          return m.userId === serverMsg.userId;
        });
        if (pendingIdx !== -1) {
          const next = [...prev];
          next[pendingIdx] = { ...serverMsg, key: prev[pendingIdx]!.key };
          return next;
        }

        return [...prev, serverMsg];
      });
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
      myUserIdRef.current = data.userId;
      if (data.userName) setMyUserName(data.userName);
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

  /* ── Load initial drawings (replay clear_shape so erasures persist) ── */
  const apiBase = process.env.NEXT_PUBLIC_HTTP_API ?? "http://localhost:4000";
  useEffect(() => {
    fetch(`${apiBase}/drawings/${roomId}`)
      .then((res) => res.json())
      .then((data) => {
        const list = (data.drawings ?? []) as { type?: string; data?: unknown }[];
        const byId = new Map<string, Shape>();

        for (const d of list) {
          const type = (d.type ?? "pencil") as ShapeType;
          const raw = (d.data ?? {}) as Record<string, unknown>;

          if (type === "clear_shape") {
            const ids = (raw.shapeIds as string[] | undefined)
              ?? (typeof raw.shapeId === "string" ? [raw.shapeId] : []);
            for (const id of ids) byId.delete(id);

            const payloads = (raw.shapes as Record<string, unknown>[] | undefined) ?? [];
            for (const payload of payloads) {
              const legacy = JSON.stringify(payload);
              for (const [id, shape] of byId) {
                if (JSON.stringify(shape.shapeData) === legacy) byId.delete(id);
              }
            }

            // Oldest format: clear payload was the full shapeData object
            if (ids.length === 0 && payloads.length === 0) {
              const legacy = JSON.stringify(raw);
              for (const [id, shape] of byId) {
                if (JSON.stringify(shape.shapeData) === legacy) byId.delete(id);
              }
            }
            continue;
          }

          if (type === "analysis" || type === "eraser") continue;

          const id =
            (typeof raw.__id === "string" && raw.__id) || createShapeId();
          const { __id: _omit, ...shapeData } = raw;
          byId.set(id, { id, shapeType: type, shapeData });
        }

        const loaded = Array.from(byId.values());
        prevShapesRef.current = loaded;
        setShapes(loaded);
      })
      .catch(() => {});
  }, [roomId, apiBase]);

  /* ── Load chat history (merge so live messages are not wiped) ── */
  useEffect(() => {
    fetch(`${apiBase}/messages/${roomId}`)
      .then((res) => res.json())
      .then((data) => {
        const history = (data.messages ?? []) as Array<{
          id?: number;
          userId: string;
          userName: string;
          content: string;
          createdAt: string;
        }>;
        if (history.length === 0) return;

        setChatMessages((prev) => {
          const byId = new Map<number, ChatMessage>();
          const pending: ChatMessage[] = [];

          for (const m of prev) {
            if (m.id != null) byId.set(m.id, m);
            else pending.push(m);
          }
          for (const m of history) {
            if (m.id == null) continue;
            if (!byId.has(m.id)) {
              byId.set(m.id, {
                key: `msg-${m.id}`,
                id: m.id,
                userId: m.userId,
                userName: m.userName,
                content: m.content,
                createdAt: m.createdAt,
              });
            }
          }

          const merged = Array.from(byId.values()).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );

          // Keep optimistic messages that history has not confirmed yet
          for (const p of pending) {
            const confirmed = merged.some(
              (m) =>
                m.content === p.content &&
                (!p.userId || !m.userId || m.userId === p.userId),
            );
            if (!confirmed) merged.push(p);
          }

          return merged;
        });
      })
      .catch(() => {});
  }, [roomId, apiBase]);

  // Resize canvas to fill the viewport area
  const {
    viewport,
    viewportSize,
    sceneStyle,
    gridStyle,
    isSpaceDown,
    isPanning,
    shouldPan,
    handleViewportPointerDown,
    handleViewportPointerMove,
    handleViewportPointerUp,
    resetView,
    zoomIn,
    zoomOut,
  } = useBoardViewport(viewportRef);

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
      const viewportEl = viewportRef.current;
      if (viewportEl) {
        const rect = viewportEl.getBoundingClientRect();
        const world = screenToWorld(e.clientX, e.clientY, rect, viewport);
        sendCursorMove(world.x, world.y, color);
      }
    }
  }, [sendCursorMove, color, viewport]);

  /* ── Run SketchUI pipeline whenever shapes change ── */
  const runDetectionPipeline = useCallback(() => {
    const pencilShapes = shapes.filter(s => s.shapeType === "pencil");
    const wireframeShapes = shapes.filter(s => s.shapeType === "wireframe");

    if (pencilShapes.length === 0 && wireframeShapes.length === 0) {
      setDetections([]);
      setLayoutTree(null);
      return;
    }

    const canvasArea = 1600 * 900;

    // Step 1a: Classify each pencil stroke independently
    const detectedFromPencil: DetectedComponent[] = pencilShapes.map((s, idx) => {
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
        source: 'freehand',
      } as DetectedComponent;
    }).filter(Boolean) as DetectedComponent[];

    // Step 1b: Add wireframe (palette-dropped) shapes as pre-classified components
    const detectedFromWireframe: (DetectedComponent & { hidden?: boolean; compositeType?: string })[] =
      wireframeShapes.map((s, idx) => {
        const data = s.shapeData as WireframeShapeData;
        if (!data.wireframeType || data.x == null) return null;
        const isChild = isWireframeGroupChild(data);
        const compositeType = data.compositeType;
        return {
          id: `wf_${idx}`,
          type: (compositeType ? "container_box" : data.wireframeType) as UIComponentType,
          confidence: 1.0,
          boundingBox: { x: data.x!, y: data.y!, width: data.w!, height: data.h! },
          strokes: [],
          source: "palette",
          hidden: isChild,
          compositeType: data.groupRoot ? compositeType : undefined,
        } as DetectedComponent & { hidden?: boolean; compositeType?: string };
      }).filter(Boolean) as (DetectedComponent & { hidden?: boolean; compositeType?: string })[];

    // Step 2: Cluster nearby components (ONLY freehand strokes)
    const groups = clusterComponents(detectedFromPencil, 50);

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
        source: 'freehand',
      };
    });

    // Step 4: Composite wireframe symbol analysis (v2)
    // Multi-stroke clusters get checked for known wireframe patterns
    // (rect+X = image, hamburger = nav, stacked rects = list, etc.)
    const upgradedComponents = upgradeWithCompositeSymbols(mergedComponents);
    // Combine freehand ML components with perfect palette components
    const finalComponents = [...upgradedComponents, ...detectedFromWireframe];

    // Step 5: Build detection results for the panel
    const detResults: BoardDetection[] = finalComponents.map((c) => ({
      id: c.id,
      type: c.type,
      confidence: c.confidence,
      boundingBox: c.boundingBox,
      method: c.source === "palette" ? ("palette" as const) : ("ensemble" as const),
      allScores: [],
      source: c.source,
      hidden: (c as { hidden?: boolean }).hidden,
      compositeType: (c as { compositeType?: string }).compositeType,
    }));
    setDetections(detResults);

    // Step 6: Build layout tree
    if (finalComponents.length > 0) {
      const tree = buildContainmentTree(finalComponents);
      setLayoutTree(tree);
    } else {
      setLayoutTree(null);
    }
  }, [shapes]);

  // Debounce pipeline runs
  useEffect(() => {
    const timer = setTimeout(runDetectionPipeline, 300);
    return () => clearTimeout(timer);
  }, [runDetectionPipeline]);

  const handleSelectComponent = useCallback((id: string) => {
    setTool("select");
    setSelectedComponentId(id);
  }, []);

  const clientToWorldPoint = useCallback(
    (clientX: number, clientY: number) => {
      const viewportEl = viewportRef.current;
      if (!viewportEl) return { x: 0, y: 0 };
      const rect = viewportEl.getBoundingClientRect();
      return screenToWorld(clientX, clientY, rect, viewport);
    },
    [viewport],
  );

  const hasDrawableContent = shapes.some(
    (s) => s.shapeType === "pencil" || s.shapeType === "wireframe",
  );

  const handleAutoDrawMagic = useCallback(() => {
    runDetectionPipeline();
    setAnalysisPanelCollapsed(false);
    analysisPanelRef.current?.switchToTab("code");
    setAutoGenerate(true);
  }, [runDetectionPipeline]);

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
    eraserPreview,
  } = useCanvasManager({
    canvasRef,
    viewportRef,
    viewport,
    tool,
    shapes,
    color,
    strokeWidth,
    onSendDrawEventAction: (type, data, shapeId) => {
      if (type === "analysis") {
        sendDrawEvent(type, data);
        return;
      }
      const id = shapeId ?? createShapeId();
      setShapes((prev) => {
        if (prev.some((s) => s.id === id)) return prev;
        return [...prev, { id, shapeType: type as ShapeType, shapeData: data }];
      });
      // Embed id so collaborators and history reload can match erasures
      sendDrawEvent(type, { ...data, __id: id });
    },
    onEraseShapes: (shapeIds) => {
      if (shapeIds.length === 0) return;
      const idSet = new Set(shapeIds);
      setShapes((prev) => {
        const removed = prev.filter((s) => idSet.has(s.id));
        if (removed.length === 0) return prev;
        sendDrawEvent("clear_shape", {
          shapeIds,
          shapes: removed.map((s) => s.shapeData),
        });
        return prev.filter((s) => !idSet.has(s.id));
      });
      setSelectedComponentId(null);
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

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    applyCameraTransform(ctx, viewport);
    const lineScale = 1 / viewport.zoom;

    for (const det of detections) {
      if ((det as BoardDetection).hidden) continue;

      const bbox = det.boundingBox;
      const bboxColor = getComponentColor(det.type);
      const isSelected = selectedComponentId === det.id;
      const compositeType = (det as BoardDetection).compositeType;
      const label = compositeType
        ? (COMPOSITE_DISPLAY_NAMES[compositeType] ?? compositeType.replace(/_/g, " "))
        : det.type.replace(/_/g, " ");

      ctx.save();
      ctx.strokeStyle = bboxColor;
      ctx.lineWidth = (isSelected ? 2.5 : 1.5) * lineScale;
      ctx.setLineDash(isSelected ? [] : [6, 4]);
      ctx.globalAlpha = isSelected ? 0.9 : 0.5;
      ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);

      ctx.font = `bold ${11 * lineScale}px Inter, sans-serif`;
      ctx.fillStyle = bboxColor;
      ctx.globalAlpha = isSelected ? 1 : 0.7;
      const textW = ctx.measureText(label).width;
      ctx.fillStyle = bboxColor;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(bbox.x - 1, bbox.y - 16 * lineScale, textW + 8, 16 * lineScale);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, bbox.x + 3, bbox.y - 4 * lineScale);
      ctx.restore();
    }
  }, [renderCanvas, shapes, detections, selectedComponentId, viewport]);

  /* ── Palette drop handler ── */
  const handlePaletteDrop = useCallback((event: PaletteDropEvent) => {
    const { item, x, y } = event;
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;

    const rect = viewportEl.getBoundingClientRect();
    const world = screenToWorld(x, y, rect, viewport);

    const baseX = world.x - item.defaultSize.w / 2;
    const baseY = world.y - item.defaultSize.h / 2;
    const baseW = item.defaultSize.w;
    const baseH = item.defaultSize.h;

    type Spec = { wireframeType: string; x: number; y: number; w: number; h: number };
    const specs: Spec[] = [];

    // Composite “sections” are stamped as multiple primitive wireframes.
    if (item.id === "slideshow") {
      const slideX = baseX + baseW * 0.12;
      const slideY = baseY + baseH * 0.12;
      const slideW = baseW * 0.76;
      const slideH = baseH * 0.62;

      const btnW = Math.max(24, baseW * 0.08);
      const btnH = Math.max(18, slideH * 0.28);
      const centerY = slideY + slideH / 2;

      const prevX = slideX + 10;
      const nextX = slideX + slideW - btnW - 10;
      const btnY = centerY - btnH / 2;

      const captionX = slideX + 6;
      const captionY = slideY + slideH + 10;
      const captionW = slideW - 12;
      const captionH = Math.max(34, baseH * 0.15);

      specs.push(
        { wireframeType: "section", x: baseX, y: baseY, w: baseW, h: baseH },
        { wireframeType: "image_placeholder", x: slideX, y: slideY, w: slideW, h: slideH },
        { wireframeType: "button", x: prevX, y: btnY, w: btnW, h: btnH },
        { wireframeType: "button", x: nextX, y: btnY, w: btnW, h: btnH },
        { wireframeType: "text_label", x: captionX, y: captionY, w: captionW, h: captionH },
      );
    } else if (item.id === "offer_section") {
      const cardX = baseX;
      const cardY = baseY;
      const cardW = baseW;
      const cardH = baseH;

      const pad = 16;
      const imgW = cardW * 0.42;
      const imgH = cardH * 0.55;
      const imgX = cardX + pad;
      const imgY = cardY + pad;

      const textX = imgX + imgW + 16;
      const textW = cardX + cardW - textX - pad;

      const titleH = Math.max(44, cardH * 0.12);
      const descH = Math.max(64, cardH * 0.18);
      const listH = Math.max(90, cardH * 0.22);
      const btnH = Math.max(44, cardH * 0.12);

      const titleY = cardY + pad;
      const descY = titleY + titleH + 10;
      const listY = descY + descH + 10;
      const btnY = cardY + cardH - pad - btnH;

      const btnW = Math.max(120, textW * 0.42);

      specs.push(
        { wireframeType: "section", x: cardX, y: cardY, w: cardW, h: cardH },
        { wireframeType: "image_placeholder", x: imgX, y: imgY, w: imgW, h: imgH },
        { wireframeType: "text_label", x: textX, y: titleY, w: textW, h: titleH },
        { wireframeType: "text_label", x: textX, y: descY, w: textW, h: descH },
        { wireframeType: "list", x: textX, y: listY, w: textW, h: listH },
        { wireframeType: "button", x: textX, y: btnY, w: btnW, h: btnH },
      );
    } else if (item.id === "auth_login") {
      const cardX = baseX;
      const cardY = baseY;
      const cardW = baseW;
      const cardH = baseH;

      const pad = Math.max(12, cardW * 0.03);
      const innerX = cardX + pad;
      const innerY = cardY + pad;
      const innerW = Math.max(140, cardW - pad * 2);

      const titleH = Math.max(36, cardH * 0.12);
      const fieldH = Math.max(30, cardH * 0.08);
      const gap = Math.max(8, cardH * 0.02);
      const checkboxH = Math.max(22, cardH * 0.06);
      const btnH = Math.max(40, cardH * 0.1);
      const dividerH = 4;
      const socialBtnH = Math.max(38, cardH * 0.08);

      const titleY = innerY;
      const emailY = titleY + titleH + gap;
      const passwordY = emailY + fieldH + gap;
      const checkboxY = passwordY + fieldH + gap;
      const loginBtnY = checkboxY + checkboxH + gap;
      const dividerY = loginBtnY + btnH + gap;
      const socialBtnY = dividerY + 16;

      specs.push(
        { wireframeType: "section", x: cardX, y: cardY, w: cardW, h: cardH },
        { wireframeType: "text_label", x: innerX, y: titleY, w: innerW, h: titleH },
        { wireframeType: "input_field", x: innerX, y: emailY, w: innerW, h: fieldH },
        { wireframeType: "input_field", x: innerX, y: passwordY, w: innerW, h: fieldH },
        { wireframeType: "checkbox", x: innerX, y: checkboxY, w: innerW, h: checkboxH },
        { wireframeType: "button", x: innerX, y: loginBtnY, w: innerW, h: btnH },
        { wireframeType: "divider", x: innerX, y: dividerY, w: innerW, h: dividerH },
        { wireframeType: "button", x: innerX, y: socialBtnY, w: innerW, h: socialBtnH },
      );
    } else if (item.id === "auth_signup") {
      const cardX = baseX;
      const cardY = baseY;
      const cardW = baseW;
      const cardH = baseH;

      const pad = Math.max(12, cardW * 0.03);
      const innerX = cardX + pad;
      const innerY = cardY + pad;
      const innerW = Math.max(140, cardW - pad * 2);

      const titleH = Math.max(36, cardH * 0.12);
      const fieldH = Math.max(30, cardH * 0.075);
      const gap = Math.max(8, cardH * 0.018);
      const checkboxH = Math.max(24, cardH * 0.065);
      const btnH = Math.max(42, cardH * 0.09);
      const dividerH = 4;
      const socialBtnH = Math.max(38, cardH * 0.08);

      const titleY = innerY;
      const nameY = titleY + titleH + gap;
      const emailY = nameY + fieldH + gap;
      const passwordY = emailY + fieldH + gap;
      const checkboxY = passwordY + fieldH + gap;
      const signupBtnY = checkboxY + checkboxH + gap;
      const dividerY = signupBtnY + btnH + gap;
      const socialBtnY = dividerY + 16;

      specs.push(
        { wireframeType: "section", x: cardX, y: cardY, w: cardW, h: cardH },
        { wireframeType: "text_label", x: innerX, y: titleY, w: innerW, h: titleH },
        { wireframeType: "input_field", x: innerX, y: nameY, w: innerW, h: fieldH },
        { wireframeType: "input_field", x: innerX, y: emailY, w: innerW, h: fieldH },
        { wireframeType: "input_field", x: innerX, y: passwordY, w: innerW, h: fieldH },
        { wireframeType: "checkbox", x: innerX, y: checkboxY, w: innerW, h: checkboxH },
        { wireframeType: "button", x: innerX, y: signupBtnY, w: innerW, h: btnH },
        { wireframeType: "divider", x: innerX, y: dividerY, w: innerW, h: dividerH },
        { wireframeType: "button", x: innerX, y: socialBtnY, w: innerW, h: socialBtnH },
      );
    } else if (item.id === "profile_page") {
      const cardX = baseX;
      const cardY = baseY;
      const cardW = baseW;
      const cardH = baseH;

      const pad = Math.max(12, cardW * 0.03);
      const innerX = cardX + pad;
      const innerY = cardY + pad;
      const innerW = Math.max(180, cardW - pad * 2);

      const coverH = Math.max(120, cardH * 0.28);
      const avatarS = Math.max(54, cardW * 0.13);
      const gap = Math.max(10, cardH * 0.02);
      const fieldH = Math.max(30, cardH * 0.065);
      const dropdownH = fieldH;
      const btnH = Math.max(40, cardH * 0.09);
      const sectionLabelH = Math.max(28, cardH * 0.06);

      const coverY = innerY;
      const coverX = innerX;
      const avatarX = innerX + 8;
      const avatarY = coverY + coverH - avatarS / 2;

      const formX = avatarX + avatarS + 16;
      const formW = Math.max(160, cardX + cardW - pad - formX);
      const titleY = coverY + 16;

      const nameY = titleY + sectionLabelH + gap;
      const emailY = nameY + fieldH + gap;
      const planY = emailY + fieldH + gap;
      const saveBtnY = planY + dropdownH + gap;

      const listY = saveBtnY + btnH + gap;
      const listH = Math.max(90, cardH * 0.23);

      specs.push(
        { wireframeType: "section", x: cardX, y: cardY, w: cardW, h: cardH },
        { wireframeType: "image_placeholder", x: coverX, y: coverY, w: innerW, h: coverH },
        { wireframeType: "avatar", x: avatarX, y: avatarY, w: avatarS, h: avatarS },
        { wireframeType: "text_label", x: formX, y: titleY, w: formW, h: sectionLabelH },
        { wireframeType: "input_field", x: formX, y: nameY, w: formW, h: fieldH },
        { wireframeType: "input_field", x: formX, y: emailY, w: formW, h: fieldH },
        { wireframeType: "dropdown", x: formX, y: planY, w: formW, h: dropdownH },
        { wireframeType: "button", x: formX, y: saveBtnY, w: Math.min(240, formW), h: btnH },
        { wireframeType: "list", x: innerX, y: listY, w: innerW, h: listH },
      );
    } else {
      specs.push({
        wireframeType: item.id,
        x: baseX,
        y: baseY,
        w: baseW,
        h: baseH,
      });
    }

    const isComposite = specs.length > 1;
    const groupId = isComposite ? createShapeId() : undefined;

    const shapesToAdd: Array<{ id: string; shapeData: Record<string, unknown> }> = [];
    specs.forEach((spec, specIndex) => {
      const shapeId = createShapeId();
      const wireframeData: Record<string, unknown> = {
        wireframeType: spec.wireframeType,
        x: spec.x,
        y: spec.y,
        w: spec.w,
        h: spec.h,
        stroke: "#64748b",
        lineWidth: 1.5,
        ...(groupId
          ? {
              groupId,
              groupRoot: specIndex === 0,
              compositeType: item.id,
            }
          : {}),
      };
      shapesToAdd.push({ id: shapeId, shapeData: wireframeData });
      sendDrawEvent("wireframe" as ShapeType, { ...wireframeData, __id: shapeId });
    });

    setShapes((prev) => [
      ...prev,
      ...shapesToAdd.map((s) => ({
        id: s.id,
        shapeType: "wireframe" as ShapeType,
        shapeData: s.shapeData,
      })),
    ]);
  }, [sendDrawEvent, viewport]);

  /* ── Canvas drag-over / drop handlers (on viewport — canvas ignores events in select mode) ── */
  const [isPaletteDragOver, setIsPaletteDragOver] = useState(false);

  const handleViewportDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("text/plain")) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setIsPaletteDragOver(true);
  }, []);

  const handleViewportDragLeave = useCallback((e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    setIsPaletteDragOver(false);
  }, []);

  const handleViewportDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPaletteDragOver(false);
    try {
      const itemData = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (itemData?.id && itemData?.defaultSize) {
        handlePaletteDrop({ item: itemData, x: e.clientX, y: e.clientY });
      }
    } catch {
      /* ignore malformed drag payload */
    }
  }, [handlePaletteDrop]);

  useEffect(() => {
    const clearPaletteDrag = () => setIsPaletteDragOver(false);
    window.addEventListener("dragend", clearPaletteDrag);
    return () => window.removeEventListener("dragend", clearPaletteDrag);
  }, []);

  /* ── Double-click to annotate ── */
  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent) => {
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;
    const rect = viewportEl.getBoundingClientRect();
    const { x: cx, y: cy } = screenToWorld(e.clientX, e.clientY, rect, viewport);

    // Find which detected component was double-clicked
    for (const det of detections) {
      const bb = det.boundingBox;
      if (cx >= bb.x && cx <= bb.x + bb.width && cy >= bb.y && cy <= bb.y + bb.height) {
        setEditingAnnotation({
          componentId: det.id,
          componentType: det.type,
          position: { x: e.clientX, y: e.clientY },
        });
        return;
      }
    }
  }, [detections, viewport]);

  const handleSaveAnnotation = useCallback((annotation: ComponentAnnotation) => {
    setAnnotations(prev => {
      const next = new Map(prev);
      next.set(annotation.componentId, annotation);
      return next;
    });
    setEditingAnnotation(null);
  }, []);

  const handleUpdateBBox = useCallback((
    id: string,
    newBBox: { x: number; y: number; width: number; height: number },
    baseBBox?: { x: number; y: number; width: number; height: number },
  ) => {
    const scaleFrom = baseBBox ?? detections.find((d) => d.id === id)?.boundingBox;

    setDetections((prev) =>
      prev.map((d) => (d.id === id ? { ...d, boundingBox: newBBox } : d)),
    );

    if (id.startsWith("wf_")) {
      const wfIdx = parseInt(id.replace("wf_", ""), 10);
      setShapes((prev) => {
        let wfCount = 0;
        let targetData: WireframeShapeData | null = null;
        for (const s of prev) {
          if (s.shapeType !== "wireframe") continue;
          if (wfCount === wfIdx) {
            targetData = s.shapeData as WireframeShapeData;
            break;
          }
          wfCount++;
        }

        if (!targetData || !scaleFrom) return prev;

        const groupId = targetData.groupId;
        if (!groupId) {
          let count = 0;
          return prev.map((s) => {
            if (s.shapeType !== "wireframe") return s;
            if (count++ === wfIdx) {
              return {
                ...s,
                shapeData: {
                  ...s.shapeData,
                  x: newBBox.x,
                  y: newBBox.y,
                  w: newBBox.width,
                  h: newBBox.height,
                },
              };
            }
            return s;
          });
        }

        let rootData: WireframeShapeData | null = null;
        for (const s of prev) {
          if (s.shapeType !== "wireframe") continue;
          const data = s.shapeData as WireframeShapeData;
          if (data.groupId === groupId && data.groupRoot) {
            rootData = data;
            break;
          }
        }

        const groupFrom = rootData
          ? { x: rootData.x!, y: rootData.y!, width: rootData.w!, height: rootData.h! }
          : scaleFrom;

        return prev.map((s) => {
          if (s.shapeType !== "wireframe") return s;
          const data = s.shapeData as WireframeShapeData;
          if (data.groupId !== groupId) return s;
          const scaled = scaleWireframeRect(
            { x: data.x!, y: data.y!, w: data.w!, h: data.h! },
            groupFrom,
            newBBox,
          );
          return {
            ...s,
            shapeData: { ...data, x: scaled.x, y: scaled.y, w: scaled.w, h: scaled.h },
          };
        });
      });
      requestAnimationFrame(() => renderCanvas());
      return;
    }

    if (!scaleFrom || scaleFrom.width <= 0 || scaleFrom.height <= 0) return;

    const scalePath = (path: { x: number; y: number; t?: number }[]) =>
      path.map((p) => ({
        ...p,
        x: newBBox.x + ((p.x - scaleFrom.x) / scaleFrom.width) * newBBox.width,
        y: newBBox.y + ((p.y - scaleFrom.y) / scaleFrom.height) * newBBox.height,
      }));

    if (id.startsWith("comp_")) {
      const idx = parseInt(id.replace("comp_", ""), 10);
      setShapes((prev) => {
        let pencilCount = 0;
        return prev.map((s) => {
          if (s.shapeType !== "pencil") return s;
          if (pencilCount++ !== idx) return s;
          const path = (s.shapeData as { path?: { x: number; y: number }[] }).path;
          if (!path?.length) return s;
          return {
            ...s,
            shapeData: { ...s.shapeData, path: scalePath(path) },
          };
        });
      });
    }
  }, [detections, renderCanvas]);

  const handleDeleteComponent = useCallback((id: string) => {
    if (id.startsWith('wf_')) {
      const wfIdx = parseInt(id.replace('wf_', ''), 10);
      setShapes((prev) => {
        let wfCount = 0;
        let groupId: string | undefined;
        for (const s of prev) {
          if (s.shapeType !== 'wireframe') continue;
          if (wfCount === wfIdx) {
            groupId = (s.shapeData as WireframeShapeData).groupId;
            break;
          }
          wfCount++;
        }

        const removedIds: string[] = [];
        let next: Shape[];

        if (groupId) {
          next = prev.filter((s) => {
            if (s.shapeType !== 'wireframe') return true;
            const data = s.shapeData as WireframeShapeData;
            if (data.groupId === groupId) {
              removedIds.push(s.id);
              return false;
            }
            return true;
          });
        } else {
          let count = 0;
          next = prev.filter((s) => {
            if (s.shapeType !== 'wireframe') return true;
            if (count++ === wfIdx) {
              removedIds.push(s.id);
              return false;
            }
            return true;
          });
        }

        if (removedIds.length > 0) {
          sendDrawEvent("clear_shape", { shapeIds: removedIds });
        }
        return next;
      });
    }
    setSelectedComponentId(null);
  }, [sendDrawEvent]);

  const handleDuplicateComponent = useCallback((id: string) => {
    if (id.startsWith('wf_')) {
      const wfIdx = parseInt(id.replace('wf_', ''), 10);
      setShapes((prev) => {
        let wfCount = 0;
        let groupId: string | undefined;
        for (const s of prev) {
          if (s.shapeType !== 'wireframe') continue;
          if (wfCount === wfIdx) {
            groupId = (s.shapeData as WireframeShapeData).groupId;
            break;
          }
          wfCount++;
        }

        const offset = 20;
        const newGroupId = groupId ? createShapeId() : undefined;
        const duplicated: Shape[] = [];

        const sourceShapes = groupId
          ? prev.filter(
              (s) =>
                s.shapeType === 'wireframe' &&
                (s.shapeData as WireframeShapeData).groupId === groupId,
            )
          : (() => {
              let count = 0;
              for (const s of prev) {
                if (s.shapeType !== 'wireframe') continue;
                if (count === wfIdx) return [s];
                count++;
              }
              return [];
            })();

        for (const s of sourceShapes) {
          const data = s.shapeData as WireframeShapeData;
          const shapeId = createShapeId();
          const nextData = {
            ...data,
            x: (data.x ?? 0) + offset,
            y: (data.y ?? 0) + offset,
            ...(newGroupId ? { groupId: newGroupId } : {}),
          };
          duplicated.push({
            id: shapeId,
            shapeType: s.shapeType,
            shapeData: nextData,
          });
          sendDrawEvent("wireframe", { ...nextData, __id: shapeId });
        }

        return duplicated.length > 0 ? [...prev, ...duplicated] : prev;
      });
    }
  }, [sendDrawEvent]);

  return (
    <div className="draw-workspace-root">
      {/* Header Navigation */}
      <nav className="nav">
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <a
            href="/projects"
            style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
          >
            <ArrowLeft size={15} />
            Projects
          </a>
          <div
            style={{
              width: 1,
              height: 20,
              background: "var(--border)",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.85rem",
              color: "var(--text-muted)",
            }}
          >
            <Radio size={13} style={{ color: "var(--success)" }} />
            Room {roomId}
          </div>
        </div>

        {/* Integrated Toolbar */}
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", zIndex: 110 }}>
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
        </div>

        <div className="nav-actions">
          <span className="badge badge-accent">
            <Users size={11} />
            Live
          </span>
          <a
            href={process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:4002"}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
          >
            <BarChart3 size={14} />
            Dashboard
          </a>
        </div>
      </nav>

      {/* Main Workspace Area */}
      <div className="workspace-main">
        <ComponentPalette
          onDrop={handlePaletteDrop}
          collapsed={paletteCollapsed}
          onToggleCollapse={() => setPaletteCollapsed(prev => !prev)}
          width={paletteWidth}
        />

        {!paletteCollapsed && (
          <PanelResizeHandle side="left" onResize={handlePaletteResize} />
        )}

        <div className="draw-board" ref={containerRef}>
          <div
            ref={viewportRef}
            className={`draw-board-viewport${isSpaceDown ? " space-pressed" : ""}${isPanning ? " is-panning" : ""}${isPaletteDragOver ? " drag-over" : ""}`}
            style={gridStyle}
            onPointerDownCapture={handleViewportPointerDown}
            onPointerMove={handleViewportPointerMove}
            onPointerUp={handleViewportPointerUp}
            onPointerCancel={handleViewportPointerUp}
            onDragOver={handleViewportDragOver}
            onDragEnter={handleViewportDragOver}
            onDragLeave={handleViewportDragLeave}
            onDrop={handleViewportDrop}
            onPointerDown={(e) => {
              if (tool !== "select") return;
              const target = e.target as HTMLElement;
              if (
                target !== e.currentTarget &&
                !target.classList.contains("draw-canvas")
              ) {
                return;
              }
              const world = clientToWorldPoint(e.clientX, e.clientY);
              const hits = detectionsAtPoint(detections, world.x, world.y);
              if (hits.length === 0) {
                setSelectedComponentId(null);
              }
            }}
            onMouseDown={(e) => {
              if (e.button === 1) e.preventDefault();
            }}
            onContextMenu={(e) => {
              if (isSpaceDown) e.preventDefault();
            }}
          >
            <canvas
              ref={canvasRef}
              width={viewportSize.w}
              height={viewportSize.h}
              className="draw-canvas"
              style={{
                pointerEvents: tool === "select" ? "none" : "auto",
                cursor: isSpaceDown || isPanning
                  ? isPanning ? "grabbing" : "grab"
                  : tool === "eraser"
                    ? "crosshair"
                    : tool === "select"
                      ? "default"
                      : "crosshair",
              }}
              onMouseDown={(e) => {
                if (shouldPan(e)) return;
                if (tool === "select") return;
                if (selectedComponentId) setSelectedComponentId(null);
                handleMouseDown(e);
              }}
              onMouseUp={(e) => {
                if (shouldPan(e)) return;
                handleMouseUp(e);
              }}
              onMouseLeave={(e) => {
                if (tool !== "eraser") handleMouseUp(e);
              }}
              onMouseMove={combinedMouseMove}
              onDoubleClick={handleCanvasDoubleClick}
            />

            <div
              className={`draw-board-scene${isPaletteDragOver ? " is-palette-drag" : ""}`}
              style={sceneStyle}
            >
              {eraserPreview && (
                <div
                  className="eraser-preview"
                  style={{
                    left: eraserPreview.x,
                    top: eraserPreview.y,
                    width: eraserPreview.w,
                    height: eraserPreview.h,
                  }}
                />
              )}

              {detections.length > 0 && (tool === "select" || selectedComponentId) && (
                <TransformOverlay
                  detections={detections as any}
                  selectedId={selectedComponentId}
                  onSelect={setSelectedComponentId}
                  clientToWorld={clientToWorldPoint}
                  onUpdateBBox={handleUpdateBBox}
                  onOpenAnnotation={(id) => {
                    const det = detections.find(d => d.id === id);
                    if (det) {
                      setEditingAnnotation({
                        componentId: id,
                        componentType: det.type,
                        position: { x: det.boundingBox.x + det.boundingBox.width, y: det.boundingBox.y },
                      });
                    }
                  }}
                  onDelete={handleDeleteComponent}
                  onDuplicate={handleDuplicateComponent}
                  zoom={viewport.zoom}
                />
              )}

              <LiveCursors cursors={cursorsRef.current} key={cursorsVersion} />
            </div>

            <div className="viewport-controls">
              <button type="button" title="Zoom out (Ctrl+-)" onClick={zoomOut} aria-label="Zoom out">
                <Minus size={14} />
              </button>
              <button type="button" title="Reset zoom (Ctrl+0)" onClick={resetView} className="viewport-zoom-label">
                {Math.round(viewport.zoom * 100)}%
              </button>
              <button type="button" title="Zoom in (Ctrl++)" onClick={zoomIn} aria-label="Zoom in">
                <Plus size={14} />
              </button>
              <button type="button" title="Reset view" onClick={resetView} aria-label="Reset view">
                <Maximize2 size={14} />
              </button>
            </div>
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

          {/* Chat panel */}
          <ChatPanel
            messages={chatMessages}
            onSendMessage={(content) => {
              const pendingKey = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
              setChatMessages((prev) => [
                ...prev,
                {
                  key: pendingKey,
                  userId: myUserIdRef.current ?? myUserId ?? "",
                  userName: myUserName,
                  content,
                  createdAt: new Date().toISOString(),
                },
              ]);
              sendChatMessage(content);
            }}
            isOpen={chatOpen}
            onToggle={() => setChatOpen((o) => !o)}
            currentUserId={myUserId ?? undefined}
          />
          {/* Annotation editor overlay */}
          {editingAnnotation && (
            <AnnotationEditor
              componentId={editingAnnotation.componentId}
              componentType={editingAnnotation.componentType}
              position={editingAnnotation.position}
              annotation={annotations.get(editingAnnotation.componentId) || null}
              onSave={handleSaveAnnotation}
              onClose={() => setEditingAnnotation(null)}
            />
          )}
        </div>

        {!analysisPanelCollapsed && (
          <PanelResizeHandle side="right" onResize={handleAnalysisResize} />
        )}

        {/* SketchUI 3-Tab Panel */}
        <AnalysisPanel
          ref={analysisPanelRef}
          detections={detections}
          layoutTree={layoutTree}
          selectedComponentId={selectedComponentId}
          onSelectComponent={handleSelectComponent}
          onUpdateNodeType={handleUpdateNodeType}
          canvasWidth={viewportSize.w}
          canvasHeight={viewportSize.h}
          autoGenerate={autoGenerate}
          onGenerationComplete={() => setAutoGenerate(false)}
          annotations={annotations}
          collapsed={analysisPanelCollapsed}
          onToggleCollapse={() => setAnalysisPanelCollapsed(prev => !prev)}
          width={analysisPanelWidth}
        />
      </div>

      {/* Status Bar */}
      <div className="draw-status">
        <div className="draw-status-start">
          <div className="draw-status-item">
            <span className="draw-status-dot" />
            Connected
          </div>
          <div className="draw-status-item">
            Room #{roomId}
          </div>
        </div>

        <div className="draw-status-center">
          {hasDrawableContent && (
            <button
              type="button"
              className="autodraw-magic-btn"
              title="AutoDraw Magic"
              aria-label="AutoDraw Magic"
              onClick={handleAutoDrawMagic}
            >
              ✨
            </button>
          )}
        </div>

        <div className="draw-status-end">
          <div className="draw-status-item draw-status-shortcuts">
            Ctrl+Z Undo · Ctrl+Y Redo · Scroll to pan · Ctrl+Scroll to zoom · Space+drag to pan
          </div>
          <div className="draw-status-item">
            DTW + Geometric Heuristics
          </div>
        </div>
      </div>
    </div>
  );
}
