/**
 * UI Component Classifier — combined heuristic + DTW ensemble.
 *
 * Classifies groups of strokes into one of 22 UI component types
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
  method: 'heuristic' | 'dtw' | 'ensemble' | 'palette';
  allScores: { type: UIComponentType; score: number }[];
  source?: 'palette' | 'freehand' | 'template';
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
 * Build canonical DTW templates for all 22 UI component types.
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

/* ────────────────────── heuristic classifier ────────────────────── */

function scoreHeuristic(features: StrokeFeatureVector, bbox: BoundingBox): Map<UIComponentType, number> {
  const scores = new Map<UIComponentType, number>();
  const maxDim = Math.max(bbox.width, bbox.height);

  for (const label of UI_COMPONENT_LABELS) {
    const hints = UI_COMPONENT_HINTS[label];
    let score = 0;

    // 1. Aspect ratio match (with ratio-based deviation penalty)
    const [arMin, arMax] = hints.typicalAspectRatio;
    if (features.aspectRatio >= arMin && features.aspectRatio <= arMax) {
      score += 0.4;
    } else {
      const devRatio = features.aspectRatio > arMax
        ? features.aspectRatio / arMax
        : arMin / features.aspectRatio;
      score += Math.max(0, 0.4 - (devRatio - 1.0) * 0.4);
    }

    // 2. Stroke count match
    const [scMin, scMax] = hints.typicalStrokeCount;
    if (features.strokeCount >= scMin && features.strokeCount <= scMax) {
      score += 0.2;
    } else if (features.strokeCount <= scMax + 1) {
      score += 0.1;
    }

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

    // 4. Size match (using absolute max dimension in world coordinates)
    const isSmall = maxDim < 60;
    const isMedium = maxDim >= 60 && maxDim <= 240;
    const isLarge = maxDim > 240;

    let sizeScore = 0;
    if (hints.typicalSize === 'small' && isSmall) {
      sizeScore = 0.2;
    } else if (hints.typicalSize === 'medium' && isMedium) {
      sizeScore = 0.2;
    } else if (hints.typicalSize === 'large' && isLarge) {
      sizeScore = 0.2;
    } else {
      // Partial credit for adjacent sizes
      if (hints.typicalSize === 'medium' && (isSmall || isLarge)) {
        sizeScore = 0.08;
      } else if (hints.typicalSize === 'small' && isMedium) {
        sizeScore = 0.05;
      } else if (hints.typicalSize === 'large' && isMedium) {
        sizeScore = 0.05;
      }
    }
    score += sizeScore;

    // 5. Shape Style / Circularity check
    const isCircularComponent = (label === 'radio' || label === 'avatar');
    const isRectangularComponent = (
      label === 'checkbox' ||
      label === 'button' ||
      label === 'input_field' ||
      label === 'dropdown' ||
      label === 'card' ||
      label === 'navbar' ||
      label === 'footer' ||
      label === 'modal' ||
      label === 'container_box' ||
      label === 'image_placeholder'
    );

    if (isCircularComponent) {
      if (features.rectangularity >= 0.62 && features.rectangularity <= 0.85) {
        score += 0.15;
      } else if (features.rectangularity > 0.88) {
        score -= 0.3; // heavy penalty for rectangles
      }
    } else if (isRectangularComponent) {
      if (features.rectangularity >= 0.82) {
        score += 0.15;
      } else if (features.rectangularity < 0.78) {
        score -= 0.3; // heavy penalty for circles
      }
    }

    // 6. Direction changes (specific components)
    if (label === 'table' && features.directionChanges > 6) {
      score += 0.15;
    } else if (label === 'divider' && features.directionChanges < 3) {
      score += 0.15;
    } else if (label === 'text_label' && features.directionChanges >= 3 && features.directionChanges <= 12) {
      score += 0.1;
    }

    // Normalize score to [0, 1] (max possible points is 1.15)
    scores.set(label, Math.max(0, score / 1.15));
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

/* ────────────────────── geometric override classifier ────────────────────── */

/**
 * Geometric heuristics override — runs as a fallback when the
 * DTW+heuristic ensemble confidence is low (< 0.6).
 */
function geometricOverrideClassifier(
  bboxResult: BoundingBox,
  features: StrokeFeatureVector,
  allPoints: Point[],
): { type: UIComponentType; confidence: number } | null {
  const { width, height } = bboxResult;
  const aspectRatio = height > 0 ? width / height : width > 0 ? 100 : 1;
  const area = width * height;
  const closureScore = features.closureScore;
  const pointCount = allPoints.length;

  // Closed shapes (closureScore high = shape is closed)
  if (closureScore > 0.5) {
    // Very wide, thin → navbar
    if (aspectRatio > 3.0 && height < 80 && width > 200) {
      return { type: 'navbar', confidence: 0.75 };
    }

    // Wide rectangle → input field (if wide) or button (if narrower)
    if (aspectRatio > 2.0 && area < 18000) {
      if (width >= 180) {
        return { type: 'input_field', confidence: 0.72 };
      } else {
        return { type: 'button', confidence: 0.72 };
      }
    }

    // Medium-wide, small → button
    if (aspectRatio > 1.5 && area < 8000) {
      return { type: 'button', confidence: 0.72 };
    }

    // Larger, moderately wide → card
    if (aspectRatio > 0.5 && aspectRatio < 2.5 && area > 20000) {
      return { type: 'card', confidence: 0.68 };
    }

    // Very large container
    if (area > 80000) {
      return { type: 'container_box', confidence: 0.65 };
    }

    // Square-ish / circular small → checkbox or radio
    if (aspectRatio > 0.7 && aspectRatio < 1.3 && Math.max(width, height) < 60) {
      if (features.rectangularity < 0.83) {
        return { type: 'radio', confidence: 0.75 };
      } else {
        return { type: 'checkbox', confidence: 0.75 };
      }
    }

    // Square-ish circular medium → avatar
    if (aspectRatio > 0.7 && aspectRatio < 1.3 && Math.max(width, height) >= 60 && Math.max(width, height) < 140 && features.rectangularity < 0.83) {
      return { type: 'avatar', confidence: 0.72 };
    }
  }

  // Open shapes (low closure)
  if (closureScore < 0.4) {
    // Nearly horizontal line → divider
    if (aspectRatio > 8 || height < 8) {
      return { type: 'divider', confidence: 0.75 };
    }

    // Tall narrow line → divider (vertical)
    if (aspectRatio < 0.12) {
      return { type: 'divider', confidence: 0.65 };
    }

    // Short open path, few points → arrow connector
    if (pointCount < 30 && area < 15000) {
      return { type: 'arrow_connector', confidence: 0.6 };
    }

    // Open short text-like scribble
    if (aspectRatio > 2 && area < 5000) {
      return { type: 'text_label', confidence: 0.55 };
    }
  }

  // Large closed shape → container or card
  if (area > 40000 && closureScore > 0.3) {
    return { type: 'container_box', confidence: 0.6 };
  }

  // Medium closed shape → card
  if (area > 10000 && area <= 40000 && closureScore > 0.3) {
    return { type: 'card', confidence: 0.55 };
  }

  return null; // no strong geometric signal
}

/* ────────────────────── main classifier ────────────────────── */

/**
 * Classify a group of strokes into a UI component type.
 *
 * Uses a three-tier approach:
 *  1. DTW + heuristic ensemble (primary)
 *  2. Geometric override (fallback when ensemble confidence < 0.6)
 *  3. Default to container_box (last resort)
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
  const heuristicScores = scoreHeuristic(features, bboxResult);

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

  // If ensemble confidence is low, try the geometric override classifier
  if (bestScore < 0.6) {
    const geoOverride = geometricOverrideClassifier(bboxResult, features, allPoints);
    if (geoOverride) {
      return {
        type: geoOverride.type,
        confidence: geoOverride.confidence,
        boundingBox: bboxResult,
        method: 'heuristic',
        allScores,
      };
    }
  }

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
