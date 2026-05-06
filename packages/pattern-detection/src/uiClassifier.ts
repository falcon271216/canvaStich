/**
 * UI Component Classifier — combined heuristic + DTW ensemble.
 *
 * Classifies groups of strokes into one of 14 UI component types
 * using two complementary approaches:
 *  1. **Heuristic rules** on the extracted StrokeFeatureVector
 *  2. **DTW nearest-neighbour** against canonical UI-component templates
 *
 * Final score: 0.6 × heuristicScore + 0.4 × dtwScore
 */

import type { Point } from "./normalizePath.js";
import { normalizePath, boundingBox } from "./normalizePath.js";
import { dtwDistanceNormalized } from "./dtw.js";
import { extractUIFeatures, type StrokeFeatureVector, type BoundingBox } from "./uiFeatures.js";
import {
  type UIComponentType,
  UI_COMPONENT_LABELS,
  UI_COMPONENT_HINTS,
} from "./uiLabels.js";
import { generateSyntheticStrokes } from "./syntheticData.js";

/* ────────────────────── types ────────────────────── */

export interface UIDetectionResult {
  type: UIComponentType;
  confidence: number;
  boundingBox: BoundingBox;
  method: 'heuristic' | 'dtw' | 'ensemble';
  allScores: { type: UIComponentType; score: number }[];
}

/* ────────────────────── template generation ────────────────────── */

interface UITemplate {
  label: UIComponentType;
  /** Normalised flattened point sequence. */
  points: Point[];
}

const TMPL_SIZE = 64;
const TMPL_POINTS = 64;

let _cachedUITemplates: UITemplate[] | null = null;

/**
 * Build canonical DTW templates for all 14 UI component types.
 * We use the synthetic data generator with minimal noise to create
 * 3 representative templates per class.
 */
function getUITemplates(): UITemplate[] {
  if (_cachedUITemplates) return _cachedUITemplates;
  _cachedUITemplates = [];

  for (const label of UI_COMPONENT_LABELS) {
    // Generate a few low-noise canonical samples
    const samples = generateSyntheticStrokes(label, 3);
    for (const sample of samples) {
      const flat = sample.strokes.flat();
      if (flat.length < 3) continue;
      const normalized = normalizePath(flat, TMPL_POINTS, TMPL_SIZE);
      _cachedUITemplates.push({ label, points: normalized });
    }
  }

  return _cachedUITemplates;
}

/* ────────────────────── heuristic classifier ────────────────────── */

function scoreHeuristic(features: StrokeFeatureVector): Map<UIComponentType, number> {
  const scores = new Map<UIComponentType, number>();

  for (const label of UI_COMPONENT_LABELS) {
    const hints = UI_COMPONENT_HINTS[label];
    let score = 0;
    let checks = 0;

    // 1. Aspect ratio match
    const [arMin, arMax] = hints.typicalAspectRatio;
    if (features.aspectRatio >= arMin && features.aspectRatio <= arMax) {
      score += 0.3;
    } else {
      // Partial credit for close matches
      const dist = Math.min(
        Math.abs(features.aspectRatio - arMin),
        Math.abs(features.aspectRatio - arMax),
      );
      score += Math.max(0, 0.3 - dist * 0.05);
    }
    checks++;

    // 2. Stroke count match
    const [scMin, scMax] = hints.typicalStrokeCount;
    if (features.strokeCount >= scMin && features.strokeCount <= scMax) {
      score += 0.2;
    } else if (features.strokeCount <= scMax + 1) {
      score += 0.1;
    }
    checks++;

    // 3. Closure match
    if (hints.closureLikelihood === 'high' && features.closureScore > 0.6) {
      score += 0.2;
    } else if (hints.closureLikelihood === 'medium' && features.closureScore > 0.3) {
      score += 0.15;
    } else if (hints.closureLikelihood === 'low' && features.closureScore < 0.4) {
      score += 0.2;
    } else {
      score += 0.05;
    }
    checks++;

    // 4. Size match
    if (hints.typicalSize === 'small' && features.normalizedArea < 0.03) {
      score += 0.15;
    } else if (hints.typicalSize === 'medium' && features.normalizedArea >= 0.02 && features.normalizedArea <= 0.15) {
      score += 0.15;
    } else if (hints.typicalSize === 'large' && features.normalizedArea > 0.08) {
      score += 0.15;
    } else {
      score += 0.03;
    }
    checks++;

    // 5. Direction changes — tables have many, dividers have few
    if (label === 'table' && features.directionChanges > 6) {
      score += 0.15;
    } else if (label === 'divider' && features.directionChanges < 3) {
      score += 0.15;
    } else if (label === 'text_label' && features.directionChanges >= 3 && features.directionChanges <= 12) {
      score += 0.1;
    }

    scores.set(label, score);
  }

  return scores;
}

