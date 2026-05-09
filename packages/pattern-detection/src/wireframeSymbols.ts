/**
 * Wireframe Symbol Vocabulary — Composite Shape Detection
 *
 * Detects industry-standard wireframe symbols that are composed of
 * multiple strokes with semantic meaning:
 *   - Rectangle with diagonal X → Image placeholder
 *   - Rectangle with horizontal lines → Text block / paragraph
 *   - Circle with head+shoulders → Avatar
 *   - Three horizontal lines (hamburger) → Nav menu
 *   - Rectangle with diagonal X inside + magnifying glass → Search bar
 *   - Two overlapping rectangles → List / card stack
 *   - Grid of 4 equal rectangles → Feature grid
 *   - Small downward triangle inside rectangle → Dropdown
 *
 * This module runs AFTER DBSCAN clustering, analyzing each cluster
 * of nearby strokes for composite symbol patterns.
 */

import type { Point } from "./normalizePath.js";
import { boundingBox } from "./normalizePath.js";
import type { UIComponentType } from "./uiLabels.js";
import type { BoundingBox } from "./uiFeatures.js";
import type { DetectedComponent } from "./clustering.js";

/* ────────────────────── spatial helpers ────────────────────── */

interface StrokeInfo {
  points: Point[];
  bbox: BoundingBox;
  aspectRatio: number;
  area: number;
  closureScore: number;
  isClosed: boolean;
  isHorizontal: boolean;
  isVertical: boolean;
  isDiagonal: boolean;
  pointCount: number;
}

function analyzeStroke(points: Point[]): StrokeInfo {
  const bb = boundingBox(points);
  const w = bb.maxX - bb.minX;
  const h = bb.maxY - bb.minY;
  const area = w * h;
  const aspectRatio = h > 0 ? w / h : w > 0 ? 100 : 1;

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const closeDist = Math.hypot(last.x - first.x, last.y - first.y);
  const maxDim = Math.max(w, h, 1);
  const closureScore = Math.max(0, 1 - closeDist / maxDim);

  return {
    points,
    bbox: { x: bb.minX, y: bb.minY, width: w, height: h },
    aspectRatio,
    area,
    closureScore,
    isClosed: closureScore > 0.5,
    isHorizontal: aspectRatio > 3 && h < 30,
    isVertical: aspectRatio < 0.3 && w < 30,
    isDiagonal: !isStrokeMostlyAxisAligned(points, w, h),
    pointCount: points.length,
  };
}

function isStrokeMostlyAxisAligned(points: Point[], w: number, h: number): boolean {
  if (points.length < 3) return true;
  // A stroke is "axis-aligned" if it mostly moves horizontally or vertically
  let axisAligned = 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = Math.abs(points[i]!.x - points[i - 1]!.x);
    const dy = Math.abs(points[i]!.y - points[i - 1]!.y);
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    total++;
    const ratio = Math.max(dx, dy) / len;
    if (ratio > 0.85) axisAligned++;
  }
  return total > 0 ? axisAligned / total > 0.6 : true;
}

/** Check if stroke B is contained within stroke A's bounding box (with tolerance). */
function isContainedIn(inner: BoundingBox, outer: BoundingBox, tolerance = 15): boolean {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.width <= outer.x + outer.width + tolerance &&
    inner.y + inner.height <= outer.y + outer.height + tolerance
  );
}

/** Compute what fraction of inner's area overlaps with outer. */
function containmentRatio(inner: BoundingBox, outer: BoundingBox): number {
  const x1 = Math.max(inner.x, outer.x);
  const y1 = Math.max(inner.y, outer.y);
  const x2 = Math.min(inner.x + inner.width, outer.x + outer.width);
  const y2 = Math.min(inner.y + inner.height, outer.y + outer.height);
  if (x2 <= x1 || y2 <= y1) return 0;
  const intersection = (x2 - x1) * (y2 - y1);
  const innerArea = inner.width * inner.height;
  return innerArea > 0 ? intersection / innerArea : 0;
}

