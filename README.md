# Pattern Detection in Time Series Data

> A real-time collaborative drawing platform (Excalidraw-style) with **DTW-based shape recognition**, **velocity-profile analysis**, and **CUSUM / Z-score anomaly detection** on user-activity time series.

## Project overview

Every pencil stroke on the canvas is a **multivariate time series** — a sequence of `{x(t), y(t)}` points sampled over time. This project applies classical time-series pattern-detection algorithms to both the drawing data and the operational metrics.

### Core algorithms

| Algorithm | Purpose | Module |
|---|---|---|
| **Dynamic Time Warping (DTW)** | Compare user strokes against ideal shape templates with elastic time-warping | `dtw.ts` |
| **Sliding Window Detection** | Real-time streaming pattern detection with EMA confidence smoothing | `slidingWindow.ts` |
| **Velocity & Acceleration Analysis** | Extract kinematic features; classify velocity profiles (constant, multi-peak, slow-fast-slow) | `timeSeriesFeatures.ts` |
| **Geometric Heuristics** | Convex hull, radius variance, fill-ratio scoring (combined with DTW) | `geometricDetect.ts` |
| **CUSUM (Cumulative Sum)** | Changepoint detection in user-activity time series (Page, 1954) | `anomalyDetection.ts` |
| **Z-Score Sliding Window** | Anomaly detection for burst / idle patterns in session activity | `anomalyDetection.ts` |

## What's inside

### Apps

- **web** – Next.js drawing app: canvas (pencil, line, rectangle), real-time sync via WebSocket. Pencil strokes are **timestamped time-series data** analysed in real-time by DTW and sliding-window detectors. Auto-completed shapes (circle, rectangle, triangle, star) are rendered and broadcast.
- **http-backend** – REST API (auth, rooms, drawings, pattern-stats, session-analysis). Exposes **Prometheus** `/metrics` on port 3001.
- **ws-backend** – WebSocket server for draw events. Exposes **Prometheus** `/metrics` on port **8081** (HTTP server alongside WS on 8080).
- **dashboard** – Next.js app to **visualise** pattern-detection results, time-series charts, session behaviour analysis, and Prometheus metrics. Runs on port 3002.

### Packages

- **@repo/pattern-detection** – All pattern-detection algorithms:
  - `normalizePath.ts` – Path resampling and normalisation with timestamp interpolation
  - `dtw.ts` – DTW algorithm with Sakoe-Chiba band optimisation + ideal shape templates
  - `geometricDetect.ts` – Combined DTW + geometric heuristic detection
  - `timeSeriesFeatures.ts` – Velocity, acceleration, and kinematic feature extraction
  - `slidingWindow.ts` – Sliding-window real-time detector with EMA smoothing
  - `anomalyDetection.ts` – CUSUM and Z-score anomaly detection on activity time series
- **@repo/ui**, **@repo/common**, **@repo/db**, **@repo/backend-common**, **@repo/typescript-config**, **@repo/eslint-config** – Shared libs and config.

## Pattern detection pipeline

```
Canvas stroke {x, y, t}[]
        │
        ├─── Sliding Window (real-time) ──── DTW match → live ghost preview
        │
        └─── On mouseUp (final) ────┬──── DTW match vs templates
                                    ├──── Geometric heuristic scores
                                    ├──── Velocity profile extraction
                                    └──── Combined scoring → auto-complete
                                              │
                                    Stored in DB with full metadata:
                                    label, confidence, method, dtwDistance,
                                    velocityProfile, strokeDuration
```

## Time series and observability

- **Stroke time series**: Every point has a timestamp. Velocity, acceleration, and speed profiles are computed per-stroke.
- **Session analysis**: Draw-event timestamps are bucketed into activity-rate time series. CUSUM and Z-score detect bursts, idle periods, and changepoints.
- **Prometheus** (HTTP :3001/metrics, WS :8081/metrics): request duration, draw events by shape, active connections, active rooms.
- **Grafana**: Visualise Prometheus metrics for operational dashboarding.
- **Dashboard** (:3002): `/patterns` for DTW + velocity breakdown, `/session` for CUSUM anomaly detection, `/metrics` for Prometheus time series.

## Quick start

1. **Install and build**

   ```bash
   cd excalidraw
   pnpm install
   pnpm build
   ```

2. **Environment**

   - Create `.env` in repo root (or in apps that need it) with `DATABASE_URL` (PostgreSQL) and `JWT_SECRET`.
   - For the DB schema: `pnpm --filter @repo/db exec prisma generate` and run migrations as you do today.

3. **Run services**

   - Start **http-backend**: `pnpm --filter http-backend start` (or from `apps/http-backend`: `pnpm start`).
   - Start **ws-backend**: `pnpm --filter ws-backend start`.
   - Start **web**: `pnpm --filter web dev` (port 3000).
   - Start **dashboard**: `pnpm --filter dashboard dev` (port 3002).

4. **Prometheus + Grafana (optional)**

   ```bash
   docker compose -f docker-compose.monitoring.yml up -d
   ```

   - Prometheus: http://localhost:9090 (scrapes `host.docker.internal:3001` and `host.docker.internal:8081`).
   - Grafana: http://localhost:3003 (login `admin` / `admin`). Add Prometheus datasource URL `http://prometheus:9090`.

5. **Dashboard**

   - Open http://localhost:3002.
   - **Pattern Detection**: DTW method breakdown, velocity profiles, recent completions with full metadata.
   - **Session Analysis**: Enter a room ID to see activity-rate time series with CUSUM / Z-score anomaly markers.
   - **Time Series (Prometheus)**: Live Prometheus metrics over time.

## Build and develop

- From repo root: `pnpm build`, `pnpm dev`, `pnpm lint`, `pnpm check-types` as in the standard Turborepo setup.

## Useful links

- [Dynamic Time Warping](https://en.wikipedia.org/wiki/Dynamic_time_warping)
- [CUSUM](https://en.wikipedia.org/wiki/CUSUM)
- [Turborepo](https://turborepo.com)
- [Prometheus](https://prometheus.io)
- [Grafana](https://grafana.com)