/* ────────────────────── DTW classifier ────────────────────── */

function scoreDTW(normalizedStroke: Point[]): Map<UIComponentType, number> {
  const templates = getUITemplates();
  const scores = new Map<UIComponentType, number>();

  // Best distance per label (take min across multiple templates)
  const bestDist = new Map<UIComponentType, number>();

  // Also check reversed stroke
  const reversed = [...normalizedStroke].reverse();

  for (const tmpl of templates) {
    const d1 = dtwDistanceNormalized(normalizedStroke, tmpl.points);
    const d2 = dtwDistanceNormalized(reversed, tmpl.points);
    const d = Math.min(d1, d2);
    const prev = bestDist.get(tmpl.label) ?? Infinity;
    if (d < prev) bestDist.set(tmpl.label, d);
  }

  // Convert distances to confidence scores
  for (const [label, dist] of bestDist) {
    // Lower distance = higher confidence. Distance of 0 → 1, ≥ 30 → 0
    const confidence = Math.max(0, 1 - dist / 30);
    scores.set(label, confidence);
  }

  return scores;
}

/* ────────────────────── main classifier ────────────────────── */

/**
 * Classify a group of strokes into a UI component type.
 *
 * @param strokes    Array of stroke point arrays.
 * @param canvasArea Canvas width × height for area normalisation.
 * @returns Detection result with type, confidence, and all scores.
 */
export function classifyUIComponent(
  strokes: Point[][],
  canvasArea: number,
): UIDetectionResult {
  const allPoints = strokes.flat();
  const bbox = boundingBox(allPoints);
  const bboxResult: BoundingBox = {
    x: bbox.minX,
    y: bbox.minY,
    width: bbox.maxX - bbox.minX,
    height: bbox.maxY - bbox.minY,
  };

  if (allPoints.length < 3) {
    return {
      type: 'container_box',
      confidence: 0,
      boundingBox: bboxResult,
      method: 'heuristic',
      allScores: [],
    };
  }

  // Extract features for heuristic classifier
  const features = extractUIFeatures(strokes, canvasArea);

  // Run heuristic classifier
  const heuristicScores = scoreHeuristic(features);

  // Run DTW classifier on normalised flattened stroke
  const normalized = normalizePath(allPoints, TMPL_POINTS, TMPL_SIZE);
  const dtwScores = scoreDTW(normalized);

  // Combine: 0.6 * heuristic + 0.4 * DTW
  const combined = new Map<UIComponentType, number>();
  for (const label of UI_COMPONENT_LABELS) {
    const hScore = heuristicScores.get(label) ?? 0;
    const dScore = dtwScores.get(label) ?? 0;
    combined.set(label, 0.6 * hScore + 0.4 * dScore);
  }

  // Sort by combined score
  const sorted = [...combined.entries()].sort((a, b) => b[1] - a[1]);
  const allScores = sorted.map(([type, score]) => ({ type, score }));

  const bestLabel = sorted[0]?.[0] ?? 'container_box';
  const bestScore = sorted[0]?.[1] ?? 0;

  // Determine method
  const hBest = heuristicScores.get(bestLabel) ?? 0;
  const dBest = dtwScores.get(bestLabel) ?? 0;
  let method: UIDetectionResult['method'] = 'ensemble';
  if (hBest > dBest * 1.5) method = 'heuristic';
  else if (dBest > hBest * 1.5) method = 'dtw';

  return {
    type: bestLabel,
    confidence: Math.min(1, bestScore),
    boundingBox: bboxResult,
    method,
    allScores,
  };
}

/**
 * Batch-classify multiple component groups.
 */
export function classifyMultiple(
  componentGroups: { id: string; strokes: Point[][] }[],
  canvasArea: number,
): (UIDetectionResult & { id: string })[] {
  return componentGroups.map((group) => ({
    id: group.id,
    ...classifyUIComponent(group.strokes, canvasArea),
  }));
}
