import React, { useCallback, useEffect, useRef } from "react";
import type { UIDetectionResult } from "@repo/pattern-detection";
import {
  cyclePickId,
  detectionsAtPoint,
  sortDetectionsForHitLayer,
} from "../lib/detectionHitTest";

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

interface TransformData {
  id: string;
  mode: "drag" | "resize";
  resizeHandle: ResizeHandle | null;
  startX: number;
  startY: number;
  originalBBox: { x: number; y: number; width: number; height: number };
}

interface TransformOverlayProps {
  detections: (UIDetectionResult & { id: string; hidden?: boolean })[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdateBBox: (
    id: string,
    newBBox: { x: number; y: number; width: number; height: number },
    baseBBox?: { x: number; y: number; width: number; height: number },
  ) => void;
  onOpenAnnotation: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  clientToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  zoom?: number;
}

export function TransformOverlay({
  detections,
  selectedId,
  onSelect,
  onUpdateBBox,
  onOpenAnnotation,
  onDelete,
  onDuplicate,
  clientToWorld,
  zoom = 1,
}: TransformOverlayProps) {
  const interactiveDetections = detections.filter((d) => !d.hidden);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const activeTransform = useRef<TransformData | null>(null);
  const onUpdateBBoxRef = useRef(onUpdateBBox);
  onUpdateBBoxRef.current = onUpdateBBox;
  const clientToWorldRef = useRef(clientToWorld);
  clientToWorldRef.current = clientToWorld;
  const pickSessionRef = useRef<{ x: number; y: number; ids: string[]; index: number } | null>(null);

  const handleGlobalPointerMove = useCallback((e: PointerEvent) => {
    const tf = activeTransform.current;
    if (!tf) return;

    const dx = (e.clientX - tf.startX) / zoomRef.current;
    const dy = (e.clientY - tf.startY) / zoomRef.current;
    const orig = tf.originalBBox;

    if (tf.mode === "drag") {
      const newX = Math.round((orig.x + dx) / 8) * 8;
      const newY = Math.round((orig.y + dy) / 8) * 8;
      onUpdateBBoxRef.current(tf.id, { ...orig, x: newX, y: newY }, orig);
    } else if (tf.mode === "resize" && tf.resizeHandle) {
      let newBBox = { ...orig };

      switch (tf.resizeHandle) {
        case "se":
          newBBox.width = Math.max(24, orig.width + dx);
          newBBox.height = Math.max(24, orig.height + dy);
          break;
        case "sw":
          newBBox.x = Math.min(orig.x + orig.width - 24, orig.x + dx);
          newBBox.width = Math.max(24, orig.width - dx);
          newBBox.height = Math.max(24, orig.height + dy);
          break;
        case "ne":
          newBBox.y = Math.min(orig.y + orig.height - 24, orig.y + dy);
          newBBox.width = Math.max(24, orig.width + dx);
          newBBox.height = Math.max(24, orig.height - dy);
          break;
        case "nw":
          newBBox.x = Math.min(orig.x + orig.width - 24, orig.x + dx);
          newBBox.y = Math.min(orig.y + orig.height - 24, orig.y + dy);
          newBBox.width = Math.max(24, orig.width - dx);
          newBBox.height = Math.max(24, orig.height - dy);
          break;
        case "e":
          newBBox.width = Math.max(24, orig.width + dx);
          break;
        case "w":
          newBBox.x = Math.min(orig.x + orig.width - 24, orig.x + dx);
          newBBox.width = Math.max(24, orig.width - dx);
          break;
        case "s":
          newBBox.height = Math.max(24, orig.height + dy);
          break;
        case "n":
          newBBox.y = Math.min(orig.y + orig.height - 24, orig.y + dy);
          newBBox.height = Math.max(24, orig.height - dy);
          break;
      }

      newBBox.x = Math.round(newBBox.x / 8) * 8;
      newBBox.y = Math.round(newBBox.y / 8) * 8;
      newBBox.width = Math.round(newBBox.width / 8) * 8;
      newBBox.height = Math.round(newBBox.height / 8) * 8;

      onUpdateBBoxRef.current(tf.id, newBBox, orig);
    }
  }, []);

  const handleGlobalPointerUp = useCallback(() => {
    activeTransform.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", handleGlobalPointerMove);
    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("pointercancel", handleGlobalPointerUp);
    return () => {
      window.removeEventListener("pointermove", handleGlobalPointerMove);
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      window.removeEventListener("pointercancel", handleGlobalPointerUp);
    };
  }, [handleGlobalPointerMove, handleGlobalPointerUp]);

  const resolvePick = useCallback(
    (clientX: number, clientY: number) => {
      const world = clientToWorldRef.current(clientX, clientY);
      const hits = detectionsAtPoint(interactiveDetections, world.x, world.y);
      const { id, session } = cyclePickId(hits, pickSessionRef.current, clientX, clientY);
      pickSessionRef.current = session;
      return { id, hits, bbox: hits.find((h) => h.id === id)?.boundingBox };
    },
    [interactiveDetections],
  );

  const startDrag = (
    e: React.PointerEvent,
    id: string,
    bbox: { x: number; y: number; width: number; height: number },
  ) => {
    e.stopPropagation();
    e.preventDefault();
    activeTransform.current = {
      id,
      mode: "drag",
      resizeHandle: null,
      startX: e.clientX,
      startY: e.clientY,
      originalBBox: { ...bbox },
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const startResize = (
    e: React.PointerEvent,
    id: string,
    handle: ResizeHandle,
    bbox: { x: number; y: number; width: number; height: number },
  ) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(id);
    activeTransform.current = {
      id,
      mode: "resize",
      resizeHandle: handle,
      startX: e.clientX,
      startY: e.clientY,
      originalBBox: { ...bbox },
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const handleHitPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const { id, bbox } = resolvePick(e.clientX, e.clientY);
      if (!id || !bbox) return;

      onSelect(id);
      startDrag(e, id, bbox);
    },
    [onSelect, resolvePick],
  );

  const selectedComponent = interactiveDetections.find((d) => d.id === selectedId);
  const hitLayer = sortDetectionsForHitLayer(interactiveDetections);
  const handleHalf = 8 / zoom;
  const handleSize = handleHalf * 2;
  const strokeScale = 1.5 / zoom;

  const hasOverlappingSelection = selectedComponent
    ? interactiveDetections.some((other) => {
        if (other.id === selectedComponent.id) return false;
        const a = selectedComponent.boundingBox;
        const b = other.boundingBox;
        return !(
          a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y
        );
      })
    : false;

  return (
    <svg
      className="transform-overlay-svg"
      style={{ position: "absolute", left: 0, top: 0, width: 1, height: 1, overflow: "visible", pointerEvents: "none", zIndex: 10 }}
    >
      {selectedComponent && (() => {
        const { x, y, width, height } = selectedComponent.boundingBox;

        return (
          <g className="selection-overlay-visual" style={{ pointerEvents: "none" }}>
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              fill="rgba(37, 99, 235, 0.06)"
              stroke="#2563EB"
              strokeWidth={strokeScale}
              strokeDasharray={`${6 / zoom} ${3 / zoom}`}
            />

            <text
              x={x + width / 2}
              y={y - 10 / zoom}
              textAnchor="middle"
              fontSize={11 / zoom}
              fill="#2563EB"
              fontWeight="bold"
              style={{ userSelect: "none" }}
            >
              {Math.round(width)} × {Math.round(height)}
              {hasOverlappingSelection ? " · click to cycle" : ""}
            </text>
          </g>
        );
      })()}

      {/* Hit targets above visuals: smallest on top for overlapping picks */}
      <g className="transform-hit-layer" style={{ pointerEvents: "all" }}>
        {hitLayer.map((det) => {
          const { x, y, width, height } = det.boundingBox;
          const isSelected = det.id === selectedId;
          return (
            <rect
              key={`hit-${det.id}`}
              x={x}
              y={y}
              width={width}
              height={height}
              fill="transparent"
              stroke="transparent"
              style={{ cursor: isSelected ? "move" : "pointer", pointerEvents: "all" }}
              onPointerDown={handleHitPointerDown}
            />
          );
        })}
      </g>

      {selectedComponent && (() => {
        const { x, y, width, height } = selectedComponent.boundingBox;
        const handles: { id: ResizeHandle; cx: number; cy: number; cursor: string }[] = [
          { id: "nw", cx: x, cy: y, cursor: "nw-resize" },
          { id: "n", cx: x + width / 2, cy: y, cursor: "n-resize" },
          { id: "ne", cx: x + width, cy: y, cursor: "ne-resize" },
          { id: "e", cx: x + width, cy: y + height / 2, cursor: "e-resize" },
          { id: "se", cx: x + width, cy: y + height, cursor: "se-resize" },
          { id: "s", cx: x + width / 2, cy: y + height, cursor: "s-resize" },
          { id: "sw", cx: x, cy: y + height, cursor: "sw-resize" },
          { id: "w", cx: x, cy: y + height / 2, cursor: "w-resize" },
        ];

        return (
          <g className="selection-overlay-controls" style={{ pointerEvents: "all" }}>
            {handles.map((h) => (
              <rect
                key={h.id}
                x={h.cx - handleHalf}
                y={h.cy - handleHalf}
                width={handleSize}
                height={handleSize}
                rx={2 / zoom}
                fill="white"
                stroke="#2563EB"
                strokeWidth={strokeScale}
                style={{ cursor: h.cursor, pointerEvents: "all" }}
                onPointerDown={(e) => startResize(e, selectedComponent.id, h.id, selectedComponent.boundingBox)}
              />
            ))}

            <foreignObject
              x={x + width - 90 / zoom}
              y={y - 34 / zoom}
              width={100 / zoom}
              height={30 / zoom}
              style={{ pointerEvents: "all", overflow: "visible" }}
            >
              <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenAnnotation(selectedComponent.id);
                  }}
                  style={{ background: "#1f2937", color: "white", fontSize: "12px", padding: "4px 6px", borderRadius: "4px", border: "none", cursor: "pointer", lineHeight: 1 }}
                  title="Edit Annotation"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(selectedComponent.id);
                  }}
                  style={{ background: "#1f2937", color: "white", fontSize: "12px", padding: "4px 6px", borderRadius: "4px", border: "none", cursor: "pointer", lineHeight: 1 }}
                  title="Duplicate"
                >
                  ⧉
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(selectedComponent.id);
                  }}
                  style={{ background: "#dc2626", color: "white", fontSize: "12px", padding: "4px 6px", borderRadius: "4px", border: "none", cursor: "pointer", lineHeight: 1 }}
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            </foreignObject>
          </g>
        );
      })()}
    </svg>
  );
}
