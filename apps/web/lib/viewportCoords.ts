import type { CSSProperties } from "react";
import type { ViewportState } from "../hooks/useBoardViewport";

export const GRID_SIZE = 20;

export function screenToWorld(
  clientX: number,
  clientY: number,
  viewportRect: DOMRect,
  viewport: Pick<ViewportState, "scrollX" | "scrollY" | "zoom">,
): { x: number; y: number } {
  return {
    x: (clientX - viewportRect.left - viewport.scrollX) / viewport.zoom,
    y: (clientY - viewportRect.top - viewport.scrollY) / viewport.zoom,
  };
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  viewport: Pick<ViewportState, "scrollX" | "scrollY" | "zoom">,
): { x: number; y: number } {
  return {
    x: worldX * viewport.zoom + viewport.scrollX,
    y: worldY * viewport.zoom + viewport.scrollY,
  };
}

export function applyCameraTransform(
  ctx: CanvasRenderingContext2D,
  viewport: Pick<ViewportState, "scrollX" | "scrollY" | "zoom">,
) {
  ctx.setTransform(viewport.zoom, 0, 0, viewport.zoom, viewport.scrollX, viewport.scrollY);
}

export function resetCameraTransform(ctx: CanvasRenderingContext2D) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

export function infiniteGridStyle(
  viewport: Pick<ViewportState, "scrollX" | "scrollY" | "zoom">,
): CSSProperties {
  const step = GRID_SIZE * viewport.zoom;
  return {
    backgroundColor: "var(--canvas-bg)",
    backgroundImage: "radial-gradient(circle, var(--canvas-dots) 1px, transparent 1px)",
    backgroundSize: `${step}px ${step}px`,
    backgroundPosition: `${viewport.scrollX}px ${viewport.scrollY}px`,
  };
}
