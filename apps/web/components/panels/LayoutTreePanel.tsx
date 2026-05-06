"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Eye } from "lucide-react";
import type { LayoutNode, UIComponentType } from "@repo/pattern-detection";
import { UI_COMPONENT_ICONS, UI_COMPONENT_DISPLAY_NAMES, UI_COMPONENT_LABELS } from "@repo/pattern-detection";
import { getComponentColor } from "./DetectionPanel";

interface LayoutTreePanelProps {
  tree: LayoutNode | null;
  onSelectNode: (nodeId: string) => void;
  selectedNodeId: string | null;
  onUpdateNodeType: (nodeId: string, newType: UIComponentType) => void;
}

export default function LayoutTreePanel({
  tree,
  onSelectNode,
  selectedNodeId,
  onUpdateNodeType,
}: LayoutTreePanelProps) {
  if (!tree) {
    return (
      <div className="tree-empty">
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
          No layout tree yet. Draw multiple components to see the hierarchy.
        </p>
      </div>
    );
  }

  return (
    <div className="tree-container">
      <div className="tree-header-info">
        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
          Click a node to highlight on canvas • Use dropdown to change type
        </span>
      </div>
      <TreeNodeView
        node={tree}
        depth={0}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
        onUpdateNodeType={onUpdateNodeType}
      />
    </div>
  );
}

function TreeNodeView({
  node,
  depth,
  selectedNodeId,
  onSelectNode,
  onUpdateNodeType,
}: {
  node: LayoutNode;
  depth: number;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onUpdateNodeType: (id: string, type: UIComponentType) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editingType, setEditingType] = useState(false);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedNodeId === node.id;
  const icon = UI_COMPONENT_ICONS[node.component.type] || '📦';
  const name = UI_COMPONENT_DISPLAY_NAMES[node.component.type] || node.component.type;
  const color = getComponentColor(node.component.type);
  const layoutDir = node.layoutHints.isRow ? 'Row' : 'Col';

  return (
    <div className="tree-node-wrapper" style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
      {depth > 0 && <div className="tree-connector" />}

      <div
        className={`tree-node ${isSelected ? 'tree-node-selected' : ''}`}
        style={{ borderLeftColor: color }}
      >
        <div className="tree-node-header" onClick={() => onSelectNode(node.id)}>
          {/* Expand/collapse toggle */}
          {hasChildren ? (
            <button
              className="tree-toggle"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span style={{ width: 20 }} />
          )}

          {/* Component icon + name */}
          <span className="tree-node-icon">{icon}</span>

          {editingType ? (
            <select
              className="tree-type-select"
              value={node.component.type}
              onChange={(e) => {
                onUpdateNodeType(node.id, e.target.value as UIComponentType);
                setEditingType(false);
              }}
              onBlur={() => setEditingType(false)}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            >
              {UI_COMPONENT_LABELS.map((label) => (
                <option key={label} value={label}>
                  {UI_COMPONENT_ICONS[label]} {UI_COMPONENT_DISPLAY_NAMES[label]}
                </option>
              ))}
            </select>
          ) : (
            <span
              className="tree-node-label"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingType(true);
              }}
              title="Double-click to change type"
            >
              {name}
            </span>
          )}

          {/* Confidence badge */}
          <span className="tree-confidence" style={{ color }}>
            {(node.component.confidence * 100).toFixed(0)}%
          </span>

          {/* Layout direction indicator */}
          {hasChildren && (
            <span className="tree-layout-badge">
              {layoutDir} · gap {node.layoutHints.gap}
            </span>
          )}

          {/* Highlight button */}
          <button
            className="tree-highlight-btn"
            onClick={(e) => {
              e.stopPropagation();
              onSelectNode(node.id);
            }}
            title="Highlight on canvas"
          >
            <Eye size={12} />
          </button>
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNodeView
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
              onUpdateNodeType={onUpdateNodeType}
            />
          ))}
        </div>
      )}
    </div>
  );
}
