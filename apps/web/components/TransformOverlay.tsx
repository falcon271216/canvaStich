import React, { useState, useCallback, useEffect } from "react";
import type { UIDetectionResult } from "@repo/pattern-detection";

interface TransformState {
  selectedId: string | null;
  isDragging: boolean;
  isResizing: boolean;
  resizeHandle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | null;
  dragStart: { x: number; y: number };
  originalBBox: { x: number; y: number; width: number; height: number } | null;
}

interface TransformOverlayProps {
  detections: (UIDetectionResult & { id: string })[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdateBBox: (id: string, newBBox: { x: number; y: number; width: number; height: number }) => void;
  onOpenAnnotation: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  canvasWidth: number;
  canvasHeight: number;
}

export function TransformOverlay({
  detections,
  selectedId,
  onSelect,
  onUpdateBBox,
  onOpenAnnotation,
  onDelete,
  onDuplicate,
  canvasWidth,
  canvasHeight
}: TransformOverlayProps) {
  const [transformState, setTransformState] = useState<TransformState>({
    selectedId: null,
    isDragging: false,
    isResizing: false,
    resizeHandle: null,
    dragStart: { x: 0, y: 0 },
    originalBBox: null,
  });

  // Sync prop with local state when it changes from outside
  useEffect(() => {
    if (selectedId !== transformState.selectedId && !transformState.isDragging && !transformState.isResizing) {
      setTransformState(prev => ({ ...prev, selectedId }));
    }
  }, [selectedId]);

  const handleGlobalMouseUp = useCallback(() => {
    if (transformState.isDragging || transformState.isResizing) {
      setTransformState(prev => ({ ...prev, isDragging: false, isResizing: false, resizeHandle: null }));
    }
  }, [transformState]);

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!transformState.selectedId || !transformState.originalBBox) return;

    if (transformState.isDragging) {
      const dx = e.clientX - transformState.dragStart.x;
      const dy = e.clientY - transformState.dragStart.y;
      
      let newX = Math.round((transformState.originalBBox.x + dx) / 8) * 8;
      let newY = Math.round((transformState.originalBBox.y + dy) / 8) * 8;

      onUpdateBBox(transformState.selectedId, {
        ...transformState.originalBBox,
        x: newX,
        y: newY,
      });
    } else if (transformState.isResizing && transformState.resizeHandle) {
      const dx = e.clientX - transformState.dragStart.x;
      const dy = e.clientY - transformState.dragStart.y;
      const orig = transformState.originalBBox;
      let newBBox = { ...orig };

      switch (transformState.resizeHandle) {
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

      onUpdateBBox(transformState.selectedId, newBBox);
    }
  }, [transformState, onUpdateBBox]);

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
    onSelect(id);
    setTransformState({
      selectedId: id,
      isDragging: true,
      isResizing: false,
      resizeHandle: null,
      dragStart: { x: e.clientX, y: e.clientY },
      originalBBox: bbox,
    });
  };

  const startResize = (e: React.MouseEvent, id: string, handle: TransformState['resizeHandle'], bbox: {x:number,y:number,width:number,height:number}) => {
    e.stopPropagation();
    onSelect(id);
    setTransformState({
      selectedId: id,
      isDragging: false,
      isResizing: true,
      resizeHandle: handle,
      dragStart: { x: e.clientX, y: e.clientY },
      originalBBox: bbox,
    });
  };

  // Only render overlay for the currently selected component
  const selectedComponent = detections.find(d => d.id === transformState.selectedId);

  return (
    <svg 
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10 }} 
      width={canvasWidth} 
      height={canvasHeight}
    >
      {selectedComponent && (
        <g className="selection-overlay" style={{ pointerEvents: "auto" }}>
          {(() => {
            const { x, y, width, height } = selectedComponent.boundingBox;
            const handles: { id: TransformState['resizeHandle'], cx: number, cy: number, cursor: string }[] = [
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
              <>
                {/* Selection border (draggable) */}
                <rect
                  x={x - 1} y={y - 1}
                  width={width + 2} height={height + 2}
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  style={{ cursor: 'move' }}
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
                    x={h.cx - 4} y={h.cy - 4}
                    width={8} height={8}
                    rx={2}
                    fill="white"
                    stroke="#2563EB"
                    strokeWidth={1.5}
                    style={{ cursor: h.cursor }}
                    onMouseDown={(e) => startResize(e, selectedComponent.id, h.id, selectedComponent.boundingBox)}
                  />
                ))}

                {/* Quick action toolbar */}
                <foreignObject x={x + width - 90} y={y - 32} width={100} height={28}>
                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onOpenAnnotation(selectedComponent.id); }}
                      style={{ background: '#1f2937', color: 'white', fontSize: '12px', padding: '4px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                      title="Edit Annotation"
                    >
                      ✏️
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDuplicate(selectedComponent.id); }}
                      style={{ background: '#1f2937', color: 'white', fontSize: '12px', padding: '4px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                      title="Duplicate"
                    >
                      ⧉
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDelete(selectedComponent.id); }}
                      style={{ background: '#dc2626', color: 'white', fontSize: '12px', padding: '4px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </foreignObject>
              </>
            );
          })()}
        </g>
      )}
    </svg>
  );
}
