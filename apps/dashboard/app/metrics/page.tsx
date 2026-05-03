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
  Legend,
} from "recharts";

const PROMETHEUS_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_PROMETHEUS_URL ?? "http://localhost:9090")
    : "";

interface SeriesPoint {
  time: string;
  [key: string]: number | string | undefined;
}

export default function MetricsPage() {
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!PROMETHEUS_URL) {
      setError("Prometheus URL not set. Set NEXT_PUBLIC_PROMETHEUS_URL or run Prometheus on localhost:9090.");
      setLoading(false);
      return;
    }
    const end = Date.now() / 1000;
    const start = end - 3600; // 1 hour
    const step = 60;

    const queries = [
      "excalidraw_draw_events_total",
      "excalidraw_ws_connections_active",
      "rate(excalidraw_http_requests_total[5m])",
    ];

    Promise.all(
      queries.map((q) =>
        fetch(
          `${PROMETHEUS_URL}/api/v1/query_range?query=${encodeURIComponent(q)}&start=${start}&end=${end}&step=${step}`
        ).then((r) => r.json())
      )
    )
      .then((results) => {
        const timeMap: Record<string, SeriesPoint> = {};
        results.forEach((res, idx) => {
          const data = res?.data?.result ?? [];
          data.forEach((r: { metric?: Record<string, string>; values?: [number, string][] }) => {
            const values = r.values ?? [];
            const label = (r.metric?.shape_type ?? r.metric?.__name__ ?? queries[idx]) as string;
            values.forEach(([t, v]) => {
              const key = new Date(t * 1000).toISOString().slice(0, 16);
              if (!timeMap[key]) timeMap[key] = { time: key };
              const num = Number(v);
              if (!Number.isNaN(num)) {
                timeMap[key][label] = num;
              }
            });
          });
        });
        const arr = Object.values(timeMap).sort(
          (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
        );
        setSeries(arr);
      })
      .catch((err) => setError(String(err.message)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main style={{ padding: "2rem" }}>
        <h1 style={{ marginBottom: "1rem" }}>Time series (Prometheus)</h1>
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </main>
    );
  }
  if (error) {
    return (
      <main style={{ padding: "2rem" }}>
        <h1 style={{ marginBottom: "1rem" }}>Time series (Prometheus)</h1>
        <div className="card" style={{ color: "#f87171" }}>
          {error}
        </div>
        <p style={{ marginTop: "1rem", color: "var(--muted)" }}>
          Run Prometheus (e.g. via docker-compose in the repo) and ensure it scrapes
          http-backend :4000/metrics and ws-backend :4004/metrics.
        </p>
      </main>
    );
  }

  const keys = series.length
    ? (Object.keys(series[0]!).filter((k) => k !== "time") as string[])
    : [];

  return (
    <main style={{ padding: "2rem" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Time series (Prometheus)</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        Draw events, WS connections, and HTTP request rate over time.
      </p>
      <div className="card" style={{ height: 400 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="time" stroke="var(--muted)" fontSize={11} />
            <YAxis stroke="var(--muted)" fontSize={11} />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              labelStyle={{ color: "var(--text)" }}
            />
            <Legend />
            {keys.map((k, i) => (
              <Line
                key={k}
                type="monotone"
                dataKey={k}
                stroke={["#3b82f6", "#22c55e", "#eab308", "#a855f7"][i % 4]}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </main>
  );
}
