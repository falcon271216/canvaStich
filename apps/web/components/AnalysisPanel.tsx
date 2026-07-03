"use client";

import { useState, useImperativeHandle, forwardRef } from "react";
import { Scan, GitBranch, Code2, GripVertical } from "lucide-react";
import type { UIDetectionResult, LayoutNode, UIComponentType } from "@repo/pattern-detection";
import type { ComponentAnnotation } from "./AnnotationEditor";
import DetectionPanel from "./panels/DetectionPanel";
import LayoutTreePanel from "./panels/LayoutTreePanel";
import CodeExportPanel from "./panels/CodeExportPanel";

export type TabId = "detection" | "tree" | "code";

interface AnalysisPanelProps {
  detections: UIDetectionResult[];
  layoutTree: LayoutNode | null;
  selectedComponentId: string | null;
  onSelectComponent: (id: string) => void;
  onUpdateNodeType: (nodeId: string, newType: UIComponentType) => void;
  canvasWidth?: number;
  canvasHeight?: number;
  autoGenerate?: boolean;
  onGenerationComplete?: () => void;
  annotations?: Map<string, ComponentAnnotation>;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export interface AnalysisPanelHandle {
  switchToTab: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "detection", label: "Detection", icon: <Scan size={14} /> },
  { id: "tree",      label: "Layout",    icon: <GitBranch size={14} /> },
  { id: "code",      label: "Code",      icon: <Code2 size={14} /> },
];

const AnalysisPanel = forwardRef<AnalysisPanelHandle, AnalysisPanelProps>(function AnalysisPanel(
  {
    detections,
    layoutTree,
    selectedComponentId,
    onSelectComponent,
    onUpdateNodeType,
    canvasWidth,
    canvasHeight,
    autoGenerate,
    onGenerationComplete,
    annotations,
    collapsed = false,
    onToggleCollapse,
  },
  ref,
) {
  const [activeTab, setActiveTab] = useState<TabId>("detection");

  // Expose tab switching to parent (for AutoDraw Magic)
  useImperativeHandle(ref, () => ({
    switchToTab: (tab: TabId) => setActiveTab(tab),
  }));

  if (collapsed) {
    return (
      <div className="analysis-collapsed" onClick={onToggleCollapse} title="Expand panel">
        <div className="analysis-collapsed-icon">
          <GripVertical size={16} style={{ transform: "rotate(90deg)", opacity: 0.5 }} />
          <Scan size={14} style={{ marginTop: 12 }} />
          <GitBranch size={14} />
          <Code2 size={14} />
        </div>
        <div className="analysis-collapsed-label" style={{ marginTop: 8 }}>Analysis Panel</div>
      </div>
    );
  }

  return (
    <div className="analysis-panel">
      {/* Tab bar */}
      <div className="panel-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`panel-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.id === "detection" && detections.length > 0 && (
              <span className="panel-tab-count">{detections.length}</span>
            )}
          </button>
        ))}
        {onToggleCollapse && (
          <button
            className="panel-collapse-btn"
            onClick={onToggleCollapse}
            title="Collapse panel"
          >
            ›
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="panel-content">
        {activeTab === "detection" && (
          <DetectionPanel
            detections={detections}
            selectedId={selectedComponentId}
            onSelectComponent={onSelectComponent}
            onUpdateNodeType={onUpdateNodeType}
          />
        )}
        {activeTab === "tree" && (
          <LayoutTreePanel
            tree={layoutTree}
            onSelectNode={onSelectComponent}
            selectedNodeId={selectedComponentId}
            onUpdateNodeType={onUpdateNodeType}
          />
        )}
        {activeTab === "code" && (
          <CodeExportPanel
            layoutTree={layoutTree}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            autoGenerate={autoGenerate}
            onGenerationComplete={onGenerationComplete}
            annotations={annotations}
          />
        )}
      </div>
    </div>
  );
});

export default AnalysisPanel;
