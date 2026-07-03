"use client";

import { Pencil, Minus, Square, Eraser, Undo2, Redo2, Download, GripVertical, MousePointer } from "lucide-react";
import { type ReactNode, useState, useRef, useEffect } from "react";

export type ToolType = "select" | "pencil" | "line" | "rectangle" | "eraser";

interface Props {
  currentTool: ToolType;
  setToolAction: (tool: ToolType) => void;
  color: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExport: () => void;
}

const COLORS = [
  "#000000", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#3b82f6", "#6366f1", "#a855f7", "#ec4899",
];

const STROKE_WIDTHS = [
  { value: 1, label: "S", size: 4 },
  { value: 2, label: "M", size: 8 },
  { value: 4, label: "L", size: 12 },
];

const tools: { type: ToolType; icon: ReactNode; title: string }[] = [
  { type: "select", icon: <MousePointer size={18} />, title: "Select / Move tool" },
  { type: "pencil", icon: <Pencil size={18} />, title: "Pencil – DTW pattern detection" },
  { type: "line", icon: <Minus size={18} />, title: "Line" },
  { type: "rectangle", icon: <Square size={18} />, title: "Rectangle" },
  { type: "eraser", icon: <Eraser size={18} />, title: "Eraser" },
];

export default function DrawingToolSelector({
  currentTool,
  setToolAction,
  color,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExport,
}: Props) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only trigger drag if clicked on the handle, or on the toolbar background (not on buttons or selects)
    if ((e.target as HTMLElement).closest('button')) return;
    
    setIsDragging(true);
    
    let startX = position?.x ?? 0;
    let startY = position?.y ?? 0;
    
    if (!position && toolbarRef.current) {
      const rect = toolbarRef.current.getBoundingClientRect();
      const parentRect = toolbarRef.current.parentElement?.getBoundingClientRect();
      startX = rect.left - (parentRect?.left || 0);
      startY = rect.top - (parentRect?.top || 0);
      setPosition({ x: startX, y: startY });
    }
    
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX,
      startY
    };
    
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      
      let nextX = dragStartRef.current.startX + dx;
      let nextY = dragStartRef.current.startY + dy;
      
      if (toolbarRef.current && toolbarRef.current.parentElement) {
        const parentRect = toolbarRef.current.parentElement.getBoundingClientRect();
        const rect = toolbarRef.current.getBoundingClientRect();
        
        nextX = Math.max(0, Math.min(nextX, parentRect.width - rect.width));
        nextY = Math.max(0, Math.min(nextY, parentRect.height - rect.height));
      }
      
      setPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const wrapperStyle: React.CSSProperties = position
    ? {
        position: "absolute",
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "none",
      }
    : {};

  return (
    <div
      ref={toolbarRef}
      className="draw-toolbar-wrapper"
      style={wrapperStyle}
    >
      {/* Main toolbar */}
      <div className="draw-tools">
        {/* Grip Drag Handle */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            cursor: "move",
            display: "flex",
            alignItems: "center",
            padding: "0 6px",
            color: "var(--text-muted)",
          }}
          title="Drag to move toolbar"
        >
          <GripVertical size={14} style={{ opacity: 0.5 }} />
        </div>

        <div className="tool-separator" style={{ margin: "0 2px 0 0" }} />
        {/* Undo / Redo */}
        <button
          type="button"
          title="Undo (Ctrl+Z)"
          onClick={onUndo}
          disabled={!canUndo}
          className={!canUndo ? "disabled" : ""}
        >
          <Undo2 size={18} />
        </button>
        <button
          type="button"
          title="Redo (Ctrl+Y)"
          onClick={onRedo}
          disabled={!canRedo}
          className={!canRedo ? "disabled" : ""}
        >
          <Redo2 size={18} />
        </button>

        <div className="tool-separator" />

        {/* Drawing tools */}
        {tools.map((tool, i) => (
          <div key={tool.type} style={{ display: "contents" }}>
            {i === 1 && <div className="tool-separator" />}
            {i === 4 && <div className="tool-separator" />}
            <button
              type="button"
              title={tool.title}
              onClick={() => setToolAction(tool.type)}
              className={currentTool === tool.type ? "active" : ""}
            >
              {tool.icon}
            </button>
          </div>
        ))}

        <div className="tool-separator" />

        {/* Export */}
        <button type="button" title="Export as PNG" onClick={onExport}>
          <Download size={18} />
        </button>
      </div>

      {/* Properties bar – colors + stroke width */}
      {currentTool !== "eraser" && currentTool !== "select" && (
        <div className="draw-props-bar">
          <div className="color-swatches">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`color-swatch ${color === c ? "active" : ""}`}
                style={{ background: c }}
                onClick={() => onColorChange(c)}
                title={c}
              />
            ))}
          </div>

          <div className="stroke-width-group">
            {STROKE_WIDTHS.map((sw) => (
              <button
                key={sw.value}
                className={`stroke-width-btn ${strokeWidth === sw.value ? "active" : ""}`}
                onClick={() => onStrokeWidthChange(sw.value)}
                title={`Stroke: ${sw.label}`}
              >
                <span
                  className="stroke-width-dot"
                  style={{
                    width: sw.size,
                    height: sw.size,
                    background: color,
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
