/**
 * ML inference pipeline for the SketchUI system.
 *
 * Replaces the original QuickDraw CNN mock with the UI component classifier
 * from @repo/pattern-detection. Uses heuristic + DTW ensemble for real-time
 * classification, with a CNN stub for future model integration.
 */

import {
  classifyUIComponent,
  UI_COMPONENT_LABELS,
  UI_COMPONENT_ICONS,
  UI_COMPONENT_DISPLAY_NAMES,
  type UIComponentType,
  type UIDetectionResult,
} from "@repo/pattern-detection";

/* ────────────────────── icon map ────────────────────── */

/** Component type → display emoji (used in canvas overlays). */
export const UI_ICON_MAP: Record<string, string> = { ...UI_COMPONENT_ICONS };

/** Re-export for convenience. */
export { UI_COMPONENT_LABELS, UI_COMPONENT_DISPLAY_NAMES };
export type { UIComponentType, UIDetectionResult };

/* ────────────────────── CNN stub ────────────────────── */

let _cnnReady = false;

/**
 * Loads a pre-trained TF.js CNN model for UI component classification.
 *
 * NOTE: Currently a stub — the model has not been trained yet.
 * When a real model is available, load it from `/model/ui-classifier/model.json`
 * and use it in `predictUIComponent()`.
 */
export async function loadModel(): Promise<boolean> {
  if (_cnnReady) return true;
  try {
    // Future: model = await tf.loadLayersModel('/model/ui-classifier/model.json');
    console.log("[SketchUI ML] CNN stub ready — using heuristic+DTW ensemble for classification.");
    _cnnReady = true;
    return true;
  } catch (err) {
    console.error("[SketchUI ML] Failed to load model:", err);
    return false;
  }
}

/* ────────────────────── main prediction API ────────────────────── */

export interface UIPrediction {
  className: string;
  displayName: string;
  probability: number;
  icon: string;
}

/**
 * Classify a set of strokes into UI component types.
 *
 * @param paths   Array of stroke paths (each path is an array of {x, y} points).
 * @param canvasWidth   Canvas width in pixels.
 * @param canvasHeight  Canvas height in pixels.
 * @returns Top predictions sorted by confidence.
 */
export async function predictUIComponent(
  paths: { x: number; y: number; t?: number }[][],
  canvasWidth = 900,
  canvasHeight = 600,
): Promise<UIPrediction[]> {
  const flatPoints = paths.flat();
  if (flatPoints.length < 5) return [];

  // Ensure model stub is initialized
  if (!_cnnReady) await loadModel();

  const canvasArea = canvasWidth * canvasHeight;

  // Run the heuristic + DTW ensemble classifier
  const result = classifyUIComponent(
    paths.map((p) => p.map((pt) => ({ x: pt.x, y: pt.y, t: pt.t }))),
    canvasArea,
  );

  // Convert allScores to sorted predictions
  const predictions: UIPrediction[] = result.allScores
    .filter((s) => s.score > 0.05)
    .slice(0, 5)
    .map((s) => ({
      className: s.type,
      displayName: UI_COMPONENT_DISPLAY_NAMES[s.type] || s.type,
      probability: s.score,
      icon: UI_COMPONENT_ICONS[s.type] || '📦',
    }));

  return predictions;
}

/**
 * Quick single-result classification (used in the canvas manager).
 */
export async function classifyStrokes(
  paths: { x: number; y: number; t?: number }[][],
  canvasWidth = 900,
  canvasHeight = 600,
): Promise<UIDetectionResult | null> {
  const flatPoints = paths.flat();
  if (flatPoints.length < 5) return null;

  if (!_cnnReady) await loadModel();

  const canvasArea = canvasWidth * canvasHeight;
  return classifyUIComponent(
    paths.map((p) => p.map((pt) => ({ x: pt.x, y: pt.y, t: pt.t }))),
    canvasArea,
  );
}

/* ────────────────────── legacy compatibility ────────────────────── */

/**
 * Legacy function signature for backward compatibility with DrawingBoard.tsx.
 * Maps to the new predictUIComponent API.
 */
export async function predictPattern(
  paths: { x: number; y: number; t?: number }[][] | { x: number; y: number; t?: number }[],
): Promise<{ className: string; probability: number }[]> {
  // Handle single-path input
  const normalizedPaths = Array.isArray(paths[0]) && Array.isArray((paths[0] as any)[0]?.x !== undefined ? paths : [paths])
    ? (paths as { x: number; y: number; t?: number }[][])
    : [paths as { x: number; y: number; t?: number }[]];

  const predictions = await predictUIComponent(normalizedPaths);
  return predictions.map((p) => ({
    className: p.className,
    probability: p.probability,
  }));
}

/** Legacy emoji map — now returns UI component icons. */
export const EMOJI_MAP: Record<string, string> = { ...UI_COMPONENT_ICONS };

/** Legacy class list — now returns UI component labels. */
export const QUICK_DRAW_CLASSES = [...UI_COMPONENT_LABELS];
