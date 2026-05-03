/**
 * Anomaly detection on user-activity time series using CUSUM and Z-score.
 *
 * This module analyses the *operational* time-series data (draw events per
 * second, session activity) to detect behavioural patterns such as:
 *
 *  - **Burst detection**: sudden increase in drawing activity
 *  - **Idle detection**: abnormal pauses in an otherwise active session
 *  - **Session decay**: gradual slowdown predicting user will leave
 *  - **Changepoint detection**: moment user switches from one behaviour to another
 *
 * Algorithms used:
 *  - CUSUM (Cumulative Sum control chart) — Page, 1954
 *  - Z-score sliding window
 *
 * These work on the time-series of event rates emitted by Prometheus counters,
 * giving the Prometheus/Grafana layer genuine pattern-detection value.
 */

/* ────────────────── types ────────────────── */

export interface ActivityPoint {
  /** Timestamp (ms since epoch). */
  t: number;
  /** Metric value (e.g. events per second, or event count in a window). */
  value: number;
}

export interface AnomalyResult {
  /** Timestamp where the anomaly was detected. */
  t: number;
  /** Original metric value at this point. */
  value: number;
  /** Type of anomaly. */
  type: "burst" | "idle" | "changepoint";
  /** Severity score (higher = more anomalous). */
  severity: number;
  /** Description for the dashboard. */
  description: string;
}

export interface CusumConfig {
  /** Expected mean (target). If not set, uses the running mean. */
  target?: number;
  /** Slack parameter (allowable deviation before alarm). Default 0.5 * stddev. */
  slack?: number;
  /** Decision threshold for triggering alarm. Default 4 * stddev. */
  threshold?: number;
}

export interface SessionPattern {
  /** Overall session classification. */
  label: "active" | "declining" | "bursty" | "idle-heavy" | "short";
  /** Fraction of session spent idle (>2s gap between events). */
  idleFraction: number;
  /** Number of detected bursts. */
  burstCount: number;
  /** Trend slope (negative = declining). */
  trendSlope: number;
  /** Total duration in ms. */
  duration: number;
  /** All detected anomalies. */
  anomalies: AnomalyResult[];
}

/* ────────────────── Z-score anomaly detection ────────────────── */

/**
 * Detect anomalies in a time-series using a sliding-window Z-score.
 *
 * A point is anomalous if its Z-score (relative to the preceding window)
 * exceeds the threshold.
 *
 * @param series     Time-ordered metric values.
 * @param windowSize Number of preceding points to compute mean & stddev.
 * @param zThreshold Z-score threshold for anomaly (default 2.5).
 */
export function detectAnomaliesZScore(
  series: ActivityPoint[],
  windowSize = 20,
  zThreshold = 2.5,
): AnomalyResult[] {
  const anomalies: AnomalyResult[] = [];
  if (series.length < windowSize + 1) return anomalies;

  for (let i = windowSize; i < series.length; i++) {
    const window = series.slice(i - windowSize, i);
    const values = window.map((p) => p.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance) || 1e-9;

    const current = series[i]!;
    const z = (current.value - mean) / std;

    if (Math.abs(z) > zThreshold) {
      anomalies.push({
        t: current.t,
        value: current.value,
        type: z > 0 ? "burst" : "idle",
        severity: Math.abs(z),
        description:
          z > 0
            ? `Burst detected: activity ${(current.value).toFixed(1)} is ${Math.abs(z).toFixed(1)}σ above mean ${mean.toFixed(1)}`
            : `Idle detected: activity ${(current.value).toFixed(1)} is ${Math.abs(z).toFixed(1)}σ below mean ${mean.toFixed(1)}`,
      });
    }
  }

  return anomalies;
}

/* ────────────────── CUSUM changepoint detection ────────────────── */

/**
 * Tabular CUSUM (Cumulative Sum) for detecting upward and downward shifts
 * in a time series mean.
 *
 * The CUSUM chart accumulates small deviations from the target mean.
 * When the cumulative sum exceeds a threshold, a changepoint is signalled.
 *
 * Reference: Page, E.S. "Continuous Inspection Schemes", Biometrika, 1954.
 */
