"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const HTTP_API =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_HTTP_API ?? "http://localhost:3001")
    : "";

interface PatternStats {
  byLabel: Record<string, number>;
  byMethod: Record<string, number>;
  byVelocityProfile: Record<string, number>;
  recent: {
    id: number;
    roomId: number;
    detectedLabel: string;
    confidence: number;
    method: string;
    dtwDistance: number | null;
    velocityProfile: string | null;
    strokeDuration: number | null;
    createdAt: string;
  }[];
}

const COLORS = ["#6366f1", "#22c55e", "#eab308", "#ef4444", "#a855f7", "#3b82f6", "#f97316"];

export default function PatternsPage() {
  const [stats, setStats] = useState<PatternStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${HTTP_API}/pattern-stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch((err) => setError(String(err.message)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main style={{ padding: "2rem" }}>
        <h1 style={{ marginBottom: "1rem" }}>Pattern Detection Analysis</h1>
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </main>
    );
  }
  if (error || !stats) {
    return (
      <main style={{ padding: "2rem" }}>
        <h1 style={{ marginBottom: "1rem" }}>Pattern Detection Analysis</h1>
        <div className="card" style={{ color: "#f87171" }}>
          {error ?? "No data"}
        </div>
      </main>
    );
  }

  const barData = Object.entries(stats.byLabel).map(([label, count]) => ({ label, count }));
  const methodData = Object.entries(stats.byMethod ?? {}).map(([method, count]) => ({ name: method, value: count }));
  const vpData = Object.entries(stats.byVelocityProfile ?? {}).map(([profile, count]) => ({ name: profile, value: count }));

  return (
    <main style={{ padding: "2rem" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Pattern Detection Analysis</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        Time-series pattern detection using <strong>DTW</strong> (Dynamic Time Warping),
        geometric heuristics, and velocity-profile analysis on pencil strokes.
      </p>

      {/* Shape distribution bar chart */}
      <div className="card" style={{ marginBottom: "1.5rem", height: 320 }}>
        <h2 style={{ marginBottom: "1rem", fontSize: "1rem" }}>Detected shapes (by label)</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={barData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="label" stroke="var(--muted)" fontSize={11} />
            <YAxis stroke="var(--muted)" fontSize={11} />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            />
            <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detection method & velocity profile pie charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
        <div className="card" style={{ height: 320 }}>
          <h2 style={{ marginBottom: "0.75rem", fontSize: "1rem" }}>Detection method</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.8rem", marginBottom: "0.5rem" }}>
            How each shape was detected: geometric heuristics, DTW time-series matching, or combined.
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={methodData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                {methodData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ height: 320 }}>
          <h2 style={{ marginBottom: "0.75rem", fontSize: "1rem" }}>Velocity profile</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.8rem", marginBottom: "0.5rem" }}>
            Time-series velocity patterns: constant (circle), multi-peak (rectangle corners), slow-fast-slow (line).
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={vpData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                {vpData.map((_, i) => (
                  <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent completions table with DTW data */}
      <div className="card">
        <h2 style={{ marginBottom: "0.75rem", fontSize: "1rem" }}>Recent completions</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "0.5rem" }}>ID</th>
                <th style={{ padding: "0.5rem" }}>Room</th>
                <th style={{ padding: "0.5rem" }}>Detected</th>
                <th style={{ padding: "0.5rem" }}>Confidence</th>
                <th style={{ padding: "0.5rem" }}>Method</th>
                <th style={{ padding: "0.5rem" }}>DTW Dist</th>
                <th style={{ padding: "0.5rem" }}>Velocity</th>
                <th style={{ padding: "0.5rem" }}>Duration</th>
                <th style={{ padding: "0.5rem" }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.5rem" }}>{r.id}</td>
                  <td style={{ padding: "0.5rem" }}>{r.roomId}</td>
                  <td style={{ padding: "0.5rem" }}>{r.detectedLabel}</td>
                  <td style={{ padding: "0.5rem" }}>{(r.confidence * 100).toFixed(0)}%</td>
                  <td style={{ padding: "0.5rem" }}>
                    <span
                      style={{
                        padding: "0.15rem 0.5rem",
                        borderRadius: "999px",
                        fontSize: "0.75rem",
                        background:
                          r.method === "dtw" ? "rgba(34,197,94,0.15)" :
                          r.method === "combined" ? "rgba(99,102,241,0.15)" :
                          "rgba(234,179,8,0.15)",
                        color:
                          r.method === "dtw" ? "#22c55e" :
                          r.method === "combined" ? "#6366f1" :
                          "#eab308",
                      }}
                    >
                      {r.method}
                    </span>
                  </td>
                  <td style={{ padding: "0.5rem", color: "var(--muted)" }}>
                    {r.dtwDistance != null ? r.dtwDistance.toFixed(2) : "—"}
                  </td>
                  <td style={{ padding: "0.5rem", color: "var(--muted)" }}>
                    {r.velocityProfile ?? "—"}
                  </td>
                  <td style={{ padding: "0.5rem", color: "var(--muted)" }}>
                    {r.strokeDuration != null ? `${r.strokeDuration.toFixed(0)}ms` : "—"}
                  </td>
                  <td style={{ padding: "0.5rem", color: "var(--muted)" }}>{r.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
