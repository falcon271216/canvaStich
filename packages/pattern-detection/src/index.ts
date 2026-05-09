/* ────── shape detection (geometric + DTW combined) ────── */
export { detectShape, buildCompletionShape } from "./geometricDetect.js";
export type {
  DetectionResult,
  DetectedShape,
  CompletionShapeData,
} from "./geometricDetect.js";

/* ────── path normalization ────── */
export { normalizePath, resamplePath, boundingBox } from "./normalizePath.js";
export type { Point } from "./normalizePath.js";

/* ────── DTW (Dynamic Time Warping) ────── */
export {
  dtwDistance,
  dtwDistanceNormalized,
  matchShapeDTW,
  getTemplates,
  circleTemplate,
  rectangleTemplate,
  triangleTemplate,
  lineTemplate,
  starTemplate,
} from "./dtw.js";
export type { DtwMatchResult, ShapeTemplate } from "./dtw.js";

/* ────── time-series feature extraction ────── */
export {
  computeVelocity,
  computeAcceleration,
  extractStrokeFeatures,
} from "./timeSeriesFeatures.js";
export type {
  VelocityPoint,
  AccelerationPoint,
  StrokeFeatures,
} from "./timeSeriesFeatures.js";

/* ────── sliding-window real-time detection ────── */
export { SlidingWindowDetector } from "./slidingWindow.js";
export type {
  SlidingWindowConfig,
  LiveDetection,
} from "./slidingWindow.js";

/* ────── anomaly detection (CUSUM / Z-score) ────── */
export {
  detectAnomaliesZScore,
  detectChangepointsCUSUM,
  eventTimesToActivitySeries,
  analyseSession,
} from "./anomalyDetection.js";
export type {
  ActivityPoint,
  AnomalyResult,
  CusumConfig,
  SessionPattern,
} from "./anomalyDetection.js";

/* ════════════════════════════════════════════════════════════
   SketchUI — Sketch-to-Wireframe Intelligence Pipeline
   ════════════════════════════════════════════════════════════ */

/* ────── UI component labels & types ────── */
export {
  UI_COMPONENT_LABELS,
  UI_CLASS_COUNT,
  UI_COMPONENT_ICONS,
  UI_COMPONENT_DISPLAY_NAMES,
  UI_COMPONENT_HINTS,
} from "./uiLabels.js";
export type {
  UIComponentType,
  ComponentHint,
} from "./uiLabels.js";

/* ────── UI feature extraction ────── */
export { extractUIFeatures } from "./uiFeatures.js";
export type {
  StrokeFeatureVector,
  BoundingBox,
} from "./uiFeatures.js";

/* ────── synthetic data generation ────── */
export {
  generateSyntheticStrokes,
  generateFullDataset,
} from "./syntheticData.js";
export type { SyntheticSample } from "./syntheticData.js";

/* ────── UI component classifier ────── */
export {
  classifyUIComponent,
  classifyMultiple,
} from "./uiClassifier.js";
export type { UIDetectionResult } from "./uiClassifier.js";

/* ────── spatial clustering (DBSCAN) ────── */
export {
  clusterComponents,
  mergeOverlappingComponents,
} from "./clustering.js";
export type {
  DetectedComponent,
  ComponentGroup,
} from "./clustering.js";

/* ────── layout tree builder ────── */
export {
  buildContainmentTree,
  flattenTree,
  findNodeById,
  updateNodeType,
} from "./layoutTree.js";
export type { LayoutNode } from "./layoutTree.js";

/* ────── code generation engine ────── */
export {
  generateCode,
  generateFullComponent,
  generateAllFormats,
} from "./codeGen.js";
export type { Framework } from "./codeGen.js";

/* ────── premium AI code generation ────── */
export {
  serializeLayoutForPrompt,
  buildPremiumPrompt,
  countLayoutNodes,
  stripCodeFences,
  PREMIUM_SYSTEM_PROMPT,
  DESIGN_THEMES,
  VALID_THEMES,
} from "./premiumCodeGen.js";
export type {
  GenerationRequest,
  DesignTheme,
} from "./premiumCodeGen.js";

/* ────── wireframe symbol vocabulary (v2) ────── */
export {
  detectCompositeSymbol,
  upgradeWithCompositeSymbols,
} from "./wireframeSymbols.js";
export type { CompositeSymbolResult } from "./wireframeSymbols.js";
