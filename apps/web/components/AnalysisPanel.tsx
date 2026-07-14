"use client";

import { useState, useImperativeHandle, forwardRef } from "react";
import { Scan, GitBranch, Code2, GripVertical, PanelRightClose, PanelRightOpen } from "lucide-react";
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
  width?: number;
  roomId?: string;
  lastDetectionAt?: number | null;
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
    width = 320,
    roomId,
    lastDetectionAt = null,
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
      <button
        type="button"
        className="analysis-collapsed"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleCollapse?.();
        }}
        title="Expand analysis panel"
        aria-label="Expand analysis panel"
      >
        <div className="analysis-collapsed-icon">
          <PanelRightOpen size={16} />
          <GripVertical size={14} style={{ opacity: 0.45 }} />
          <Scan size={14} />
          <GitBranch size={14} />
          <Code2 size={14} />
        </div>
        <div className="analysis-collapsed-label">Analysis</div>
      </button>
    );
  }

  return (
    <div
      className="analysis-panel"
      style={{ width, minWidth: width, flex: `0 0 ${width}px` }}
    >
      {/* Tab bar */}
      <div className="panel-tabs">
        {TABS.map((tab) => (
          <button
            type="button"
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
            type="button"
            className="panel-collapse-btn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleCollapse();
            }}
            title="Collapse panel"
            aria-label="Collapse analysis panel"
          >
            <PanelRightClose size={16} />
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
            lastUpdatedAt={lastDetectionAt}
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
            roomId={roomId}
          />
        )}
      </div>
    </div>
  );
});

export default AnalysisPanel;
