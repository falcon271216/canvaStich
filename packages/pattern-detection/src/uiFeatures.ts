/**
 * Feature extraction pipeline for UI component classification.
 *
 * Extracts a fixed-length feature vector from one or more strokes,
 * combining geometric, kinematic, and structural descriptors. This
 * vector feeds the heuristic classifier and (optionally) a CNN.
 */

import type { Point } from "./normalizePath.js";
import { boundingBox } from "./normalizePath.js";
import { computeVelocity } from "./timeSeriesFeatures.js";

/* ────────────────────── types ────────────────────── */

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StrokeFeatureVector {
  /* ── Geometric (from bounding box) ── */
  /** width / height (clamped to avoid Infinity). */
  aspectRatio: number;
  /** bbox area / canvasArea. */
  normalizedArea: number;
  /** polygon area / bbox area — how "filled" the bbox is. */
  rectangularity: number;

  /* ── Kinematic (time-series derived) ── */
  meanVelocity: number;
  velocityStdDev: number;
  /** Number of local maxima in the speed profile. */
  peakVelocityCount: number;
  /** Total duration of all strokes in ms. */
  durationMs: number;

  /* ── Structural ── */
  /** Number of separate strokes in this component group. */
  strokeCount: number;
  /** Number of significant direction reversals. */
  directionChanges: number;
  /** How close end point is to start point (0 = open, 1 = closed). */
  closureScore: number;

  /* ── Shape descriptors ── */
  /** 16-bin normalised curvature histogram. */
  curvatureProfile: number[];
  /** 16-bin normalised velocity histogram. */
  velocityProfile: number[];
}

/* ────────────────────── helpers ────────────────────── */

function computePolygonArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length - 1; i++) {
    area += points[i]!.x * points[i + 1]!.y - points[i + 1]!.x * points[i]!.y;
  }
  return Math.abs(area) / 2;
}

function countDirectionChanges(points: Point[], threshold = 30): number {
  if (points.length < 3) return 0;
  let changes = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const dx1 = points[i]!.x - points[i - 1]!.x;
    const dy1 = points[i]!.y - points[i - 1]!.y;
    const dx2 = points[i + 1]!.x - points[i]!.x;
    const dy2 = points[i + 1]!.y - points[i]!.y;
    const angle1 = Math.atan2(dy1, dx1);
    const angle2 = Math.atan2(dy2, dx2);
    let diff = Math.abs(angle2 - angle1) * (180 / Math.PI);
    if (diff > 180) diff = 360 - diff;
    if (diff > threshold) changes++;
  }
  return changes;
}

function computeCurvature(points: Point[]): number[] {
  const curvatures: number[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i - 1]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const dx1 = p1.x - p0.x;
    const dy1 = p1.y - p0.y;
    const dx2 = p2.x - p1.x;
    const dy2 = p2.y - p1.y;
    const cross = dx1 * dy2 - dy1 * dx2;
    const l1 = Math.hypot(dx1, dy1);
    const l2 = Math.hypot(dx2, dy2);
    const denom = l1 * l2;
    curvatures.push(denom > 0 ? Math.abs(cross / denom) : 0);
  }
  return curvatures;
}

function buildHistogram(values: number[], bins: number): number[] {
  if (values.length === 0) return new Array(bins).fill(0);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const hist = new Array(bins).fill(0) as number[];
  for (const v of values) {
    const bin = Math.min(Math.floor(((v - min) / range) * bins), bins - 1);
    hist[bin]!++;
  }
  // Normalise to sum = 1
  const total = values.length;
  for (let i = 0; i < bins; i++) {
    hist[i] = hist[i]! / total;
  }
  return hist;
}

function countSpeedPeaks(speeds: number[], minProminence: number): number {
  if (speeds.length < 3) return 0;
  let peaks = 0;
  const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  for (let i = 1; i < speeds.length - 1; i++) {
    if (
      speeds[i]! > speeds[i - 1]! &&
      speeds[i]! > speeds[i + 1]! &&
      speeds[i]! > mean + minProminence
    ) {
      peaks++;
    }
  }
  return peaks;
}

/* ────────────────────── main extraction ────────────────────── */

/**
 * Extract a feature vector from one or more strokes.
 *
 * @param strokes  Array of point arrays (one per stroke).
 * @param canvasArea  Total canvas area (width × height) for normalisation.
 */
export function extractUIFeatures(
  strokes: Point[][],
  canvasArea: number,
): StrokeFeatureVector {
  const allPoints = strokes.flat();
  if (allPoints.length < 2) {
    return emptyFeatures(strokes.length);
  }

  // ── Geometric ──
  const bbox = boundingBox(allPoints);
  const w = bbox.maxX - bbox.minX;
  const h = bbox.maxY - bbox.minY;
  const aspectRatio = h > 0 ? w / h : w > 0 ? 100 : 1;
  const bboxArea = w * h;
  const normalizedArea = canvasArea > 0 ? bboxArea / canvasArea : 0;
  const polyArea = computePolygonArea(allPoints);
  const rectangularity = bboxArea > 0 ? polyArea / bboxArea : 0;

  // ── Kinematic ──
  const velocitySeries = computeVelocity(allPoints);
  const speeds = velocitySeries.map((v) => v.speed);
  const meanVelocity =
    speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
  const variance =
    speeds.length > 1
      ? speeds.reduce((s, v) => s + (v - meanVelocity) ** 2, 0) / (speeds.length - 1)
      : 0;
  const velocityStdDev = Math.sqrt(variance);
  const peakVelocityCount = countSpeedPeaks(speeds, velocityStdDev * 0.3);

  // Duration: sum of each stroke's duration
  let durationMs = 0;
  for (const stroke of strokes) {
    if (stroke.length >= 2) {
      const t0 = stroke[0]!.t ?? 0;
      const t1 = stroke[stroke.length - 1]!.t ?? 0;
      durationMs += t1 - t0;
    }
  }

  // ── Structural ──
  const strokeCount = strokes.length;
  const directionChanges = countDirectionChanges(allPoints);

  // Closure: distance between first and last point / max(w, h)
  const first = allPoints[0]!;
  const last = allPoints[allPoints.length - 1]!;
  const closeDist = Math.hypot(last.x - first.x, last.y - first.y);
  const maxDim = Math.max(w, h, 1);
  const closureScore = Math.max(0, 1 - closeDist / maxDim);

  // ── Shape descriptors ──
  const curvatures = computeCurvature(allPoints);
  const curvatureProfile = buildHistogram(curvatures, 16);
  const velProfile = buildHistogram(speeds, 16);

  return {
    aspectRatio,
    normalizedArea,
    rectangularity,
    meanVelocity,
    velocityStdDev,
    peakVelocityCount,
    durationMs,
    strokeCount,
    directionChanges,
    closureScore,
    curvatureProfile,
    velocityProfile: velProfile,
  };
}

function emptyFeatures(strokeCount: number): StrokeFeatureVector {
  return {
    aspectRatio: 1,
    normalizedArea: 0,
    rectangularity: 0,
    meanVelocity: 0,
    velocityStdDev: 0,
    peakVelocityCount: 0,
    durationMs: 0,
    strokeCount,
    directionChanges: 0,
    closureScore: 0,
    curvatureProfile: new Array(16).fill(0),
    velocityProfile: new Array(16).fill(0),
  };
}
