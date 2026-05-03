"use client";

import { Activity, Zap, MoveUpRight, FastForward, CheckCircle2 } from "lucide-react";

interface AnalysisData {
  detectedLabel: string;
  confidence: number;
  method: string;
  dtwDistance?: number | null;
  velocityProfile?: string | null;
  strokeDuration?: number | null;
  meanSpeed?: number | null;
  speedPeaks?: number | null;
  mlPredictions?: { className: string; probability: number }[];
}

export default function AnalysisPanel({ 
  data, 
  onBeautify 
}: { 
  data: AnalysisData | null;
  onBeautify?: () => void;
}) {
  if (!data) {
    return (
      <div className="analysis-panel empty">
        <Activity size={24} style={{ color: "var(--text-dim)", marginBottom: "1rem" }} />
        <p>Draw a shape to see real-time time-series analysis.</p>
      </div>
    );
  }

  return (
    <div className="analysis-panel">
      <div className="analysis-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Activity size={16} style={{ color: "var(--accent)" }} />
          Time-Series Analysis
        </h3>
        {onBeautify && (
          <button 
            onClick={onBeautify}
            style={{
              background: "var(--accent)",
              color: "white",
              border: "none",
              padding: "0.3rem 0.6rem",
              borderRadius: "4px",
              fontSize: "0.75rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              fontWeight: 600
            }}
          >
            ✨ Beautify
          </button>
        )}
      </div>

      <div className="analysis-content fade-in">
        <div className="analysis-card">
          <div className="analysis-card-title">Detection Result</div>
          <div className="detection-result">
            <div className="detection-icon">
              <CheckCircle2 size={24} style={{ color: "var(--success)" }} />
            </div>
            <div>
              <div className="detection-label">{data.detectedLabel}</div>
              <div className="detection-meta">
                Confidence: {(data.confidence * 100).toFixed(1)}% • {data.method === "dtw" ? "DTW" : "Geometric"}
              </div>
            </div>
          </div>
        </div>

        <div className="analysis-card">
          <div className="analysis-card-title">Stroke Kinematics</div>
          <div className="kinematics-grid">
            <div className="kinematics-item">
              <FastForward size={14} style={{ color: "var(--text-muted)" }} />
              <div>
                <div className="kinematics-value">{data.strokeDuration ? (data.strokeDuration / 1000).toFixed(2) : "--"}s</div>
                <div className="kinematics-label">Duration</div>
              </div>
            </div>
            <div className="kinematics-item">
              <MoveUpRight size={14} style={{ color: "var(--text-muted)" }} />
              <div>
                <div className="kinematics-value">{data.meanSpeed ? data.meanSpeed.toFixed(1) : "--"} px/s</div>
                <div className="kinematics-label">Mean Velocity</div>
              </div>
            </div>
            <div className="kinematics-item">
              <Zap size={14} style={{ color: "var(--text-muted)" }} />
              <div>
                <div className="kinematics-value">{data.speedPeaks ?? "--"}</div>
                <div className="kinematics-label">Velocity Peaks</div>
              </div>
            </div>
          </div>
        </div>

        {data.method === "dtw" && data.dtwDistance != null && (
          <div className="analysis-card">
            <div className="analysis-card-title">DTW Match Distance</div>
            <div className="dtw-bar-container">
              <div className="dtw-bar-label">
                <span>{data.detectedLabel} template</span>
                <span>{data.dtwDistance.toFixed(3)}</span>
              </div>
              <div className="dtw-bar-bg">
                <div 
                  className="dtw-bar-fill" 
                  style={{ width: `${Math.max(5, 100 - data.dtwDistance * 100)}%` }} 
                />
              </div>
            </div>
          </div>
        )}

        {data.velocityProfile && typeof data.velocityProfile === "string" && (
          <div className="analysis-card">
            <div className="analysis-card-title">Velocity Profile</div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Zap size={16} style={{ color: "var(--accent)" }} />
              <span style={{ textTransform: "capitalize", fontWeight: 500 }}>
                {data.velocityProfile.replace(/-/g, " ")}
              </span>
            </div>
          </div>
        )}

        {data.mlPredictions && data.mlPredictions.length > 0 && (
          <div className="analysis-card">
            <div className="analysis-card-title">Deep Learning (TFJS CNN)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {data.mlPredictions.map((pred, i) => (
                <div key={i} className="dtw-bar-container" style={{ marginTop: 0 }}>
                  <div className="dtw-bar-label">
                    <span style={{ textTransform: "capitalize", fontWeight: i === 0 ? 600 : 400, color: i === 0 ? "var(--text)" : "var(--text-muted)" }}>
                      {pred.className}
                    </span>
                    <span style={{ color: i === 0 ? "var(--text)" : "var(--text-muted)" }}>
                      {(pred.probability * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="dtw-bar-bg" style={{ height: i === 0 ? 6 : 4 }}>
                    <div 
                      className="dtw-bar-fill" 
                      style={{ 
                        width: `${pred.probability * 100}%`, 
                        background: i === 0 ? "var(--accent)" : "var(--text-muted)",
                        opacity: i === 0 ? 1 : 0.5 
                      }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
