/**
 * Time-series feature extraction from timestamped drawing strokes.
 *
 * Each stroke is a multivariate time series  {x(t), y(t)}.
 * This module derives kinematic features — velocity, acceleration,
 * curvature — that serve as secondary signals for pattern detection.
 *
 * These features are used for:
 *  1. Enriching DTW matching with velocity profile similarity
 *  2. Detecting drawing behaviour patterns (hesitation, bursts)
 *  3. Feeding the anomaly-detection / CUSUM layer
 */

import type { Point } from "./normalizePath.js";

/* ────────────────────── data structures ──────────────────────────── */

export interface VelocityPoint {
  /** Time (ms) relative to stroke start. */
  t: number;
  /** Instantaneous speed in px/ms. */
  speed: number;
  /** Velocity x-component. */
  vx: number;
  /** Velocity y-component. */
  vy: number;
}

export interface AccelerationPoint {
  /** Time (ms) relative to stroke start. */
  t: number;
  /** Instantaneous acceleration magnitude in px/ms². */
  magnitude: number;
  ax: number;
  ay: number;
}

export interface StrokeFeatures {
  /** Total duration in ms. */
  duration: number;
  /** Total path length in px. */
  pathLength: number;
  /** Mean drawing speed px/ms. */
  meanSpeed: number;
  /** Maximum instantaneous speed. */
  maxSpeed: number;
  /** Standard deviation of speed (jitter indicator). */
  speedStdDev: number;
  /** Speed coefficient of variation (stddev / mean). */
  speedCV: number;
  /** Number of speed peaks detected (inflection points — proxy for corners). */
  speedPeaks: number;
  /** Full velocity time-series. */
  velocitySeries: VelocityPoint[];
  /** Full acceleration time-series. */
  accelerationSeries: AccelerationPoint[];
  /** Velocity profile pattern label (constant / slow-fast-slow / burst). */
  velocityProfile: "constant" | "slow-fast-slow" | "multi-peak" | "burst" | "unknown";
}

/* ──────────────────── implementation ─────────────────────────────── */

/**
 * Compute the instantaneous velocity time-series from a timestamped stroke.
 * Uses finite differences:  v(i) = (p[i+1] - p[i]) / (t[i+1] - t[i]).
 */
export function computeVelocity(path: Point[]): VelocityPoint[] {
  if (path.length < 2) return [];
  const t0 = path[0]!.t ?? 0;
  const result: VelocityPoint[] = [];

  for (let i = 0; i < path.length - 1; i++) {
    const p0 = path[i]!;
    const p1 = path[i + 1]!;
    const dt = ((p1.t ?? 0) - (p0.t ?? 0)) || 1; // prevent /0
    const vx = (p1.x - p0.x) / dt;
    const vy = (p1.y - p0.y) / dt;
    const speed = Math.hypot(vx, vy);
    result.push({ t: (p0.t ?? 0) - t0, speed, vx, vy });
  }
  return result;
}

/**
 * Compute the instantaneous acceleration time-series from velocity.
 */
export function computeAcceleration(velocity: VelocityPoint[]): AccelerationPoint[] {
  if (velocity.length < 2) return [];
  const result: AccelerationPoint[] = [];

  for (let i = 0; i < velocity.length - 1; i++) {
    const v0 = velocity[i]!;
    const v1 = velocity[i + 1]!;
    const dt = (v1.t - v0.t) || 1;
    const ax = (v1.vx - v0.vx) / dt;
    const ay = (v1.vy - v0.vy) / dt;
    const magnitude = Math.hypot(ax, ay);
    result.push({ t: v0.t, magnitude, ax, ay });
  }
  return result;
}

/**
 * Detect peaks (local maxima) in a 1-D signal.
 * A point is a peak if signal[i] > signal[i-1] and signal[i] > signal[i+1].
 */
function countPeaks(signal: number[], minProminence: number): number {
  if (signal.length < 3) return 0;
  let peaks = 0;
  const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
  for (let i = 1; i < signal.length - 1; i++) {
    if (
      signal[i]! > signal[i - 1]! &&
      signal[i]! > signal[i + 1]! &&
      signal[i]! > mean + minProminence
    ) {
      peaks++;
    }
  }
  return peaks;
}

/**
 * Classify the velocity profile of a stroke into one of several categories.
 * This helps distinguish shape types (circles have ~constant velocity,
 * rectangles have multi-peak velocity, lines have slow-fast-slow).
 */
function classifyVelocityProfile(
  velocitySeries: VelocityPoint[],
  speedPeaks: number,
  speedCV: number,
): StrokeFeatures["velocityProfile"] {
  if (velocitySeries.length < 3) return "unknown";

  // Constant velocity → circle or smooth curve
  if (speedCV < 0.25) return "constant";

  // Single symmetric hump → line gesture (slow start, fast middle, slow end)
  if (speedPeaks <= 1 && speedCV < 0.5) return "slow-fast-slow";

  // Multiple peaks → rectangle (corners cause speed dips & re-accelerations)
  if (speedPeaks >= 3) return "multi-peak";

  // Very high variability with few peaks → burst drawing
  if (speedCV > 0.6 && speedPeaks <= 2) return "burst";

  return "unknown";
}

/**
 * Extract all time-series features from a timestamped stroke.
 */
export function extractStrokeFeatures(path: Point[]): StrokeFeatures {
  const velocitySeries = computeVelocity(path);
  const accelerationSeries = computeAcceleration(velocitySeries);

  const speeds = velocitySeries.map((v) => v.speed);
  const duration =
    path.length >= 2 ? ((path[path.length - 1]!.t ?? 0) - (path[0]!.t ?? 0)) : 0;
  let pathLength = 0;
  for (let i = 0; i < path.length - 1; i++) {
    pathLength += Math.hypot(
      path[i + 1]!.x - path[i]!.x,
      path[i + 1]!.y - path[i]!.y,
    );
  }
  const meanSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
  const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;
  const variance =
    speeds.length > 1
      ? speeds.reduce((s, v) => s + (v - meanSpeed) ** 2, 0) / (speeds.length - 1)
      : 0;
  const speedStdDev = Math.sqrt(variance);
  const speedCV = meanSpeed > 0 ? speedStdDev / meanSpeed : 0;
  const speedPeaks = countPeaks(speeds, speedStdDev * 0.3);
  const velocityProfile = classifyVelocityProfile(velocitySeries, speedPeaks, speedCV);

  return {
    duration,
    pathLength,
    meanSpeed,
    maxSpeed,
    speedStdDev,
    speedCV,
    speedPeaks,
    velocitySeries,
    accelerationSeries,
    velocityProfile,
  };
}
