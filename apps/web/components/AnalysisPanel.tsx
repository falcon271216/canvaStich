"use client";

import { useState } from "react";
import { Scan, GitBranch, Code2 } from "lucide-react";
import type { UIDetectionResult, LayoutNode, UIComponentType } from "@repo/pattern-detection";
import DetectionPanel from "./panels/DetectionPanel";
import LayoutTreePanel from "./panels/LayoutTreePanel";
import CodeExportPanel from "./panels/CodeExportPanel";

type TabId = "detection" | "tree" | "code";

interface AnalysisPanelProps {
  detections: UIDetectionResult[];
  layoutTree: LayoutNode | null;
  selectedComponentId: string | null;
  onSelectComponent: (id: string) => void;
  onUpdateNodeType: (nodeId: string, newType: UIComponentType) => void;
}

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "detection", label: "Detection", icon: <Scan size={14} /> },
  { id: "tree",      label: "Layout",    icon: <GitBranch size={14} /> },
  { id: "code",      label: "Code",      icon: <Code2 size={14} /> },
];

export default function AnalysisPanel({
  detections,
  layoutTree,
  selectedComponentId,
  onSelectComponent,
  onUpdateNodeType,
}: AnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("detection");

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
      </div>

      {/* Tab content */}
      <div className="panel-content">
        {activeTab === "detection" && (
          <DetectionPanel
            detections={detections}
            selectedId={selectedComponentId}
            onSelectComponent={onSelectComponent}
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
          <CodeExportPanel layoutTree={layoutTree} />
        )}
      </div>
    </div>
  );
}