/* ────────────────────── pattern detectors ────────────────────── */

/**
 * Detect: Rectangle with diagonal X → Image Placeholder
 *
 * Pattern: One closed rectangle + one or two diagonal strokes crossing it.
 * The diagonals span corner-to-corner of the rectangle.
 */
function detectImagePlaceholder(strokes: StrokeInfo[]): number {
  // Need a closed rectangle + at least 1 diagonal
  const closedRects = strokes.filter(s => s.isClosed && s.area > 1000);
  const diagonals = strokes.filter(s => !s.isClosed && s.isDiagonal);

  if (closedRects.length === 0 || diagonals.length === 0) return 0;

  for (const rect of closedRects) {
    let diagonalCount = 0;
    for (const diag of diagonals) {
      if (containmentRatio(diag.bbox, rect.bbox) > 0.5) {
        diagonalCount++;
      }
    }
    // One diagonal crossing = possible, two diagonals (X shape) = strong
    if (diagonalCount >= 2) return 0.92;
    if (diagonalCount === 1) return 0.75;
  }

  return 0;
}

/**
 * Detect: Rectangle with horizontal wavy/straight lines → Text Block
 *
 * Pattern: One closed rectangle + 2+ horizontal strokes inside it.
 * Lines represent paragraph text.
 */
function detectTextBlock(strokes: StrokeInfo[]): number {
  const closedRects = strokes.filter(s => s.isClosed && s.area > 2000);
  const horizontals = strokes.filter(s => s.isHorizontal && !s.isClosed);

  if (closedRects.length === 0 || horizontals.length < 2) return 0;

  for (const rect of closedRects) {
    let insideCount = 0;
    for (const line of horizontals) {
      if (containmentRatio(line.bbox, rect.bbox) > 0.6) {
        insideCount++;
      }
    }
    if (insideCount >= 3) return 0.9;
    if (insideCount >= 2) return 0.78;
  }

  return 0;
}

/**
 * Detect: Three horizontal lines (hamburger) → Nav Menu
 *
 * Pattern: 3 horizontal lines stacked vertically, similar lengths,
 * roughly equally spaced, all within a small area.
 */
function detectHamburgerMenu(strokes: StrokeInfo[]): number {
  const horizontals = strokes.filter(s =>
    s.isHorizontal && !s.isClosed && s.pointCount >= 3
  );

  if (horizontals.length < 3) return 0;

  // Sort by Y position
  const sorted = [...horizontals].sort((a, b) => a.bbox.y - b.bbox.y);

  // Check top 3 lines for uniform spacing and similar widths
  for (let i = 0; i <= sorted.length - 3; i++) {
    const lines = sorted.slice(i, i + 3);
    const widths = lines.map(l => l.bbox.width);
    const avgWidth = widths.reduce((a, b) => a + b, 0) / 3;

    // All widths should be within 40% of average
    const widthsUniform = widths.every(w => Math.abs(w - avgWidth) / avgWidth < 0.4);

    // Check vertical spacing is roughly uniform
    const gap1 = lines[1]!.bbox.y - lines[0]!.bbox.y;
    const gap2 = lines[2]!.bbox.y - lines[1]!.bbox.y;
    const spacingUniform = gap1 > 3 && gap2 > 3 &&
      Math.abs(gap1 - gap2) / Math.max(gap1, gap2) < 0.5;

    // Total height should be small (not a table)
    const totalH = lines[2]!.bbox.y + lines[2]!.bbox.height - lines[0]!.bbox.y;
    const isCompact = totalH < 80 && avgWidth < 80;

    if (widthsUniform && spacingUniform && isCompact) return 0.88;
  }

  return 0;
}

/**
 * Detect: Circle with dot inside → Radio Button
 *
 * Pattern: One closed circle-like shape + one small dot/circle inside.
 */
