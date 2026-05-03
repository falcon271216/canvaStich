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
