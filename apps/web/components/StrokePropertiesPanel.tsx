"use client";

import { GripVertical } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

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

interface Props {
  color: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
}

export default function StrokePropertiesPanel({
  color,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
}: Props) {
  const knownColor = STROKE_COLORS.includes(color);
  const panelRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const beginDrag = (e: ReactPointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, input, label, a")) return;

    setIsDragging(true);

    let startX = position?.x ?? 12;
    let startY = position?.y ?? 12;

    if (!position && panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      const parentRect = panelRef.current.parentElement?.getBoundingClientRect();
      startX = rect.left - (parentRect?.left || 0);
      startY = rect.top - (parentRect?.top || 0);
      setPosition({ x: startX, y: startY });
    }

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX,
      startY,
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

      let nextX = dragStartRef.current.startX + dx;
      let nextY = dragStartRef.current.startY + dy;

      if (panelRef.current?.parentElement) {
        const parentRect = panelRef.current.parentElement.getBoundingClientRect();
        const rect = panelRef.current.getBoundingClientRect();
        nextX = Math.max(0, Math.min(nextX, parentRect.width - rect.width));
        nextY = Math.max(0, Math.min(nextY, parentRect.height - rect.height));
      }

      setPosition({ x: nextX, y: nextY });
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

  const panelStyle: CSSProperties = position
    ? { left: `${position.x}px`, top: `${position.y}px` }
    : undefined;

  return (
    <aside
      ref={panelRef}
      className={`stroke-props-panel${isDragging ? " is-dragging" : ""}`}
      style={panelStyle}
      aria-label="Drawing properties"
    >
      <div
        className="stroke-props-drag-handle"
        onPointerDown={beginDrag}
        title="Drag to move"
      >
        <GripVertical size={14} />
        <span>Stroke</span>
      </div>

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
    </aside>
  );
}