function detectRadioButton(strokes: StrokeInfo[]): number {
  const circles = strokes.filter(s =>
    s.isClosed && s.aspectRatio > 0.6 && s.aspectRatio < 1.6 && s.area < 5000
  );
  const dots = strokes.filter(s =>
    s.area < 200 && s.pointCount < 20
  );

  if (circles.length === 0 || dots.length === 0) return 0;

  for (const circle of circles) {
    for (const dot of dots) {
      if (containmentRatio(dot.bbox, circle.bbox) > 0.7) {
        return 0.85;
      }
    }
  }

  return 0;
}

/**
 * Detect: Small square with checkmark → Checkbox
 *
 * Pattern: One small closed square + one small open stroke (check) inside.
 */
function detectCheckbox(strokes: StrokeInfo[]): number {
  const squares = strokes.filter(s =>
    s.isClosed && s.aspectRatio > 0.6 && s.aspectRatio < 1.6 && s.area < 4000 && s.area > 200
  );
  const checks = strokes.filter(s =>
    !s.isClosed && s.pointCount >= 3 && s.pointCount <= 30 && s.area < 3000
  );

  if (squares.length === 0 || checks.length === 0) return 0;

  for (const square of squares) {
    for (const check of checks) {
      if (containmentRatio(check.bbox, square.bbox) > 0.5) {
        return 0.85;
      }
    }
  }

  return 0;
}

/**
 * Detect: Two or more overlapping/stacked rectangles → List
 *
 * Pattern: 2+ rectangles of similar width, stacked vertically.
 */
function detectList(strokes: StrokeInfo[]): number {
  const rects = strokes.filter(s => s.isClosed && s.area > 1500 && s.aspectRatio > 0.8);

  if (rects.length < 2) return 0;

  // Sort by Y position
  const sorted = [...rects].sort((a, b) => a.bbox.y - b.bbox.y);

  let stackedPairs = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i]!;
    const next = sorted[i + 1]!;

    // Similar width (within 30%)
    const widthRatio = Math.min(curr.bbox.width, next.bbox.width) /
                       Math.max(curr.bbox.width, next.bbox.width);
    const verticallyAdjacent = next.bbox.y < curr.bbox.y + curr.bbox.height + 30;

    if (widthRatio > 0.7 && verticallyAdjacent) {
      stackedPairs++;
    }
  }

  if (stackedPairs >= 2) return 0.85;
  if (stackedPairs >= 1 && rects.length >= 2) return 0.7;

  return 0;
}

/**
 * Detect: 4 equal rectangles in 2×2 grid → Feature Grid
 *
 * Pattern: 4 rectangles of similar size arranged in a 2×2 grid.
 */
function detectFeatureGrid(strokes: StrokeInfo[]): number {
  const rects = strokes.filter(s => s.isClosed && s.area > 500);

  if (rects.length < 4) return 0;

  // Group by approximate Y position (rows)
  const yTolerance = 30;
  const rows: StrokeInfo[][] = [];

  const sorted = [...rects].sort((a, b) => a.bbox.y - b.bbox.y);
  for (const r of sorted) {
    const existingRow = rows.find(row =>
      Math.abs(row[0]!.bbox.y - r.bbox.y) < yTolerance
    );
    if (existingRow) {
      existingRow.push(r);
    } else {
      rows.push([r]);
    }
  }

  // Need at least 2 rows with 2+ items each
  const validRows = rows.filter(r => r.length >= 2);
  if (validRows.length >= 2) {
    // Check if sizes are roughly uniform
    const allAreas = validRows.flat().map(r => r.area);
    const avgArea = allAreas.reduce((a, b) => a + b, 0) / allAreas.length;
    const areasUniform = allAreas.every(a => Math.abs(a - avgArea) / avgArea < 0.5);

    if (areasUniform) return 0.88;
    return 0.65;
  }

  return 0;
}

/**
 * Detect: Rectangle with small downward triangle → Dropdown
 *
 * Pattern: One rectangle + one small triangular shape inside it (right edge).
 */
