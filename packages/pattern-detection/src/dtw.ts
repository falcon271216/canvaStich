/**
 * Dynamic Time Warping (DTW) implementation for time-series pattern matching.
 *
 * DTW is a canonical algorithm from speech-recognition and time-series analysis
 * that measures the similarity between two temporal sequences which may vary in
 * speed. Unlike Euclidean distance it allows elastic shifting so a user drawing
 * a circle slowly and one drawing it quickly both match the circle template.
 *
 * Reference: Sakoe & Chiba, "Dynamic programming algorithm optimization for
 * spoken word recognition", IEEE Trans. ASSP, 1978.
 */

import type { Point } from "./normalizePath.js";

/* ────────────────────────────── helpers ────────────────────────────── */

/** Euclidean distance between two 2-D points (ignoring time). */
function pointDist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/* ────────────────────────────── core DTW ─────────────────────────── */

/**
 * Compute the DTW distance between two point sequences.
 *
 * Uses the Sakoe-Chiba band optimisation to keep the cost matrix bounded.
 * Complexity: O(n * m) in the worst case, O(n * w) with the band.
 *
 * @param seq  The query sequence  (user's stroke, normalised).
 * @param tmpl The template sequence (ideal shape, normalised).
 * @param bandWidth  Sakoe-Chiba band half-width (default = max(n,m) → full matrix).
 * @returns The cumulative DTW distance (lower = better match).
 */
export function dtwDistance(
  seq: Point[],
  tmpl: Point[],
  bandWidth?: number,
): number {
  const n = seq.length;
  const m = tmpl.length;
  if (n === 0 || m === 0) return Infinity;

  const w = bandWidth ?? Math.max(n, m);

  // Flat cost matrix stored in row-major order (n+1) x (m+1).
  const cols = m + 1;
  const cost = new Float64Array((n + 1) * cols);
  cost.fill(Infinity);
  cost[0] = 0; // cost[0][0] = 0

  for (let i = 1; i <= n; i++) {
    const jStart = Math.max(1, i - w);
    const jEnd = Math.min(m, i + w);
    for (let j = jStart; j <= jEnd; j++) {
      const d = pointDist(seq[i - 1]!, tmpl[j - 1]!);
      const prev = Math.min(
        cost[(i - 1) * cols + j]!,       // insertion
        cost[i * cols + (j - 1)]!,        // deletion
        cost[(i - 1) * cols + (j - 1)]!,  // match
      );
      cost[i * cols + j] = d + prev;
    }
  }

  return cost[n * cols + m]!;
}

/**
 * Compute the DTW distance **normalised** by path length so that templates of
 * different sizes are comparable.
 */
export function dtwDistanceNormalized(
  seq: Point[],
  tmpl: Point[],
  bandWidth?: number,
): number {
  const raw = dtwDistance(seq, tmpl, bandWidth);
  return raw / Math.max(seq.length, tmpl.length, 1);
}

/* ────────────────────── ideal-shape template generators ─────────── */

/**
 * Generate an ideal circle template with `n` equally-spaced points in a
 * `size × size` coordinate box (matching the normalised space).
 */
export function circleTemplate(n: number, size: number): Point[] {
  const r = size / 2;
  const cx = size / 2;
  const cy = size / 2;
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const theta = (2 * Math.PI * i) / n;
    pts.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) });
  }
  return pts;
}

/**
 * Generate an ideal rectangle template (CW traversal of corners).
 */
export function rectangleTemplate(n: number, size: number): Point[] {
  const pad = size * 0.05;
  const x0 = pad, y0 = pad;
  const x1 = size - pad, y1 = size - pad;
  const perimeter = 2 * (x1 - x0) + 2 * (y1 - y0);
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    let d = (i / n) * perimeter;
    const top = x1 - x0;
    const right = y1 - y0;
    const bottom = x1 - x0;
    if (d < top) {
      pts.push({ x: x0 + d, y: y0 });
    } else if ((d -= top) < right) {
      pts.push({ x: x1, y: y0 + d });
    } else if ((d -= right) < bottom) {
      pts.push({ x: x1 - d, y: y1 });
    } else {
      d -= bottom;
      pts.push({ x: x0, y: y1 - d });
    }
  }
  return pts;
}

/**
 * Generate an ideal equilateral triangle template.
 */
