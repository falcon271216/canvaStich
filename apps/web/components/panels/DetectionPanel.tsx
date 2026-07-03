"use client";

import { Zap, AlertTriangle } from "lucide-react";
import type { UIDetectionResult, UIComponentType } from "@repo/pattern-detection";
import { UI_COMPONENT_ICONS, UI_COMPONENT_DISPLAY_NAMES, UI_COMPONENT_LABELS } from "@repo/pattern-detection";

interface DetectionPanelProps {
  detections: (UIDetectionResult & { id?: string })[];
  selectedId: string | null;
  onSelectComponent: (id: string) => void;
  onUpdateNodeType?: (id: string, newType: UIComponentType) => void;
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

export default function DetectionPanel({ detections, selectedId, onSelectComponent, onUpdateNodeType }: DetectionPanelProps) {
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

  const uncertain = detections.filter(c => c.source === 'freehand' && c.confidence < 0.6);

  return (
    <div className="detection-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {uncertain.length > 0 && (
        <div style={{
          background: 'rgba(249, 115, 22, 0.1)',
          border: '1px solid rgba(249, 115, 22, 0.3)',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '8px'
        }}>
          <div style={{ color: '#fb923c', fontSize: '12px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={14} />
            {uncertain.length} components need review
          </div>
          {uncertain.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontSize: '12px', color: '#d4d4d8' }}>
                {UI_COMPONENT_DISPLAY_NAMES[c.type] || c.type} ({Math.round(c.confidence * 100)}%)
              </span>
              <select
                value={c.type}
                onChange={e => onUpdateNodeType?.(c.id!, e.target.value as UIComponentType)}
                style={{
                  fontSize: '11px',
                  background: '#27272a',
                  color: '#fff',
                  borderRadius: '4px',
                  padding: '2px 4px',
                  border: '1px solid #f97316'
                }}
              >
                {UI_COMPONENT_LABELS.map(t => (
                  <option key={t} value={t}>{UI_COMPONENT_DISPLAY_NAMES[t] || t}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {detections.map((det, idx) => {
        const icon = UI_COMPONENT_ICONS[det.type] || '📦';
        const name = UI_COMPONENT_DISPLAY_NAMES[det.type] || det.type;
        const color = getComponentColor(det.type);
        const isSelected = selectedId === det.id;

        const isPalette = det.source === 'palette';
        const badgeColor = isPalette ? '#16a34a' : (det.confidence > 0.75 ? '#2563eb' : '#f97316');

        return (
          <div
            key={det.id || idx}
            className={`detection-item ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelectComponent(det.id || String(idx))}
            style={{ borderLeftColor: color }}
          >
            <div className="detection-item-header">
              <span className="detection-item-icon">{icon}</span>
              <div className="detection-item-info">
                <span className="detection-item-label">{name}</span>
                <span className="detection-item-method">{isPalette ? 'Palette' : det.method}</span>
              </div>
              <div 
                className="detection-item-confidence" 
                style={{ 
                  background: badgeColor, 
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: '999px',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {isPalette ? '✓' : `${(det.confidence * 100).toFixed(0)}%`}
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
