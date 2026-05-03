import type { Point } from "./normalizePath.js";
import { boundingBox, normalizePath, resamplePath } from "./normalizePath.js";
import { matchShapeDTW, type DtwMatchResult } from "./dtw.js";
import { extractStrokeFeatures, type StrokeFeatures } from "./timeSeriesFeatures.js";

export type DetectedShape =
  | "circle"
  | "rectangle"
  | "triangle"
  | "line"
  | "arrow"
  | "star"
  | "apple"
  | "unknown";

export interface DetectionResult {
  label: DetectedShape;
  confidence: number;
  /** Bounds in original canvas coords for drawing completion */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Optional completion shape data for the canvas */
  completion?: CompletionShapeData;
  /** DTW match details (null when DTW was not run, e.g. too few points). */
  dtwMatch?: DtwMatchResult;
  /** All DTW template results sorted by distance. */
  dtwAllMatches?: DtwMatchResult[];
  /** Time-series kinematic features extracted from the stroke. */
  strokeFeatures?: StrokeFeatures;
  /** Which algorithm produced the final label: "geometric", "dtw", or "combined". */
  method: "geometric" | "dtw" | "combined";
}

export type CompletionShapeData =
  | { type: "circle"; cx: number; cy: number; r: number; stroke?: string }
  | { type: "rectangle"; x: number; y: number; w: number; h: number; stroke?: string }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; stroke?: string }
  | { type: "path"; path: Point[]; stroke?: string }
  | { type: "triangle"; x1: number; y1: number; x2: number; y2: number; x3: number; y3: number; stroke?: string }
  | { type: "star"; cx: number; cy: number; r: number; stroke?: string }
  | { type: "apple"; cx: number; cy: number; r: number; stroke?: string };

const NORM_SIZE = 64;
const NORM_POINTS = 64;

/**
 * Detect geometric shape from a pencil path using a **combined** approach:
 *
 *  1. **Geometric heuristics** (legacy) — fast, uses convex hull, radius variance, etc.
 *  2. **Dynamic Time Warping (DTW)** — canonical time-series algorithm that compares
 *     the normalised stroke against ideal shape templates.
 *  3. **Time-series feature extraction** — velocity, acceleration, speed profile.
 *
 * The final label is determined by combining geometric and DTW scores.
 * When they agree the confidence is boosted; when they disagree the higher-
 * confidence signal wins.
 */
