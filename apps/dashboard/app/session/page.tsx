"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";

const HTTP_API =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_HTTP_API ?? "http://localhost:3001")
    : "";

interface SessionData {
  roomId: number;
  session: {
    label: string;
    idleFraction: number;
    burstCount: number;
    trendSlope: number;
    duration: number;
    anomalies: {
      t: number;
      value: number;
      type: string;
      severity: number;
      description: string;
    }[];
  } | null;
  activitySeries: { t: number; value: number }[];
}

export default function SessionAnalysisPage() {
  const [roomId, setRoomId] = useState("1");
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = () => {
    const id = Number(roomId);
    if (isNaN(id) || id <= 0) return;
    setLoading(true);
    setError(null);
    fetch(`${HTTP_API}/session-analysis/${id}`)
      .then((r) => r.json())
      .then(setData)
      .catch((err) => setError(String(err.message)))
      .finally(() => setLoading(false));
  };

  return (
    <main style={{ padding: "2rem" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Session Behaviour Analysis</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        Anomaly detection on user-activity time series using{" "}
        <strong>CUSUM</strong> (Cumulative Sum) and <strong>Z-score</strong>{" "}
        sliding window. Detects bursts, idle periods, and session behaviour patterns.
      </p>

      {/* Room selector */}
      <div className="card" style={{ marginBottom: "1.5rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <label style={{ fontSize: "0.9rem", color: "var(--muted)" }}>Room ID:</label>
        <input
          type="number"
          min="1"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          style={{ width: 120, padding: "0.4rem 0.6rem", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg)", color: "var(--text)" }}
        />
        <button
          onClick={fetchSession}
          style={{
            padding: "0.4rem 1rem",
            background: "var(--accent)",
            color: "#fff",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
          }}
        >
          Analyse
        </button>
      </div>

      {loading && <p style={{ color: "var(--muted)" }}>Analysing session…</p>}
      {error && <div className="card" style={{ color: "#f87171" }}>{error}</div>}

      {data && data.session && (
        <>
          {/* Session summary card */}
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ marginBottom: "0.75rem", fontSize: "1rem" }}>Session Summary</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Pattern</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>
                  <span style={{
                    padding: "0.2rem 0.6rem",
                    borderRadius: "999px",
                    fontSize: "0.85rem",
                    background:
                      data.session.label === "active" ? "rgba(34,197,94,0.15)" :
                      data.session.label === "bursty" ? "rgba(249,115,22,0.15)" :
                      data.session.label === "declining" ? "rgba(239,68,68,0.15)" :
                      "rgba(99,102,241,0.15)",
                    color:
                      data.session.label === "active" ? "#22c55e" :
                      data.session.label === "bursty" ? "#f97316" :
                      data.session.label === "declining" ? "#ef4444" :
                      "#6366f1",
                  }}>
                    {data.session.label}
                  </span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Duration</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{(data.session.duration / 1000).toFixed(1)}s</div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Idle fraction</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{(data.session.idleFraction * 100).toFixed(0)}%</div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Bursts</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{data.session.burstCount}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Trend slope</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 600, color: data.session.trendSlope < 0 ? "#ef4444" : "#22c55e" }}>
                  {data.session.trendSlope > 0 ? "+" : ""}{data.session.trendSlope.toFixed(4)}/s
                </div>
              </div>
            </div>
          </div>

          {/* Activity time series chart */}
          {data.activitySeries.length > 0 && (
            <div className="card" style={{ marginBottom: "1.5rem", height: 380 }}>
              <h2 style={{ marginBottom: "0.5rem", fontSize: "1rem" }}>Activity Rate Time Series</h2>
              <p style={{ color: "var(--muted)", fontSize: "0.8rem", marginBottom: "0.75rem" }}>
                Draw events per 2-second bucket. Red markers = anomalies detected by CUSUM / Z-score.
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart
                  data={data.activitySeries.map((p, i) => ({
                    idx: i,
                    time: new Date(p.t).toLocaleTimeString(),
                    value: p.value,
                  }))}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="time" stroke="var(--muted)" fontSize={10} />
                  <YAxis stroke="var(--muted)" fontSize={11} label={{ value: "events/2s", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "var(--muted)" } }} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
                  <Line type="monotone" dataKey="value" stroke="#6366f1" dot={false} strokeWidth={2} name="Activity" />
                  {/* Mark anomalies as reference lines */}
                  {data.session!.anomalies.map((a, i) => {
                    const idx = data.activitySeries.findIndex((p) => p.t >= a.t);
                    if (idx < 0) return null;
                    return (
                      <ReferenceLine
                        key={i}
                        x={new Date(data.activitySeries[idx]!.t).toLocaleTimeString()}
                        stroke={a.type === "burst" ? "#f97316" : a.type === "idle" ? "#ef4444" : "#a855f7"}
                        strokeDasharray="4 2"
                        label={{ value: a.type, position: "top", fill: a.type === "burst" ? "#f97316" : "#ef4444", fontSize: 9 }}
                      />
                    );
                  })}
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Anomalies table */}
          {data.session.anomalies.length > 0 && (
            <div className="card">
              <h2 style={{ marginBottom: "0.75rem", fontSize: "1rem" }}>
                Detected Anomalies ({data.session.anomalies.length})
              </h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                      <th style={{ padding: "0.5rem" }}>Type</th>
                      <th style={{ padding: "0.5rem" }}>Severity</th>
                      <th style={{ padding: "0.5rem" }}>Value</th>
                      <th style={{ padding: "0.5rem" }}>Description</th>
                      <th style={{ padding: "0.5rem" }}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.session.anomalies.map((a, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "0.5rem" }}>
                          <span style={{
                            padding: "0.15rem 0.5rem",
                            borderRadius: "999px",
                            fontSize: "0.75rem",
                            background:
                              a.type === "burst" ? "rgba(249,115,22,0.15)" :
                              a.type === "idle" ? "rgba(239,68,68,0.15)" :
                              "rgba(168,85,247,0.15)",
                            color:
                              a.type === "burst" ? "#f97316" :
                              a.type === "idle" ? "#ef4444" :
                              "#a855f7",
                          }}>
                            {a.type}
                          </span>
                        </td>
                        <td style={{ padding: "0.5rem" }}>{a.severity.toFixed(2)}</td>
                        <td style={{ padding: "0.5rem" }}>{a.value}</td>
                        <td style={{ padding: "0.5rem", color: "var(--muted)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis" }}>{a.description}</td>
                        <td style={{ padding: "0.5rem", color: "var(--muted)" }}>{new Date(a.t).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {data && !data.session && (
        <div className="card" style={{ color: "var(--muted)" }}>
          No events found for room {data.roomId}. Draw something in this room first.
        </div>
      )}
    </main>
  );
}
