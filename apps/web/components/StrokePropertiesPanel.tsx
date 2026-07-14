"use client";

import { ChevronsLeft, ChevronsRight, GripVertical } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";

const STROKE_COLORS = [
  "#000000",
  "#e03131",
  "#2f9e44",
  "#1971c2",
  "#f08c00",
  "#868e96",
];

const STROKE_WIDTHS = [
  { value: 1, label: "Thin", height: 1.5 },
  { value: 2, label: "Medium", height: 2.5 },
  { value: 4, label: "Thick", height: 4 },
];

const DEFAULT_LEFT = 12;
const DEFAULT_TOP = 68; // below nav so it starts in the canvas area

interface Props {
  color: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
}

function clampToViewport(x: number, y: number, width: number, height: number) {
  const maxX = Math.max(0, window.innerWidth - width);
  const maxY = Math.max(0, window.innerHeight - height);
  return {
    x: Math.max(0, Math.min(x, maxX)),
    y: Math.max(0, Math.min(y, maxY)),
  };
}

export default function StrokePropertiesPanel({
  color,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
}: Props) {
  const knownColor = STROKE_COLORS.includes(color);
  const panelRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({
    x: DEFAULT_LEFT,
    y: DEFAULT_TOP,
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    startX: number;
    startY: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const beginDrag = (e: ReactPointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, input, label, a")) return;

    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };

    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      const rect = panelRef.current?.getBoundingClientRect();
      const next = clampToViewport(
        dragStartRef.current.startX + dx,
        dragStartRef.current.startY + dy,
        rect?.width ?? 202,
        rect?.height ?? 120,
      );
      setPosition(next);
    };

    const endDrag = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [isDragging]);

  // Keep panel on-screen when minimized/maximized size changes or window resizes
  useEffect(() => {
    const keepInView = () => {
      const rect = panelRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition((prev) =>
        clampToViewport(prev.x, prev.y, rect.width, rect.height),
      );
    };

    keepInView();
    window.addEventListener("resize", keepInView);
    return () => window.removeEventListener("resize", keepInView);
  }, [minimized]);

  const panelStyle: CSSProperties = {
    left: `${position.x}px`,
    top: `${position.y}px`,
  };

  if (!mounted) return null;

  return createPortal(
    <aside
      ref={panelRef}
      className={`stroke-props-panel${isDragging ? " is-dragging" : ""}${minimized ? " is-minimized" : ""}`}
      style={panelStyle}
      aria-label="Drawing properties"
    >
      <div className="stroke-props-header">
        <div
          className="stroke-props-drag-handle"
          onPointerDown={beginDrag}
          title="Drag to move"
        >
          <GripVertical size={14} />
          {!minimized && <span>Stroke</span>}
          {minimized && (
            <span
              className="stroke-props-mini-swatch"
              style={{ background: color }}
              title={color}
            />
          )}
        </div>
        <button
          type="button"
          className="stroke-props-toggle"
          onClick={() => setMinimized((v) => !v)}
          title={minimized ? "Maximize color palette" : "Minimize color palette"}
          aria-label={minimized ? "Maximize color palette" : "Minimize color palette"}
          aria-expanded={!minimized}
        >
          {minimized ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
        </button>
      </div>

      {!minimized && (
        <>
          <div className="stroke-props-section">
            <div className="stroke-props-swatches">
              {STROKE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`stroke-props-swatch ${color === c ? "active" : ""}`}
                  style={{ background: c }}
                  onClick={() => onColorChange(c)}
                  title={c}
                  aria-label={`Stroke color ${c}`}
                />
              ))}
              {!knownColor && (
                <button
                  type="button"
                  className="stroke-props-swatch active"
                  style={{ background: color }}
                  title={color}
                  aria-label={`Custom stroke color ${color}`}
                />
              )}
              <label className="stroke-props-custom" title="Custom color">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => onColorChange(e.target.value)}
                  aria-label="Pick custom stroke color"
                />
              </label>
            </div>
          </div>

          <div className="stroke-props-section">
            <div className="stroke-props-label">Stroke width</div>
            <div className="stroke-props-widths">
              {STROKE_WIDTHS.map((sw) => (
                <button
                  key={sw.value}
                  type="button"
                  className={`stroke-props-width-btn ${strokeWidth === sw.value ? "active" : ""}`}
                  onClick={() => onStrokeWidthChange(sw.value)}
                  title={sw.label}
                  aria-label={`Stroke width ${sw.label}`}
                >
                  <span
                    className="stroke-props-width-line"
                    style={{
                      height: sw.height,
                      background: color === "#000000" ? "currentColor" : color,
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </aside>,
    document.body,
  );
}
