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

function clampZoom(z: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
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
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, ZOOM_WHEEL_FACTOR);
  }, [viewportRef, zoomAt]);

  const zoomOut = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1 / ZOOM_WHEEL_FACTOR);
  }, [viewportRef, zoomAt]);

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
      setIsPanning(false);
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
