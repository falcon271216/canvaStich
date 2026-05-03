"use client";

import { useEffect, useState } from "react";

const HTTP_API =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_HTTP_API ?? "http://localhost:4000")
    : "";
const WS_METRICS =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_WS_METRICS ?? "http://localhost:4004")
    : "";

export default function RawMetricsPage() {
  const [http, setHttp] = useState("");
  const [ws, setWs] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${HTTP_API}/metrics`).then((r) => r.text()).catch(() => "Failed to fetch"),
      fetch(`${WS_METRICS}/metrics`).then((r) => r.text()).catch(() => "Failed to fetch"),
    ]).then(([a, b]) => {
      setHttp(a);
      setWs(b);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <main style={{ padding: "2rem" }}>
        <h1 style={{ marginBottom: "1rem" }}>Raw metrics</h1>
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Raw metrics</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        Prometheus text format from HTTP and WS backends.
      </p>
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.5rem", fontSize: "1rem" }}>HTTP backend ( :4000/metrics )</h2>
        <pre
          style={{
            overflow: "auto",
            maxHeight: 320,
            fontSize: "0.75rem",
            color: "var(--muted)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {http}
        </pre>
      </div>
      <div className="card">
        <h2 style={{ marginBottom: "0.5rem", fontSize: "1rem" }}>WS backend ( :4004/metrics )</h2>
        <pre
          style={{
            overflow: "auto",
            maxHeight: 320,
            fontSize: "0.75rem",
            color: "var(--muted)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {ws}
        </pre>
      </div>
    </main>
  );
}
