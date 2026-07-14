"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, ScanSearch, Zap } from "lucide-react";
import type { UIDetectionResult, UIComponentType } from "@repo/pattern-detection";
import { UI_COMPONENT_ICONS, UI_COMPONENT_DISPLAY_NAMES, UI_COMPONENT_LABELS } from "@repo/pattern-detection";
import { COMPOSITE_DISPLAY_NAMES } from "../../lib/wireframeGroups";

interface DetectionPanelProps {
  detections: (UIDetectionResult & {
    id?: string;
    hidden?: boolean;
    compositeType?: string;
    drawOrder?: number;
  })[];
  selectedId: string | null;
  onSelectComponent: (id: string) => void;
  onUpdateNodeType?: (id: string, newType: UIComponentType) => void;
  lastUpdatedAt?: number | null;
}

const COMPONENT_COLORS: Record<string, string> = {
  button: "#3b82f6",
  input_field: "#10b981",
  checkbox: "#f59e0b",
  radio: "#8b5cf6",
  dropdown: "#ec4899",
  card: "#06b6d4",
  navbar: "#f97316",
  modal: "#6366f1",
  text_label: "#84cc16",
  image_placeholder: "#14b8a6",
  table: "#e11d48",
  divider: "#78716c",
  arrow_connector: "#a855f7",
  container_box: "#0ea5e9",
  avatar: "#f472b6",
  search_bar: "#34d399",
  rating: "#fbbf24",
  testimonial: "#a78bfa",
  list: "#38bdf8",
  feature_grid: "#fb923c",
  nav_menu: "#c084fc",
  notification_bell: "#fcd34d",
};

export function getComponentColor(type: string): string {
  return COMPONENT_COLORS[type] || "#6366f1";
}

function formatRelativeTime(ts: number, now: number): string {
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleString();
}

function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function DetectionPanel({
  detections,
  selectedId,
  onSelectComponent,
  onUpdateNodeType,
  lastUpdatedAt = null,
}: DetectionPanelProps) {
  const visibleDetections = detections.filter((d) => !d.hidden);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!lastUpdatedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [lastUpdatedAt]);

  const stats = useMemo(() => {
    const palette = visibleDetections.filter((d) => d.source === "palette").length;
    const ensemble = visibleDetections.length - palette;
    const avgConfidence =
      visibleDetections.length === 0
        ? 0
        : visibleDetections.reduce((sum, d) => sum + (d.confidence || 0), 0) / visibleDetections.length;
    return { palette, ensemble, avgConfidence };
  }, [visibleDetections]);

  const sorted = useMemo(
    () =>
      [...visibleDetections].sort((a, b) => {
        // Newest drawn first
        const orderDiff = (b.drawOrder ?? 0) - (a.drawOrder ?? 0);
        if (orderDiff !== 0) return orderDiff;
        return (b.confidence || 0) - (a.confidence || 0);
      }),
    [visibleDetections],
  );

  const uncertain = visibleDetections.filter((c) => c.source === "freehand" && c.confidence < 0.6);

  const header = lastUpdatedAt ? (
    <div className="detection-meta">
      <div className="detection-meta-row">
        <span className="detection-meta-live">
          <span className="detection-meta-pulse" />
          Live
        </span>
        <span className="detection-meta-update">
          <Clock3 size={13} />
          Last update {formatRelativeTime(lastUpdatedAt, now)}
        </span>
      </div>
      <div className="detection-meta-time">{formatClock(lastUpdatedAt)}</div>
      <div className="detection-meta-stats">
        <span>{visibleDetections.length} found</span>
        <span>{stats.ensemble} sketch</span>
        <span>{stats.palette} palette</span>
        <span>{Math.round(stats.avgConfidence * 100)}% avg</span>
      </div>
    </div>
  ) : null;

  if (visibleDetections.length === 0) {
    return (
      <div className="detection-panel-root">
        {header}
        <div className="detection-empty">
          <Zap size={20} style={{ color: "var(--text-dim)", marginBottom: "0.5rem" }} />
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Draw UI components to see real-time detection.
          </p>
          <p style={{ color: "var(--text-dim)", fontSize: "0.75rem", marginTop: "0.25rem" }}>
            Try sketching a button, input field, or card...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="detection-panel-root">
      {header ?? (
        <div className="detection-meta">
          <div className="detection-meta-row">
            <span className="detection-meta-live">
              <ScanSearch size={13} />
              Detection
            </span>
          </div>
        </div>
      )}

      {uncertain.length > 0 && (
        <div className="detection-review">
          <div className="detection-review-title">
            <AlertTriangle size={14} />
            {uncertain.length} need review
          </div>
          {uncertain.map((c) => (
            <div key={c.id} className="detection-review-row">
              <span>
                {UI_COMPONENT_DISPLAY_NAMES[c.type] || c.type} ({Math.round(c.confidence * 100)}%)
              </span>
              <select
                value={c.type}
                onChange={(e) => onUpdateNodeType?.(c.id!, e.target.value as UIComponentType)}
                onClick={(e) => e.stopPropagation()}
              >
                {UI_COMPONENT_LABELS.map((t) => (
                  <option key={t} value={t}>
                    {UI_COMPONENT_DISPLAY_NAMES[t] || t}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      <div className="detection-list">
        {sorted.map((det, idx) => {
          const icon = UI_COMPONENT_ICONS[det.type] || "📦";
          const name = det.compositeType
            ? (COMPOSITE_DISPLAY_NAMES[det.compositeType] ?? det.compositeType.replace(/_/g, " "))
            : (UI_COMPONENT_DISPLAY_NAMES[det.type] || det.type);
          const color = getComponentColor(det.type);
          const isSelected = selectedId === det.id;
          const isPalette = det.source === "palette";
          const pct = Math.round((det.confidence || 0) * 100);

          return (
            <button
              key={det.id || idx}
              type="button"
              className={`detection-card ${isSelected ? "selected" : ""}`}
              onClick={() => onSelectComponent(det.id || String(idx))}
              style={{ ["--det-accent" as string]: color }}
            >
              <div className="detection-card-top">
                <span className="detection-card-icon" aria-hidden>
                  {icon}
                </span>
                <div className="detection-card-main">
                  <div className="detection-card-title-row">
                    <span className="detection-card-name">{name}</span>
                    <span className={`detection-chip ${isPalette ? "palette" : "ensemble"}`}>
                      {isPalette ? (
                        <>
                          <CheckCircle2 size={11} /> Palette
                        </>
                      ) : (
                        <>Ensemble</>
                      )}
                    </span>
                  </div>
                  <div className="detection-card-meta">
                    <span>{isPalette ? "Confirmed drop" : "Sketch AI match"}</span>
                    <span className="detection-card-pct">{isPalette ? "100%" : `${pct}%`}</span>
                  </div>
                </div>
              </div>

              <div className="detection-card-bar">
                <div
                  className="detection-card-bar-fill"
                  style={{ width: `${isPalette ? 100 : pct}%`, background: color }}
                />
              </div>

              {!isPalette && det.allScores.length > 1 && (
                <div className="detection-card-alts">
                  {det.allScores.slice(1, 3).map((alt, i) => (
                    <span key={i} className="detection-alt">
                      {UI_COMPONENT_ICONS[alt.type] || "?"} {Math.round(alt.score * 100)}%
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="detection-summary">
        <span>
          {visibleDetections.length} component{visibleDetections.length !== 1 ? "s" : ""} detected
        </span>
      </div>
    </div>
  );
}
