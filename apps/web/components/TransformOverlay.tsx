import React, { useCallback, useEffect, useRef } from "react";
import type { UIDetectionResult } from "@repo/pattern-detection";

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
  detections: (UIDetectionResult & { id: string })[];
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
  zoom = 1,
}: TransformOverlayProps) {
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const activeTransform = useRef<TransformData | null>(null);
  const onUpdateBBoxRef = useRef(onUpdateBBox);
  onUpdateBBoxRef.current = onUpdateBBox;

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

  const startDrag = (e: React.PointerEvent, id: string, bbox: { x: number; y: number; width: number; height: number }) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(id);
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

  const handleClickComponent = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(id);
  };

  const selectedComponent = detections.find((d) => d.id === selectedId);
  const handleHalf = 8 / zoom;
  const handleSize = handleHalf * 2;
  const strokeScale = 1.5 / zoom;

  return (
    <svg
      className="transform-overlay-svg"
      style={{ position: "absolute", left: 0, top: 0, width: 1, height: 1, overflow: "visible", pointerEvents: "none", zIndex: 10 }}
    >
      {detections.map((det) => {
        const { x, y, width, height } = det.boundingBox;
        const isSelected = det.id === selectedId;
        if (isSelected) return null;
        return (
          <rect
            key={det.id}
            x={x}
            y={y}
            width={width}
            height={height}
            fill="transparent"
            stroke="transparent"
            strokeWidth={8 / zoom}
            style={{ cursor: "pointer", pointerEvents: "all" }}
            onPointerDown={(e) => handleClickComponent(e, det.id)}
          />
        );
      })}

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
          <g className="selection-overlay" style={{ pointerEvents: "all" }}>
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              fill="rgba(37, 99, 235, 0.06)"
              stroke="#2563EB"
              strokeWidth={strokeScale}
              strokeDasharray={`${6 / zoom} ${3 / zoom}`}
              style={{ cursor: "move", pointerEvents: "all" }}
              onPointerDown={(e) => startDrag(e, selectedComponent.id, selectedComponent.boundingBox)}
            />

            <text
              x={x + width / 2}
              y={y - 10 / zoom}
              textAnchor="middle"
              fontSize={11 / zoom}
              fill="#2563EB"
              fontWeight="bold"
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {Math.round(width)} × {Math.round(height)}
            </text>

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
