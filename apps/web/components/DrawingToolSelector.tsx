"use client";

import { Pencil, Minus, Square, Eraser, Undo2, Redo2, Download } from "lucide-react";
import type { ReactNode } from "react";

export type ToolType = "pencil" | "line" | "rectangle" | "eraser";

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
  return (
    <div className="draw-toolbar-wrapper">
      {/* Main toolbar */}
      <div className="draw-tools">
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
            {i === 3 && <div className="tool-separator" />}
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
      {currentTool !== "eraser" && (
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