export function detectShape(path: Point[]): DetectionResult {
  const bounds = boundingBox(path);
  if (path.length < 3) {
    return { label: "unknown", confidence: 0, bounds, method: "geometric" };
  }

  const normalized = normalizePath(path, NORM_POINTS, NORM_SIZE);

  /* ────── 1. Geometric heuristic scores (original approach) ────── */
  const geoCandidates: { label: DetectedShape; confidence: number }[] = [];

  const lineScore = scoreLine(normalized);
  if (lineScore > 0.5) geoCandidates.push({ label: "line", confidence: lineScore });

  const circleScore = scoreCircle(normalized);
  if (circleScore > 0.5) geoCandidates.push({ label: "circle", confidence: circleScore });

  const rectScore = scoreRectangle(normalized);
  if (rectScore > 0.5) geoCandidates.push({ label: "rectangle", confidence: rectScore });

  const triangleScore = scoreTriangle(normalized);
  if (triangleScore > 0.5) geoCandidates.push({ label: "triangle", confidence: triangleScore });

  const starScore = scoreStar(normalized);
  if (starScore > 0.5) geoCandidates.push({ label: "star", confidence: starScore });

  const appleScore = scoreApple(normalized);
  if (appleScore > 0.5) geoCandidates.push({ label: "apple", confidence: appleScore });

  geoCandidates.sort((a, b) => b.confidence - a.confidence);
  const geoBest = geoCandidates[0] ?? null;

  /* ────── 2. DTW-based time-series matching ────── */
  const dtwMatches = matchShapeDTW(normalized);
  const dtwBest = dtwMatches[0] ?? null;

  /* ────── 3. Time-series feature extraction ────── */
  const strokeFeatures = path.some((p) => p.t != null) ? extractStrokeFeatures(path) : undefined;

  /* ────── 4. Combine scores ────── */
  let finalLabel: DetectedShape = "unknown";
  let finalConfidence = 0;
  let method: DetectionResult["method"] = "geometric";

  if (geoBest && dtwBest) {
    // Map DTW label to DetectedShape (they should match except "apple")
    const dtwLabel = dtwBest.label as DetectedShape;

    if (geoBest.label === dtwLabel) {
      // Both agree → boost confidence (geometric 40% + DTW 60%)
      finalLabel = geoBest.label;
      finalConfidence = geoBest.confidence * 0.4 + dtwBest.confidence * 0.6;
      method = "combined";
    } else {
      // Disagree → pick the one with higher confidence
      if (dtwBest.confidence > geoBest.confidence) {
        finalLabel = dtwLabel;
        finalConfidence = dtwBest.confidence;
        method = "dtw";
      } else {
        finalLabel = geoBest.label;
        finalConfidence = geoBest.confidence;
        method = "geometric";
      }
    }
  } else if (dtwBest && dtwBest.confidence > 0.4) {
    finalLabel = dtwBest.label as DetectedShape;
    finalConfidence = dtwBest.confidence;
    method = "dtw";
  } else if (geoBest) {
    finalLabel = geoBest.label;
    finalConfidence = geoBest.confidence;
    method = "geometric";
  }

  // Velocity profile can provide a small confidence nudge
  if (strokeFeatures && finalLabel !== "unknown") {
    const profileBoost = velocityProfileBoost(finalLabel, strokeFeatures.velocityProfile);
    finalConfidence = Math.min(1, finalConfidence + profileBoost);
  }

  if (finalLabel === "unknown") {
    return {
      label: "unknown",
      confidence: 0,
      bounds,
      dtwMatch: dtwBest ?? undefined,
      dtwAllMatches: dtwMatches,
      strokeFeatures,
      method,
    };
  }

  const completion = getCompletionShape(finalLabel, bounds, path);
  return {
    label: finalLabel,
    confidence: finalConfidence,
    bounds,
    completion,
    dtwMatch: dtwBest ?? undefined,
    dtwAllMatches: dtwMatches,
    strokeFeatures,
    method,
  };
}

/**
 * Give a small confidence bonus when the velocity profile matches what we
 * expect for the detected shape.
 */
function velocityProfileBoost(
  shape: DetectedShape,
  profile: StrokeFeatures["velocityProfile"],
): number {
  switch (shape) {
    case "circle":
      return profile === "constant" ? 0.05 : 0;
    case "line":
      return profile === "slow-fast-slow" ? 0.05 : 0;
    case "rectangle":
      return profile === "multi-peak" ? 0.05 : 0;
    case "triangle":
      return profile === "multi-peak" ? 0.03 : 0;
    default:
      return 0;
  }
}

/* ────── legacy geometric scoring functions (unchanged) ────── */

function scoreLine(path: Point[]): number {
  const n = path.length;
  const first = path[0]!;
  const last = path[n - 1]!;
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const lineLen = Math.hypot(dx, dy);
  if (lineLen < 5) return 0;
  let totalDist = 0;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const px = first.x + dx * t;
    const py = first.y + dy * t;
    totalDist += Math.hypot(path[i]!.x - px, path[i]!.y - py);
  }
  const avgDist = totalDist / n;
  const pathLen = pathLength(path);
  const straightness = 1 - Math.min(avgDist / (lineLen * 0.3), 1);
  const lengthRatio = lineLen / pathLen;
  const goodLength = lengthRatio > 0.7 && lengthRatio < 1.4;
  return (straightness * 0.7 + (goodLength ? 0.3 : 0)) * (lengthRatio > 0.5 ? 1 : 0.5);
}

function pathLength(path: Point[]): number {
  let len = 0;
  for (let i = 0; i < path.length - 1; i++) {
    len += Math.hypot(path[i + 1]!.x - path[i]!.x, path[i + 1]!.y - path[i]!.y);
  }
  return len;
}

function scoreCircle(path: Point[]): number {
  const n = path.length;
  let cx = 0, cy = 0;
  for (const p of path) {
    cx += p.x;
    cy += p.y;
  }
  cx /= n;
  cy /= n;
  let sumR = 0;
  let sumR2 = 0;
  for (const p of path) {
    const r = Math.hypot(p.x - cx, p.y - cy);
    sumR += r;
    sumR2 += r * r;
  }
  const meanR = sumR / n;
  const variance = sumR2 / n - meanR * meanR;
  const stdR = Math.sqrt(Math.max(0, variance));
  const closure = Math.hypot(path[n - 1]!.x - path[0]!.x, path[n - 1]!.y - path[0]!.y);
  const isClosed = closure < meanR * 0.5;
  const roundness = 1 - Math.min(stdR / (meanR || 1), 1);
  return (roundness * 0.7 + (isClosed ? 0.3 : 0)) * (meanR > 3 ? 1 : 0.3);
}

