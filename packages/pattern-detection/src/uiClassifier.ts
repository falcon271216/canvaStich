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
  const { width, height } = bbox;
  const area = width * height;

  for (const label of UI_COMPONENT_LABELS) {
    const hints = UI_COMPONENT_HINTS[label];
    let score = 0;

    // 1. Aspect ratio match (with ratio-based deviation penalty)
    const [arMin, arMax] = hints.typicalAspectRatio;
    if (features.aspectRatio >= arMin && features.aspectRatio <= arMax) {
      score += 0.35;
    } else {
      const devRatio = features.aspectRatio > arMax
        ? features.aspectRatio / arMax
        : arMin / features.aspectRatio;
      score += Math.max(0, 0.35 - (devRatio - 1.0) * 0.4);
    }

    // 2. Stroke count match
    const [scMin, scMax] = hints.typicalStrokeCount;
    if (features.strokeCount >= scMin && features.strokeCount <= scMax) {
      score += 0.15;
    } else if (features.strokeCount <= scMax + 1) {
      score += 0.08;
    }

    // 3. Closure match
    if (hints.closureLikelihood === 'high' && features.closureScore > 0.6) {
      score += 0.15;
    } else if (hints.closureLikelihood === 'medium' && features.closureScore > 0.3) {
      score += 0.12;
    } else if (hints.closureLikelihood === 'low' && features.closureScore < 0.4) {
      score += 0.15;
    } else {
      score += 0.04;
    }

    // 4. Size match — stronger weight so big ≠ search bar
    // small: compact widgets; medium: forms/buttons; large: layout bands/containers
    const isSmall = maxDim < 80 && area < 18_000;
    const isMedium = !isSmall && maxDim <= 320 && area < 80_000;
    const isLarge = area >= 80_000 || width > 450 || maxDim > 320;

    let sizeScore = 0;
    if (hints.typicalSize === 'small' && isSmall) {
      sizeScore = 0.35;
    } else if (hints.typicalSize === 'medium' && isMedium) {
      sizeScore = 0.3;
    } else if (hints.typicalSize === 'large' && isLarge) {
      sizeScore = 0.35;
    } else {
      if (hints.typicalSize === 'medium' && (isSmall || isLarge)) {
        sizeScore = 0.06;
      } else if (hints.typicalSize === 'small' && isMedium) {
        sizeScore = 0.04;
      } else if (hints.typicalSize === 'large' && isMedium) {
        sizeScore = 0.08;
      } else {
        sizeScore = 0; // hard size mismatch
      }
    }
    score += sizeScore;

    // 4b. Absolute geometry gates for common mislabels
    if (label === 'search_bar') {
      // Search is a compact control — never a page-wide / tall rectangle
      if (height > 56 || width > 420 || area > 22_000 || features.strokeCount < 2) {
        score -= 0.55;
      } else if (height <= 48 && width >= 120 && width <= 380) {
        score += 0.15;
      }
    }
    if (label === 'navbar' || label === 'footer') {
      if (width >= 320 && height <= 120 && features.aspectRatio >= 4) {
        score += 0.25;
      } else if (width < 250 || height > 180) {
        score -= 0.25;
      }
    }
    if (label === 'input_field') {
      if (height <= 56 && width >= 140 && width <= 480 && features.strokeCount <= 2) {
        score += 0.12;
      }
      if (width > 520 || height > 70) {
        score -= 0.2;
      }
    }

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
      label === 'image_placeholder' ||
      label === 'search_bar'
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

    // Normalize score to [0, 1]
    scores.set(label, Math.max(0, score / 1.35));
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
  canvasWidth: number,
  canvasHeight: number,
): { type: UIComponentType; confidence: number } | null {
  const { width, height, x, y } = bboxResult;
  const aspectRatio = height > 0 ? width / height : width > 0 ? 100 : 1;
  const area = width * height;
  const closureScore = features.closureScore;
  const pointCount = allPoints.length;
  const widthFrac = canvasWidth > 0 ? width / canvasWidth : 0;
  const centerYFrac = canvasHeight > 0 ? (y + height / 2) / canvasHeight : 0.5;

  // Closed shapes (closureScore high = shape is closed)
  if (closureScore > 0.5) {
    // Page-wide horizontal band → navbar (top) or footer (bottom)
    if (aspectRatio >= 4 && height <= 130 && (width >= 280 || widthFrac >= 0.45)) {
      if (centerYFrac >= 0.72) {
        return { type: 'footer', confidence: 0.86 };
      }
      return { type: 'navbar', confidence: 0.86 };
    }

    // Compact search: small height + medium width + preferably multi-stroke (icon)
    if (
      height <= 52 &&
      width >= 120 &&
      width <= 400 &&
      area <= 20_000 &&
      features.strokeCount >= 2
    ) {
      return { type: 'search_bar', confidence: 0.78 };
    }

    // Wide thin single stroke → input (not search)
    if (aspectRatio > 2.0 && height <= 56 && width >= 140 && width <= 480 && area < 22_000) {
      return { type: 'input_field', confidence: 0.74 };
    }

    // Medium-wide, small → button
    if (aspectRatio > 1.5 && area < 8000 && width < 180) {
      return { type: 'button', confidence: 0.72 };
    }

    // Larger, moderately wide → card
    if (aspectRatio > 0.5 && aspectRatio < 2.5 && area > 20000 && area < 80_000) {
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

/**
 * Hard size/placement correction. DTW is size-invariant, so big rectangles
 * often mislabel as search_bar — remap using real sketch dimensions.
 */
function refineLabelBySize(
  type: UIComponentType,
  confidence: number,
  bbox: BoundingBox,
  features: StrokeFeatureVector,
  canvasWidth: number,
  canvasHeight: number,
): { type: UIComponentType; confidence: number } {
  const { width, height, x, y } = bbox;
  const area = width * height;
  const aspect = height > 0 ? width / height : width;
  const widthFrac = canvasWidth > 0 ? width / canvasWidth : 0;
  const centerYFrac = canvasHeight > 0 ? (y + height / 2) / canvasHeight : 0.5;
  const isWideBand =
    aspect >= 4 &&
    height <= 140 &&
    (width >= 280 || widthFrac >= 0.45);

  // Wide page band → header / footer (never search)
  if (isWideBand) {
    // Taller bands feel like footers; top-of-canvas bands like headers.
    // Prefer vertical placement when canvas coords are reliable; else use height.
    if (centerYFrac >= 0.68 || (height >= 72 && centerYFrac >= 0.45)) {
      return { type: 'footer', confidence: Math.max(confidence, 0.84) };
    }
    return { type: 'navbar', confidence: Math.max(confidence, 0.84) };
  }

  // Oversized "search_bar" corrections
  if (type === 'search_bar') {
    const tooTall = height > 56;
    const tooWide = width > 420 || widthFrac > 0.55;
    const tooBig = area > 22_000;
    const singleStroke = features.strokeCount < 2;

    if (tooTall || tooWide || tooBig) {
      if (aspect >= 3.5 && (width >= 280 || widthFrac >= 0.4) && height <= 140) {
        if (height >= 72 || centerYFrac >= 0.68) {
          return { type: 'footer', confidence: 0.82 };
        }
        return { type: 'navbar', confidence: 0.82 };
      }
      if (area > 50_000) {
        return { type: 'container_box', confidence: 0.75 };
      }
      if (aspect >= 2 && height <= 70) {
        return { type: 'input_field', confidence: 0.78 };
      }
      return { type: 'container_box', confidence: 0.7 };
    }

    // Lone rectangle without magnifier stroke → prefer input field
    if (singleStroke && height <= 56 && width >= 140) {
      return { type: 'input_field', confidence: 0.76 };
    }
  }

  // Navbar misplaced as input when it's actually a full-width header
  if ((type === 'input_field' || type === 'button') && isWideBand) {
    if (height >= 72 || centerYFrac >= 0.68) return { type: 'footer', confidence: 0.8 };
    return { type: 'navbar', confidence: 0.8 };
  }

  return { type, confidence };
}

/* ────────────────────── main classifier ────────────────────── */

/**
 * Classify a group of strokes into a UI component type.
 *
 * Uses a three-tier approach:
 *  1. DTW + heuristic ensemble (primary)
 *  2. Geometric override (fallback when ensemble confidence < 0.6)
 *  3. Size/placement refinement (always) — big rect ≠ search bar
 *
 * @param strokes    Array of stroke point arrays.
 * @param canvasArea Canvas width × height for area normalisation.
 * @param canvasSize Optional real canvas size for position-aware labels.
 * @returns Detection result with type, confidence, and all scores.
 */
export function classifyUIComponent(
  strokes: Point[][],
  canvasArea: number,
  canvasSize?: { width: number; height: number },
): UIDetectionResult {
  const allPoints = strokes.flat();
  const bbox = boundingBox(allPoints);
  const bboxResult: BoundingBox = {
    x: bbox.minX,
    y: bbox.minY,
    width: bbox.maxX - bbox.minX,
    height: bbox.maxY - bbox.minY,
  };

  const canvasWidth =
    canvasSize?.width ??
    (canvasArea > 0 ? Math.sqrt(canvasArea * (16 / 9)) : 1600);
  const canvasHeight =
    canvasSize?.height ??
    (canvasArea > 0 ? Math.sqrt(canvasArea * (9 / 16)) : 900);

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

  // Combine: lean harder on size-aware heuristics (DTW ignores absolute size)
  const combined = new Map<UIComponentType, number>();
  for (const label of UI_COMPONENT_LABELS) {
    const hScore = heuristicScores.get(label) ?? 0;
    const dScore = dtwScores.get(label) ?? 0;
    combined.set(label, 0.7 * hScore + 0.3 * dScore);
  }

  // Sort by combined score
  const sorted = [...combined.entries()].sort((a, b) => b[1] - a[1]);
  const allScores = sorted.map(([type, score]) => ({ type, score }));

  let bestLabel = sorted[0]?.[0] ?? 'container_box';
  let bestScore = sorted[0]?.[1] ?? 0;
  let method: UIDetectionResult['method'] = 'ensemble';

  // If ensemble confidence is low, try the geometric override classifier
  if (bestScore < 0.6) {
    const geoOverride = geometricOverrideClassifier(
      bboxResult,
      features,
      allPoints,
      canvasWidth,
      canvasHeight,
    );
    if (geoOverride) {
      bestLabel = geoOverride.type;
      bestScore = geoOverride.confidence;
      method = 'heuristic';
    }
  } else {
    const hBest = heuristicScores.get(bestLabel) ?? 0;
    const dBest = dtwScores.get(bestLabel) ?? 0;
    if (hBest > dBest * 1.5) method = 'heuristic';
    else if (dBest > hBest * 1.5) method = 'dtw';
  }

  // Always apply absolute-size correction (fixes big-rect → search_bar)
  const refined = refineLabelBySize(
    bestLabel,
    bestScore,
    bboxResult,
    features,
    canvasWidth,
    canvasHeight,
  );

  return {
    type: refined.type,
    confidence: Math.min(1, refined.confidence),
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
  canvasSize?: { width: number; height: number },
): (UIDetectionResult & { id: string })[] {
  return componentGroups.map((group) => ({
    id: group.id,
    ...classifyUIComponent(group.strokes, canvasArea, canvasSize),
  }));
}
