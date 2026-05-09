"use client";

import { Zap } from "lucide-react";
import type { UIDetectionResult } from "@repo/pattern-detection";
import { UI_COMPONENT_ICONS, UI_COMPONENT_DISPLAY_NAMES } from "@repo/pattern-detection";

interface DetectionPanelProps {
  detections: UIDetectionResult[];
  selectedId: string | null;
  onSelectComponent: (id: string) => void;
}

/** Color palette for bounding box overlays (14 distinct hues). */
const COMPONENT_COLORS: Record<string, string> = {
  button:            '#3b82f6',
  input_field:       '#10b981',
  checkbox:          '#f59e0b',
  radio:             '#8b5cf6',
  dropdown:          '#ec4899',
  card:              '#06b6d4',
  navbar:            '#f97316',
  modal:             '#6366f1',
  text_label:        '#84cc16',
  image_placeholder: '#14b8a6',
  table:             '#e11d48',
  divider:           '#78716c',
  arrow_connector:   '#a855f7',
  container_box:     '#0ea5e9',
  // v2 wireframe symbols
  avatar:            '#f472b6',
  search_bar:        '#34d399',
  rating:            '#fbbf24',
  testimonial:       '#a78bfa',
  list:              '#38bdf8',
  feature_grid:      '#fb923c',
  nav_menu:          '#c084fc',
  notification_bell: '#fcd34d',
};

export function getComponentColor(type: string): string {
  return COMPONENT_COLORS[type] || '#6366f1';
}

export default function DetectionPanel({ detections, selectedId, onSelectComponent }: DetectionPanelProps) {
  if (detections.length === 0) {
    return (
      <div className="detection-empty">
        <Zap size={20} style={{ color: "var(--text-dim)", marginBottom: "0.5rem" }} />
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
          Draw UI components to see real-time detection.
        </p>
        <p style={{ color: "var(--text-dim)", fontSize: "0.75rem", marginTop: "0.25rem" }}>
          Try sketching a button, input field, or card...
        </p>
      </div>
    );
  }

  return (
    <div className="detection-list">
      {detections.map((det, idx) => {
        const icon = UI_COMPONENT_ICONS[det.type] || '📦';
        const name = UI_COMPONENT_DISPLAY_NAMES[det.type] || det.type;
        const color = getComponentColor(det.type);
        const isSelected = selectedId === (det as any).id;

        return (
          <div
            key={(det as any).id || idx}
            className={`detection-item ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelectComponent((det as any).id || String(idx))}
            style={{ borderLeftColor: color }}
          >
            <div className="detection-item-header">
              <span className="detection-item-icon">{icon}</span>
              <div className="detection-item-info">
                <span className="detection-item-label">{name}</span>
                <span className="detection-item-method">{det.method}</span>
              </div>
              <div className="detection-item-confidence" style={{ color }}>
                {(det.confidence * 100).toFixed(0)}%
              </div>
            </div>

            {/* Confidence bar */}
            <div className="detection-item-bar-bg">
              <div
                className="detection-item-bar-fill"
                style={{ width: `${det.confidence * 100}%`, background: color }}
              />
            </div>

            {/* Top alternative scores */}
            {det.allScores.length > 1 && (
              <div className="detection-item-alternatives">
                {det.allScores.slice(1, 3).map((alt, i) => (
                  <span key={i} className="detection-alt">
                    {UI_COMPONENT_ICONS[alt.type] || '?'} {(alt.score * 100).toFixed(0)}%
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="detection-summary">
        <span>{detections.length} component{detections.length !== 1 ? 's' : ''} detected</span>
      </div>
    </div>
  );
}
