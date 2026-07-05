import React, { useCallback, useEffect, useRef } from "react";
import type { UIDetectionResult } from "@repo/pattern-detection";

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface TransformData {
  id: string;
  mode: 'drag' | 'resize';
  resizeHandle: ResizeHandle | null;
  startX: number;
  startY: number;
  originalBBox: { x: number; y: number; width: number; height: number };
}

interface TransformOverlayProps {
  detections: (UIDetectionResult & { id: string })[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdateBBox: (id: string, newBBox: { x: number; y: number; width: number; height: number }) => void;
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
  // Use a ref for active transform to avoid stale closure issues
  const activeTransform = useRef<TransformData | null>(null);
  const onUpdateBBoxRef = useRef(onUpdateBBox);
  onUpdateBBoxRef.current = onUpdateBBox;

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    const tf = activeTransform.current;
    if (!tf) return;

    const dx = (e.clientX - tf.startX) / zoomRef.current;
    const dy = (e.clientY - tf.startY) / zoomRef.current;
    const orig = tf.originalBBox;

    if (tf.mode === 'drag') {
      const newX = Math.round((orig.x + dx) / 8) * 8;
      const newY = Math.round((orig.y + dy) / 8) * 8;
      onUpdateBBoxRef.current(tf.id, { ...orig, x: newX, y: newY });
    } else if (tf.mode === 'resize' && tf.resizeHandle) {
      let newBBox = { ...orig };

      switch (tf.resizeHandle) {
        case 'se':
          newBBox.width  = Math.max(40, orig.width  + dx);
          newBBox.height = Math.max(40, orig.height + dy);
          break;
        case 'sw':
          newBBox.x      = Math.min(orig.x + orig.width - 40, orig.x + dx);
          newBBox.width  = Math.max(40, orig.width  - dx);
          newBBox.height = Math.max(40, orig.height + dy);
          break;
        case 'ne':
          newBBox.y      = Math.min(orig.y + orig.height - 40, orig.y + dy);
          newBBox.width  = Math.max(40, orig.width  + dx);
          newBBox.height = Math.max(40, orig.height - dy);
          break;
        case 'nw':
          newBBox.x      = Math.min(orig.x + orig.width - 40, orig.x + dx);
          newBBox.y      = Math.min(orig.y + orig.height - 40, orig.y + dy);
          newBBox.width  = Math.max(40, orig.width  - dx);
          newBBox.height = Math.max(40, orig.height - dy);
          break;
        case 'e':
          newBBox.width  = Math.max(40, orig.width  + dx);
          break;
        case 'w':
          newBBox.x      = Math.min(orig.x + orig.width - 40, orig.x + dx);
          newBBox.width  = Math.max(40, orig.width  - dx);
          break;
        case 's':
          newBBox.height = Math.max(40, orig.height + dy);
          break;
        case 'n':
          newBBox.y      = Math.min(orig.y + orig.height - 40, orig.y + dy);
          newBBox.height = Math.max(40, orig.height - dy);
          break;
      }

      // Snap to grid
      newBBox.x      = Math.round(newBBox.x / 8) * 8;
      newBBox.y      = Math.round(newBBox.y / 8) * 8;
      newBBox.width  = Math.round(newBBox.width / 8) * 8;
      newBBox.height = Math.round(newBBox.height / 8) * 8;

      onUpdateBBoxRef.current(tf.id, newBBox);
    }
  }, []);

  const handleGlobalMouseUp = useCallback(() => {
    activeTransform.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [handleGlobalMouseMove, handleGlobalMouseUp]);

  const startDrag = (e: React.MouseEvent, id: string, bbox: {x:number,y:number,width:number,height:number}) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(id);
    activeTransform.current = {
      id,
      mode: 'drag',
      resizeHandle: null,
      startX: e.clientX,
      startY: e.clientY,
      originalBBox: { ...bbox },
    };
  };

  const startResize = (e: React.MouseEvent, id: string, handle: ResizeHandle, bbox: {x:number,y:number,width:number,height:number}) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(id);
    activeTransform.current = {
      id,
      mode: 'resize',
      resizeHandle: handle,
      startX: e.clientX,
      startY: e.clientY,
      originalBBox: { ...bbox },
    };
  };

  const handleClickComponent = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(id);
  };


  const selectedComponent = detections.find(d => d.id === selectedId);

  return (
    <svg
      style={{ position: "absolute", left: 0, top: 0, width: 1, height: 1, overflow: "visible", pointerEvents: "none", zIndex: 10 }}
    >
      {/* Invisible hit-test rectangles for ALL detected components */}
      {detections.map(det => {
        const { x, y, width, height } = det.boundingBox;
        const isSelected = det.id === selectedId;
        if (isSelected) return null; // Selected component is rendered with full controls below
        return (
          <rect
            key={det.id}
            x={x} y={y}
            width={width} height={height}
            fill="transparent"
            stroke="transparent"
            strokeWidth={4}
            style={{ cursor: 'pointer', pointerEvents: 'auto' }}
            onMouseDown={(e) => handleClickComponent(e, det.id)}
          />
        );
      })}

      {/* Full controls for the selected component */}
      {selectedComponent && (() => {
        const { x, y, width, height } = selectedComponent.boundingBox;
        const handles: { id: ResizeHandle, cx: number, cy: number, cursor: string }[] = [
          { id: 'nw', cx: x,           cy: y,            cursor: 'nw-resize' },
          { id: 'n',  cx: x + width/2, cy: y,            cursor: 'n-resize'  },
          { id: 'ne', cx: x + width,   cy: y,            cursor: 'ne-resize' },
          { id: 'e',  cx: x + width,   cy: y + height/2, cursor: 'e-resize'  },
          { id: 'se', cx: x + width,   cy: y + height,   cursor: 'se-resize' },
          { id: 's',  cx: x + width/2, cy: y + height,   cursor: 's-resize'  },
          { id: 'sw', cx: x,           cy: y + height,   cursor: 'sw-resize' },
          { id: 'w',  cx: x,           cy: y + height/2, cursor: 'w-resize'  },
        ];

        return (
          <g className="selection-overlay" style={{ pointerEvents: 'auto' }}>
            {/* Draggable body */}
            <rect
              x={x} y={y}
              width={width} height={height}
              fill="rgba(37, 99, 235, 0.06)"
              stroke="#2563EB"
              strokeWidth={2}
              strokeDasharray="6 3"
              style={{ cursor: 'move', pointerEvents: 'auto' }}
              onMouseDown={(e) => startDrag(e, selectedComponent.id, selectedComponent.boundingBox)}
            />

            {/* Dimension label */}
            <text 
              x={x + width/2} y={y - 8} 
              textAnchor="middle" fontSize={10} fill="#2563EB" fontWeight="bold">
              {Math.round(width)} × {Math.round(height)}
            </text>

            {/* Resize handles */}
            {handles.map(h => (
              <rect
                key={h.id}
                x={h.cx - 5} y={h.cy - 5}
                width={10} height={10}
                rx={2}
                fill="white"
                stroke="#2563EB"
                strokeWidth={1.5}
                style={{ cursor: h.cursor, pointerEvents: 'auto' }}
                onMouseDown={(e) => startResize(e, selectedComponent.id, h.id, selectedComponent.boundingBox)}
              />
            ))}

            {/* Quick action toolbar */}
            <foreignObject x={x + width - 90} y={y - 34} width={100} height={30} style={{ pointerEvents: 'auto' }}>
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                <button 
                  onClick={(e) => { e.stopPropagation(); onOpenAnnotation(selectedComponent.id); }}
                  style={{ background: '#1f2937', color: 'white', fontSize: '12px', padding: '4px 6px', borderRadius: '4px', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                  title="Edit Annotation"
                >
                  ✏️
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDuplicate(selectedComponent.id); }}
                  style={{ background: '#1f2937', color: 'white', fontSize: '12px', padding: '4px 6px', borderRadius: '4px', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                  title="Duplicate"
                >
                  ⧉
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(selectedComponent.id); }}
                  style={{ background: '#dc2626', color: 'white', fontSize: '12px', padding: '4px 6px', borderRadius: '4px', border: 'none', cursor: 'pointer', lineHeight: 1 }}
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
