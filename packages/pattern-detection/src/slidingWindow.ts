/**
 * Sliding-window real-time pattern detection for streaming time-series strokes.
 *
 * Instead of waiting for the user to finish drawing (mouseUp), this module
 * analyses the last N points in a rolling window to provide real-time
 * pattern detection feedback while the user is still drawing.
 *
 * Concepts used:
 *  - Sliding window over a streaming time series
 *  - DTW matching against templates within each window
 *  - Confidence smoothing via exponential moving average (EMA)
 */

import type { Point } from "./normalizePath.js";
import { normalizePath } from "./normalizePath.js";
import { matchShapeDTW, type DtwMatchResult } from "./dtw.js";

/* ────────────────── configuration ────────────────── */

const DEFAULT_WINDOW_SIZE = 32;
const DEFAULT_STEP = 8;
const CONFIDENCE_THRESHOLD = 0.45;
const NORM_SIZE = 64;
const EMA_ALPHA = 0.3; // smoothing factor for confidence EMA

/* ────────────────── types ────────────────── */

export interface SlidingWindowConfig {
  /** Number of points in each analysis window. */
  windowSize?: number;
  /** Number of new points before re-running detection. */
  step?: number;
  /** Minimum confidence to emit a detection. */
  confidenceThreshold?: number;
}

export interface LiveDetection {
  /** Best-matching shape label. */
  label: string;
  /** Raw DTW confidence for this window. */
  confidence: number;
  /** Smoothed confidence (EMA over consecutive windows). */
  smoothedConfidence: number;
  /** DTW distance (normalised). */
  normalizedDistance: number;
  /** All template match results for this window (sorted best-first). */
  allMatches: DtwMatchResult[];
  /** Index of the first point in this window within the full stroke. */
  windowStart: number;
  /** Index of the last point in this window. */
  windowEnd: number;
  /** Timestamp of this detection (ms, Date.now). */
  timestamp: number;
}

/* ────────────────── detector class ────────────────── */

/**
 * Stateful sliding-window detector.
 *
 * Usage:
 *   const detector = new SlidingWindowDetector();
 *   // On each mousemove:
 *   detector.addPoint({ x, y, t: performance.now() });
 *   // Check if there's a live detection:
 *   const det = detector.getLatestDetection();
 *   // On mouseUp / reset:
 *   detector.reset();
 */
export class SlidingWindowDetector {
  private points: Point[] = [];
  private lastAnalysedIndex = -1;
  private latestDetection: LiveDetection | null = null;
  private emaConfidence: Record<string, number> = {};
  private readonly windowSize: number;
  private readonly step: number;
  private readonly confidenceThreshold: number;
  /** Full history of detections emitted during this stroke (useful for dashboard). */
  readonly detectionHistory: LiveDetection[] = [];

  constructor(config?: SlidingWindowConfig) {
    this.windowSize = config?.windowSize ?? DEFAULT_WINDOW_SIZE;
    this.step = config?.step ?? DEFAULT_STEP;
    this.confidenceThreshold = config?.confidenceThreshold ?? CONFIDENCE_THRESHOLD;
  }

  /** Feed a new point from the live stroke. */
  addPoint(p: Point): void {
    this.points.push(p);
    this.tryAnalyse();
  }

  /** Bulk-feed points (e.g. on paste or replay). */
  addPoints(pts: Point[]): void {
    this.points.push(...pts);
    this.tryAnalyse();
  }

  /** Get the most recent detection (may be null if not enough data yet). */
  getLatestDetection(): LiveDetection | null {
    return this.latestDetection;
  }

  /** Reset state for a new stroke. */
  reset(): void {
    this.points = [];
    this.lastAnalysedIndex = -1;
    this.latestDetection = null;
    this.emaConfidence = {};
    this.detectionHistory.length = 0;
  }

  /** Current number of collected points. */
  get length(): number {
    return this.points.length;
  }

  /* ──────────── internal ──────────── */

  private tryAnalyse(): void {
    const n = this.points.length;

    // Need at least one full window
    if (n < this.windowSize) return;

    // Only run if we've gathered `step` new points since last run
    if (n - 1 - this.lastAnalysedIndex < this.step) return;

    // Extract the latest window
    const windowStart = n - this.windowSize;
    const windowEnd = n - 1;
    const window = this.points.slice(windowStart, n);

    // Normalise the window to the standard coordinate space
    const normalized = normalizePath(window, this.windowSize, NORM_SIZE);

    // Run DTW matching against all templates
    const matches = matchShapeDTW(normalized);
    const best = matches[0];

    if (!best) return;

    // Update EMA confidence for the best label
    const prevEma = this.emaConfidence[best.label] ?? 0;
    const smoothed = EMA_ALPHA * best.confidence + (1 - EMA_ALPHA) * prevEma;
    this.emaConfidence[best.label] = smoothed;

    const detection: LiveDetection = {
      label: best.label,
      confidence: best.confidence,
      smoothedConfidence: smoothed,
      normalizedDistance: best.normalizedDistance,
      allMatches: matches,
      windowStart,
      windowEnd,
      timestamp: Date.now(),
    };

    if (smoothed >= this.confidenceThreshold) {
      this.latestDetection = detection;
      this.detectionHistory.push(detection);
    }

    this.lastAnalysedIndex = n - 1;
  }
}