export function detectChangepointsCUSUM(
  series: ActivityPoint[],
  config?: CusumConfig,
): AnomalyResult[] {
  if (series.length < 5) return [];

  const values = series.map((p) => p.value);
  const mean = config?.target ?? values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance) || 1;

  const slack = config?.slack ?? 0.5 * std;
  const threshold = config?.threshold ?? 4 * std;

  let sHigh = 0; // cumulative sum for upward shifts
  let sLow = 0;  // cumulative sum for downward shifts
  const anomalies: AnomalyResult[] = [];

  for (let i = 0; i < series.length; i++) {
    const x = values[i]!;
    sHigh = Math.max(0, sHigh + (x - mean - slack));
    sLow = Math.max(0, sLow + (mean - slack - x));

    if (sHigh > threshold) {
      anomalies.push({
        t: series[i]!.t,
        value: x,
        type: "changepoint",
        severity: sHigh / threshold,
        description: `Upward shift detected at t=${series[i]!.t}: CUSUM=${sHigh.toFixed(1)} > threshold=${threshold.toFixed(1)}`,
      });
      sHigh = 0; // reset after alarm
    }

    if (sLow > threshold) {
      anomalies.push({
        t: series[i]!.t,
        value: x,
        type: "changepoint",
        severity: sLow / threshold,
        description: `Downward shift detected at t=${series[i]!.t}: CUSUM=${sLow.toFixed(1)} > threshold=${threshold.toFixed(1)}`,
      });
      sLow = 0;
    }
  }

  return anomalies;
}

/* ────────────────── session pattern classification ────────────────── */

/**
 * Convert a sequence of draw-event timestamps into an activity-rate time series.
 * Buckets events into fixed-width time windows and counts events per window.
 *
 * @param eventTimestamps  Array of event timestamps (ms).
 * @param bucketMs         Bucket width (default 2000ms = 2 seconds).
 */
export function eventTimesToActivitySeries(
  eventTimestamps: number[],
  bucketMs = 2000,
): ActivityPoint[] {
  if (eventTimestamps.length === 0) return [];
  const sorted = [...eventTimestamps].sort((a, b) => a - b);
  const start = sorted[0]!;
  const end = sorted[sorted.length - 1]!;
  const buckets: ActivityPoint[] = [];

  for (let t = start; t <= end + bucketMs; t += bucketMs) {
    const count = sorted.filter((ts) => ts >= t && ts < t + bucketMs).length;
    buckets.push({ t, value: count });
  }
  return buckets;
}

/**
 * Analyse a complete session's event timestamps and classify the session
 * behaviour pattern.
 */
export function analyseSession(eventTimestamps: number[]): SessionPattern {
  if (eventTimestamps.length < 2) {
    return {
      label: "short",
      idleFraction: 0,
      burstCount: 0,
      trendSlope: 0,
      duration: 0,
      anomalies: [],
    };
  }

  const sorted = [...eventTimestamps].sort((a, b) => a - b);
  const duration = sorted[sorted.length - 1]! - sorted[0]!;

  // Compute idle fraction (gaps > 2s)
  let idleTime = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i]! - sorted[i - 1]!;
    if (gap > 2000) idleTime += gap;
  }
  const idleFraction = duration > 0 ? idleTime / duration : 0;

  // Build activity series
  const activitySeries = eventTimesToActivitySeries(sorted);

  // Detect anomalies
  const zAnomalies = detectAnomaliesZScore(activitySeries, Math.min(10, Math.floor(activitySeries.length / 2)));
  const cusumAnomalies = detectChangepointsCUSUM(activitySeries);
  const allAnomalies = [...zAnomalies, ...cusumAnomalies]
    .sort((a, b) => a.t - b.t);

  const burstCount = allAnomalies.filter((a) => a.type === "burst").length;

  // Linear regression for trend slope
  const trendSlope = linearTrendSlope(activitySeries);

  // Classify
  let label: SessionPattern["label"];
  if (duration < 10000) {
    label = "short";
  } else if (burstCount >= 3) {
    label = "bursty";
  } else if (idleFraction > 0.4) {
    label = "idle-heavy";
  } else if (trendSlope < -0.001) {
    label = "declining";
  } else {
    label = "active";
  }

  return { label, idleFraction, burstCount, trendSlope, duration, anomalies: allAnomalies };
}

/* ────────────────── helpers ────────────────── */

/** Simple least-squares linear trend slope on an ActivityPoint series. */
function linearTrendSlope(series: ActivityPoint[]): number {
  const n = series.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  const t0 = series[0]!.t;
  for (const p of series) {
    const x = (p.t - t0) / 1000; // seconds
    sumX += x;
    sumY += p.value;
    sumXY += x * p.value;
    sumX2 += x * x;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-12) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}