function detectDropdown(strokes: StrokeInfo[]): number {
  const rects = strokes.filter(s =>
    s.isClosed && s.aspectRatio > 2 && s.area > 1500
  );
  const triangles = strokes.filter(s =>
    s.area < 1000 && s.pointCount >= 3 && s.pointCount <= 20
  );

  if (rects.length === 0 || triangles.length === 0) return 0;

  for (const rect of rects) {
    for (const tri of triangles) {
      // Triangle should be inside and toward the right edge
      if (containmentRatio(tri.bbox, rect.bbox) > 0.5) {
        const triCenterX = tri.bbox.x + tri.bbox.width / 2;
        const rectRightHalf = rect.bbox.x + rect.bbox.width * 0.6;
        if (triCenterX > rectRightHalf) {
          return 0.82;
        }
        return 0.65;
      }
    }
  }

  return 0;
}

/* ────────────────────── composite symbol analysis ────────────────────── */

export interface CompositeSymbolResult {
  type: UIComponentType;
  confidence: number;
  /** Name of the wireframe symbol pattern that was matched. */
  pattern: string;
}

/**
 * All composite pattern detectors, ordered by priority.
 * Higher-priority patterns are checked first; first match above
 * threshold (0.6) wins.
 */
const COMPOSITE_DETECTORS: {
  name: string;
  type: UIComponentType;
  detect: (strokes: StrokeInfo[]) => number;
}[] = [
  { name: 'rect_with_x',     type: 'image_placeholder', detect: detectImagePlaceholder },
  { name: 'hamburger_lines',  type: 'nav_menu',          detect: detectHamburgerMenu },
  { name: 'rect_with_waves',  type: 'text_label',        detect: detectTextBlock },
  { name: 'grid_2x2',         type: 'feature_grid',      detect: detectFeatureGrid },
  { name: 'stacked_rects',    type: 'list',              detect: detectList },
  { name: 'circle_dot',       type: 'radio',             detect: detectRadioButton },
  { name: 'square_checkmark', type: 'checkbox',          detect: detectCheckbox },
  { name: 'downward_triangle', type: 'dropdown',         detect: detectDropdown },
];

/** Minimum confidence for a composite match to override the base classifier. */
const COMPOSITE_THRESHOLD = 0.6;

/**
 * Analyze a cluster of strokes for composite wireframe symbol patterns.
 *
 * This runs on component groups (clusters from DBSCAN) that contain
 * multiple strokes. Each cluster is checked against known composite
 * patterns. If a match is found with confidence ≥ threshold, the
 * component is reclassified.
 *
 * @param strokeGroups  Array of stroke arrays (one per individual stroke in the cluster).
 * @returns The best composite match, or null if no pattern was detected.
 */
export function detectCompositeSymbol(
  strokeGroups: Point[][],
): CompositeSymbolResult | null {
  if (strokeGroups.length < 2) return null;

  // Analyze each stroke independently
  const analyzed = strokeGroups.map(s => analyzeStroke(s));

  // Run all detectors, find best match
  let bestResult: CompositeSymbolResult | null = null;
  let bestConfidence = 0;

  for (const detector of COMPOSITE_DETECTORS) {
    const confidence = detector.detect(analyzed);
    if (confidence > bestConfidence && confidence >= COMPOSITE_THRESHOLD) {
      bestConfidence = confidence;
      bestResult = {
        type: detector.type,
        confidence,
        pattern: detector.name,
      };
    }
  }

  return bestResult;
}

/**
 * Run composite symbol analysis on an array of merged component groups.
 *
 * For each group that has multiple strokes, checks if the strokes form
 * a recognized wireframe symbol. If so, upgrades the component type.
 *
 * @param components  Array of detected components (post-clustering).
 * @returns Updated array with composite symbols reclassified.
 */
export function upgradeWithCompositeSymbols(
  components: DetectedComponent[],
): DetectedComponent[] {
  return components.map(comp => {
    // Only analyze multi-stroke clusters
    if (comp.strokes.length < 2) return comp;

    const result = detectCompositeSymbol(comp.strokes);
    if (result && result.confidence > comp.confidence) {
      return {
        ...comp,
        type: result.type,
        confidence: result.confidence,
      };
    }

    return comp;
  });
}