export function triangleTemplate(n: number, size: number): Point[] {
  const cx = size / 2;
  const r = size * 0.45;
  // Top, bottom-right, bottom-left
  const vertices: Point[] = [
    { x: cx, y: cx - r },
    { x: cx + r * Math.cos(Math.PI / 6), y: cx + r * Math.sin(Math.PI / 6) },
    { x: cx - r * Math.cos(Math.PI / 6), y: cx + r * Math.sin(Math.PI / 6) },
  ];
  const pts: Point[] = [];
  const perimeter =
    pointDist(vertices[0]!, vertices[1]!) +
    pointDist(vertices[1]!, vertices[2]!) +
    pointDist(vertices[2]!, vertices[0]!);
  const sides = [
    [vertices[0]!, vertices[1]!],
    [vertices[1]!, vertices[2]!],
    [vertices[2]!, vertices[0]!],
  ] as const;
  const sideLens = sides.map(([a, b]) => pointDist(a, b));

  for (let i = 0; i < n; i++) {
    let d = (i / n) * perimeter;
    let sideIdx = 0;
    while (sideIdx < 2 && d > sideLens[sideIdx]!) {
      d -= sideLens[sideIdx]!;
      sideIdx++;
    }
    const [a, b] = sides[sideIdx]!;
    const t = d / (sideLens[sideIdx]! || 1);
    pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return pts;
}

/**
 * Generate an ideal line template (diagonal).
 */
export function lineTemplate(n: number, size: number): Point[] {
  const pad = size * 0.05;
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    pts.push({ x: pad + (size - 2 * pad) * t, y: pad + (size - 2 * pad) * t });
  }
  return pts;
}

/**
 * Generate an ideal 5-pointed star template.
 */
export function starTemplate(n: number, size: number): Point[] {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.45;
  const innerR = outerR * 0.4;
  const numSpikes = 5;
  const vertices: Point[] = [];
  for (let i = 0; i < numSpikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / numSpikes - Math.PI / 2;
    vertices.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }
  vertices.push(vertices[0]!); // close

  // Distribute n points along the star perimeter
  const segLens = vertices.slice(0, -1).map((v, i) => pointDist(v, vertices[i + 1]!));
  const totalLen = segLens.reduce((a, b) => a + b, 0);
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    let d = (i / n) * totalLen;
    let segIdx = 0;
    while (segIdx < segLens.length - 1 && d > segLens[segIdx]!) {
      d -= segLens[segIdx]!;
      segIdx++;
    }
    const a = vertices[segIdx]!;
    const b = vertices[segIdx + 1]!;
    const t = d / (segLens[segIdx]! || 1);
    pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return pts;
}

/* ──────────────────── pre-built template cache ──────────────────── */

const TMPL_SIZE = 64;
const TMPL_POINTS = 64;

export interface ShapeTemplate {
  label: string;
  points: Point[];
}

let _cachedTemplates: ShapeTemplate[] | null = null;

/** Return all built-in templates (circle, rectangle, triangle, line, star). Cached. */
export function getTemplates(): ShapeTemplate[] {
  if (_cachedTemplates) return _cachedTemplates;
  _cachedTemplates = [
    { label: "circle",    points: circleTemplate(TMPL_POINTS, TMPL_SIZE) },
    { label: "rectangle", points: rectangleTemplate(TMPL_POINTS, TMPL_SIZE) },
    { label: "triangle",  points: triangleTemplate(TMPL_POINTS, TMPL_SIZE) },
    { label: "line",      points: lineTemplate(TMPL_POINTS, TMPL_SIZE) },
    { label: "star",      points: starTemplate(TMPL_POINTS, TMPL_SIZE) },
  ];
  return _cachedTemplates;
}

/* ─────────────── high-level DTW-based shape recognition ─────────── */

export interface DtwMatchResult {
  label: string;
  /** Raw (unnormalized) DTW distance — lower is closer. */
  rawDistance: number;
  /** Normalized DTW distance (per-point average). */
  normalizedDistance: number;
  /** Confidence score 0 – 1 derived from normalised distance. */
  confidence: number;
}

/**
 * Match a normalised user stroke against all built-in shape templates using DTW.
 *
 * @param normalizedStroke  The user's stroke, already normalised to TMPL_SIZE space.
 * @returns Sorted array of match results (best first).
 */
export function matchShapeDTW(normalizedStroke: Point[]): DtwMatchResult[] {
  const templates = getTemplates();

  // Also match the reversed stroke (user may draw CW or CCW)
  const reversed = [...normalizedStroke].reverse();

  const results: DtwMatchResult[] = templates.map((tmpl) => {
    const d1 = dtwDistance(normalizedStroke, tmpl.points);
    const d2 = dtwDistance(reversed, tmpl.points);
    const raw = Math.min(d1, d2);
    const normalized = raw / Math.max(normalizedStroke.length, tmpl.points.length, 1);
    // Convert normalised distance to a confidence score.
    // A distance of 0 → confidence 1, distance ≥ 25 → confidence → 0
    const confidence = Math.max(0, 1 - normalized / 25);
    return { label: tmpl.label, rawDistance: raw, normalizedDistance: normalized, confidence };
  });

  results.sort((a, b) => a.normalizedDistance - b.normalizedDistance);
  return results;
}
