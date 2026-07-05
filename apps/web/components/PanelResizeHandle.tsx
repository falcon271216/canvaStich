"use client";

import { useCallback, useRef, useState } from "react";

interface PanelResizeHandleProps {
  /** Positive delta widens the panel on the left; negative widens the panel on the right */
  onResize: (deltaX: number) => void;
  side: "left" | "right";
}

export default function PanelResizeHandle({ onResize, side }: PanelResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const sessionRef = useRef<{ startX: number; lastX: number } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      sessionRef.current = { startX: e.clientX, lastX: e.clientX };
      setIsDragging(true);
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const session = sessionRef.current;
        if (!session) return;
        const step = ev.clientX - session.lastX;
        session.lastX = ev.clientX;
        if (step !== 0) {
          onResize(side === "left" ? step : -step);
        }
      };

      const onUp = (ev: PointerEvent) => {
        sessionRef.current = null;
        setIsDragging(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [onResize, side],
  );

  return (
    <div
      className={`panel-resize-handle panel-resize-handle--${side}${isDragging ? " is-dragging" : ""}`}
      onPointerDown={handlePointerDown}
      role="separator"
      aria-orientation="vertical"
      aria-label={side === "left" ? "Resize components panel" : "Resize analysis panel"}
      title="Drag to resize"
    />
  );
}
