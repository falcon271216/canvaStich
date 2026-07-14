"use client";

import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { infiniteGridStyle } from "../lib/viewportCoords";

export interface ViewportState {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_WHEEL_FACTOR = 1.075;
/** Larger step for on-screen +/- buttons (tablet-friendly). */
const ZOOM_BUTTON_FACTOR = 1.25;

function clampZoom(z: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Place world origin (0, 0) at the center of the viewport */
function originCenteredScroll(viewportW: number, viewportH: number, zoom: number) {
  return {
    scrollX: viewportW / 2,
    scrollY: viewportH / 2,
    zoom,
  };
}

export function useBoardViewport(viewportRef: RefObject<HTMLElement | null>) {
  const [viewport, setViewport] = useState<ViewportState>({
    scrollX: 0,
    scrollY: 0,
    zoom: 1,
  });
  const [viewportSize, setViewportSize] = useState({ w: 800, h: 600 });
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  const viewportRefState = useRef(viewport);
  viewportRefState.current = viewport;

  const panSession = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollX: number;
    scrollY: number;
  } | null>(null);

  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchSession = useRef<{
    initialDist: number;
    initialZoom: number;
    originScrollX: number;
    originScrollY: number;
    originMidX: number;
    originMidY: number;
  } | null>(null);

  const hasInitialized = useRef(false);

  /* Track viewport pixel size (for canvas buffer) — do not reset pan/zoom on resize */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);
      setViewportSize({ w, h });

      if (!hasInitialized.current && w > 0 && h > 0) {
        setViewport(originCenteredScroll(w, h, 1));
        hasInitialized.current = true;
      }
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [viewportRef]);

  const zoomAt = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const el = viewportRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;

      setViewport((v) => {
        const worldX = (mx - v.scrollX) / v.zoom;
        const worldY = (my - v.scrollY) / v.zoom;
        const newZoom = clampZoom(v.zoom * factor);
        return {
          zoom: newZoom,
          scrollX: mx - worldX * newZoom,
          scrollY: my - worldY * newZoom,
        };
      });
    },
    [viewportRef],
  );

  const panBy = useCallback((dx: number, dy: number) => {
    setViewport((v) => ({
      ...v,
      scrollX: v.scrollX + dx,
      scrollY: v.scrollY + dy,
    }));
  }, []);

  const resetView = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setViewport(originCenteredScroll(rect.width, rect.height, 1));
  }, [viewportRef]);

  const zoomIn = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, ZOOM_BUTTON_FACTOR);
  }, [viewportRef, zoomAt]);

  const zoomOut = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1 / ZOOM_BUTTON_FACTOR);
  }, [viewportRef, zoomAt]);

  /* Wheel zoom/pan (desktop + ctrl+trackpad pinch) */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? ZOOM_WHEEL_FACTOR : 1 / ZOOM_WHEEL_FACTOR;
        zoomAt(e.clientX, e.clientY, factor);
      } else {
        panBy(-e.deltaX, -e.deltaY);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [viewportRef, zoomAt, panBy]);

  /* Two-finger pinch zoom + pan (tablet) */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const applyPinch = () => {
      const session = pinchSession.current;
      if (!session || activePointers.current.size < 2) return;
      const pts = [...activePointers.current.values()];
      const a = pts[0]!;
      const b = pts[1]!;
      const d = Math.max(1, dist(a, b));
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const rect = el.getBoundingClientRect();
      const mx = midX - rect.left;
      const my = midY - rect.top;
      const originMx = session.originMidX - rect.left;
      const originMy = session.originMidY - rect.top;
      const worldX = (originMx - session.originScrollX) / session.initialZoom;
      const worldY = (originMy - session.originScrollY) / session.initialZoom;
      const newZoom = clampZoom(session.initialZoom * (d / session.initialDist));
      // Anchor to current midpoint + allow finger mid drag to pan
      setViewport({
        zoom: newZoom,
        scrollX: mx - worldX * newZoom,
        scrollY: my - worldY * newZoom,
      });
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.current.size === 2) {
        const pts = [...activePointers.current.values()];
        const a = pts[0]!;
        const b = pts[1]!;
        const v = viewportRefState.current;
        pinchSession.current = {
          initialDist: Math.max(1, dist(a, b)),
          initialZoom: v.zoom,
          originScrollX: v.scrollX,
          originScrollY: v.scrollY,
          originMidX: (a.x + b.x) / 2,
          originMidY: (a.y + b.y) / 2,
        };
        setIsPanning(true);
        panSession.current = null;
        e.preventDefault();
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!activePointers.current.has(e.pointerId)) return;
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.current.size >= 2 && pinchSession.current) {
        e.preventDefault();
        applyPinch();
      }
    };

    const endPointer = (e: PointerEvent) => {
      activePointers.current.delete(e.pointerId);
      if (activePointers.current.size < 2) {
        pinchSession.current = null;
        if (!panSession.current) setIsPanning(false);
      }
    };

    el.addEventListener("pointerdown", onPointerDown, { passive: false });
    el.addEventListener("pointermove", onPointerMove, { passive: false });
    el.addEventListener("pointerup", endPointer);
    el.addEventListener("pointercancel", endPointer);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endPointer);
      el.removeEventListener("pointercancel", endPointer);
    };
  }, [viewportRef]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setIsSpaceDown(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        resetView();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        zoomIn();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault();
        zoomOut();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpaceDown(false);
        setIsPanning(false);
        panSession.current = null;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [resetView, zoomIn, zoomOut]);

  const shouldPan = useCallback(
    (e: { button: number }) => e.button === 1 || (e.button === 0 && isSpaceDown),
    [isSpaceDown],
  );

  const handleViewportPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      // Two-finger pinch is handled by native listeners above
      if (activePointers.current.size >= 2 || pinchSession.current) return;
      if (!shouldPan(e)) return;
      e.preventDefault();
      e.stopPropagation();

      panSession.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        scrollX: viewportRefState.current.scrollX,
        scrollY: viewportRefState.current.scrollY,
      };
      setIsPanning(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [shouldPan],
  );

  const handleViewportPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (pinchSession.current) return;
    const session = panSession.current;
    if (!session || session.pointerId !== e.pointerId) return;

    const dx = e.clientX - session.startX;
    const dy = e.clientY - session.startY;
    setViewport((v) => ({
      ...v,
      scrollX: session.scrollX + dx,
      scrollY: session.scrollY + dy,
    }));
  }, []);

  const handleViewportPointerUp = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (panSession.current?.pointerId === e.pointerId) {
      panSession.current = null;
      if (!pinchSession.current) setIsPanning(false);
    }
  }, []);

  const sceneStyle: CSSProperties = {
    transform: `translate(${viewport.scrollX}px, ${viewport.scrollY}px) scale(${viewport.zoom})`,
    transformOrigin: "0 0",
  };

  const gridStyle = infiniteGridStyle(viewport);

  return {
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
  };
}