function scoreRectangle(path: Point[]): number {
  const hull = convexHull(path);
  if (hull.length < 4) return 0;
  const b = boundingBox(path);
  const area = (b.maxX - b.minX) * (b.maxY - b.minY);
  if (area < 20) return 0;
  let pathArea = 0;
  for (let i = 0; i < path.length - 1; i++) {
    pathArea += path[i]!.x * path[i + 1]!.y - path[i + 1]!.x * path[i]!.y;
  }
  pathArea = Math.abs(pathArea) / 2;
  const fillRatio = pathArea / area;
  const rectLike = fillRatio > 0.4 && fillRatio < 1.2;
  const fourCorners = hull.length >= 4 && hull.length <= 6;
  return (rectLike ? 0.6 : 0.2) + (fourCorners ? 0.3 : 0);
}

function scoreTriangle(path: Point[]): number {
  const hull = convexHull(path);
  if (hull.length < 3 || hull.length > 5) return 0;
  const b = boundingBox(path);
  const area = (b.maxX - b.minX) * (b.maxY - b.minY);
  if (area < 15) return 0;
  let pathArea = 0;
  for (let i = 0; i < path.length - 1; i++) {
    pathArea += path[i]!.x * path[i + 1]!.y - path[i + 1]!.x * path[i]!.y;
  }
  pathArea = Math.abs(pathArea) / 2;
  const fillRatio = pathArea / area;
  return (fillRatio > 0.3 && hull.length >= 3 ? 0.7 : 0.2);
}

function scoreStar(path: Point[]): number {
  const hull = convexHull(path);
  const n = path.length;
  if (n < 8 || hull.length < 5) return 0;
  const b = boundingBox(path);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const peaks: number[] = [];
  const r = Math.max(b.maxX - b.minX, b.maxY - b.minY) / 2;
  for (let i = 0; i < n; i++) {
    const d = Math.hypot(path[i]!.x - cx, path[i]!.y - cy);
    if (d > r * 0.6) peaks.push(i);
  }
  if (peaks.length >= 4 && peaks.length <= 8) return 0.6;
  return 0.2;
}

function scoreApple(path: Point[]): number {
  const circScore = scoreCircle(path);
  const b = boundingBox(path);
  const h = b.maxY - b.minY;
  const w = b.maxX - b.minX;
  const isRoundish = w > 0 && h / w < 1.5 && h / w > 0.6;
  if (circScore > 0.5 && isRoundish) return Math.min(circScore + 0.15, 0.85);
  return 0.2;
}

function convexHull(path: Point[]): Point[] {
  if (path.length < 3) return [...path];
  const sorted = [...path].sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function getCompletionShape(
  label: DetectedShape,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  _originalPath: Point[],
  stroke = "#000"
): CompletionShapeData | undefined {
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const r = Math.max(w, h) / 2;

  switch (label) {
    case "line": {
      return {
        type: "line",
        x1: bounds.minX,
        y1: bounds.minY,
        x2: bounds.maxX,
        y2: bounds.maxY,
        stroke,
      };
    }
    case "circle":
    case "apple":
      return { type: "circle", cx, cy, r, stroke };
    case "rectangle":
      return { type: "rectangle", x: bounds.minX, y: bounds.minY, w, h, stroke };
    case "triangle": {
      const top = bounds.minY;
      const bottom = bounds.maxY;
      const midX = (bounds.minX + bounds.maxX) / 2;
      return {
        type: "triangle",
        x1: midX,
        y1: top,
        x2: bounds.minX,
        y2: bottom,
        x3: bounds.maxX,
        y3: bottom,
        stroke,
      };
    }
    case "star": {
      const points = starPath(cx, cy, r, 5);
      return { type: "path", path: points, stroke };
    }
    default:
      return undefined;
  }
}

function starPath(cx: number, cy: number, r: number, points: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? r : r * 0.4;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    out.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  }
  out.push(out[0]!);
  return out;
}

export { getCompletionShape as buildCompletionShape };
