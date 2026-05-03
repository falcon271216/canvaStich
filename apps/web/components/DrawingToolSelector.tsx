"use client";

import { Pencil, Minus, Square, Eraser } from "lucide-react";
import type { ReactNode } from "react";

export type ToolType = "pencil" | "line" | "rectangle" | "eraser";

interface Props {
  currentTool: ToolType;
  setToolAction: (tool: ToolType) => void;
}

const tools: { type: ToolType; icon: ReactNode; title: string }[] = [
  { type: "pencil", icon: <Pencil size={18} />, title: "Pencil – DTW pattern detection" },
  { type: "line", icon: <Minus size={18} />, title: "Line" },
  { type: "rectangle", icon: <Square size={18} />, title: "Rectangle" },
  { type: "eraser", icon: <Eraser size={18} />, title: "Eraser" },
];

export default function DrawingToolSelector({ currentTool, setToolAction }: Props) {
  return (
    <div className="draw-tools">
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
    </div>
  );
}
