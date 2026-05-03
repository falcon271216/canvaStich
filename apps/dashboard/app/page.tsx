export default function DashboardHome() {
  return (
    <main style={{ padding: "2rem", maxWidth: 900 }}>
      <h1 style={{ marginBottom: "0.5rem", fontSize: "1.75rem" }}>
        Pattern Detection in Time Series Data
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
        A collaborative Excalidraw-style drawing platform with real-time pattern
        detection using DTW (Dynamic Time Warping), velocity-profile analysis,
        and CUSUM / Z-score anomaly detection on user-activity time series.
      </p>

      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.75rem", fontSize: "1.1rem" }}>
          🧠 Core Algorithms
        </h2>
        <ul style={{ paddingLeft: "1.25rem", color: "var(--muted)", lineHeight: 1.7 }}>
          <li>
            <strong>Dynamic Time Warping (DTW)</strong> — Canonical time-series
            pattern matching algorithm. Compares user strokes against ideal shape
            templates, allowing elastic warping so drawing speed doesn&apos;t affect
            detection.
          </li>
          <li>
            <strong>Sliding Window Detection</strong> — Real-time streaming
            analysis of the last N points using DTW with EMA confidence
            smoothing. Provides live feedback while the user is still drawing.
          </li>
          <li>
            <strong>Velocity &amp; Acceleration Analysis</strong> — Extracts
            kinematic time-series features from timestamped strokes. Classifies
            velocity profiles (constant → circle, multi-peak → rectangle).
          </li>
          <li>
            <strong>Geometric Heuristics</strong> — Convex hull, radius
            variance, fill-ratio analysis. Combined with DTW for robust
            detection.
          </li>
          <li>
            <strong>CUSUM (Cumulative Sum)</strong> — Detects changepoints in
            user-activity rate time series (Page, 1954).
          </li>
          <li>
            <strong>Z-Score Sliding Window</strong> — Identifies anomalous
            bursts and idle periods in session activity.
          </li>
        </ul>
      </section>

      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.75rem", fontSize: "1.1rem" }}>
          📊 Dashboard Pages
        </h2>
        <ul style={{ listStyle: "none", lineHeight: 2 }}>
          <li>
            <a href="/patterns"><strong>Pattern Detection</strong></a> —
            Shape distribution, detection method breakdown (DTW vs geometric vs combined),
            velocity profiles, and recent completions with full time-series metadata.
          </li>
          <li>
            <a href="/session"><strong>Session Analysis</strong></a> —
            Per-room CUSUM / Z-score anomaly detection on draw-event timestamps.
            Visualises activity-rate time series with burst/idle/changepoint markers.
          </li>
          <li>
            <a href="/metrics"><strong>Time Series (Prometheus)</strong></a> —
            Live Prometheus metrics: draw events, WS connections, HTTP request
            rates over time.
          </li>
          <li>
            <a href="/raw"><strong>Raw Metrics</strong></a> —
            Raw Prometheus text format from HTTP and WebSocket backends.
          </li>
        </ul>
      </section>

      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.75rem", fontSize: "1.1rem" }}>
          🏗️ Architecture
        </h2>
        <ul style={{ paddingLeft: "1.25rem", color: "var(--muted)", lineHeight: 1.7 }}>
          <li>
            <strong>Drawing app</strong> (Next.js) — Canvas with pencil, line,
            rectangle tools. Pencil strokes generate timestamped time-series
            data analysed in real-time.
          </li>
          <li>
            <strong>@repo/pattern-detection</strong> — Shared library:
            DTW, sliding window, velocity features, CUSUM anomaly detection,
            geometric heuristics.
          </li>
          <li>
            <strong>HTTP backend</strong> — REST API with Prometheus /metrics.
            Exposes /pattern-stats and /session-analysis endpoints.
          </li>
          <li>
            <strong>WebSocket backend</strong> — Real-time draw event broadcast
            with Prometheus metrics (connections, events, active rooms).
          </li>
          <li>
            <strong>Prometheus + Grafana</strong> — Scrapes HTTP and WS metrics
            for operational time-series dashboarding.
          </li>
        </ul>
      </section>
    </main>
  );
}
