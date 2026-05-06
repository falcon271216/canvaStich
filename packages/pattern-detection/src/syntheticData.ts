/**
 * Synthetic stroke data generator for all 14 UI component classes.
 *
 * Since no hand-drawn UI-component dataset exists, we programmatically
 * generate stroke sequences that mimic how a user would sketch each
 * component type. Gaussian noise (σ = 2–5 px) and random speed profiles
 * simulate natural drawing variation.
 */

import type { Point } from "./normalizePath.js";

/* ────────────────── utilities ────────────────── */

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function gaussianNoise(sigma: number): number {
  // Box-Muller transform
  const u1 = Math.random() || 1e-10;
  const u2 = Math.random();
  return sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function addNoise(points: Point[], sigma: number): Point[] {
  return points.map((p) => ({
    x: p.x + gaussianNoise(sigma),
    y: p.y + gaussianNoise(sigma),
    t: p.t,
  }));
}

/**
 * Generate timestamps for a path, simulating a natural drawing speed.
 * Slow at start/end, faster in the middle.
 */
function addTimestamps(points: Point[], baseDurationMs: number): Point[] {
  const n = points.length;
  if (n === 0) return points;
  let t = 0;
  return points.map((p, i) => {
    if (i === 0) return { ...p, t: 0 };
    // Slow-fast-slow profile using sine curve
    const progress = i / (n - 1);
    const speedFactor = 0.5 + 0.5 * Math.sin(Math.PI * progress);
    const dt = (baseDurationMs / n) * (1.5 - speedFactor);
    t += dt + rand(0, 5); // small random jitter
    return { ...p, t };
  });
}

/**
 * Generate points along a rectangle path (clockwise).
 */
function rectanglePath(
  x: number,
  y: number,
  w: number,
  h: number,
  pointsPerSide = 12,
): Point[] {
  const pts: Point[] = [];
  // Top edge
  for (let i = 0; i <= pointsPerSide; i++) {
    pts.push({ x: x + (w * i) / pointsPerSide, y });
  }
  // Right edge
  for (let i = 1; i <= pointsPerSide; i++) {
    pts.push({ x: x + w, y: y + (h * i) / pointsPerSide });
  }
  // Bottom edge
  for (let i = 1; i <= pointsPerSide; i++) {
    pts.push({ x: x + w - (w * i) / pointsPerSide, y: y + h });
  }
  // Left edge
  for (let i = 1; i <= pointsPerSide; i++) {
    pts.push({ x, y: y + h - (h * i) / pointsPerSide });
  }
  return pts;
}

/**
 * Generate a horizontal line.
 */
function linePath(x1: number, y1: number, x2: number, y2: number, numPoints = 20): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    pts.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t });
  }
  return pts;
}

/**
 * Generate a circle path.
 */
function circlePath(cx: number, cy: number, r: number, numPoints = 32): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const theta = (2 * Math.PI * i) / numPoints;
    pts.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) });
  }
  return pts;
}

/**
 * Generate a zigzag path (simulates handwritten text).
 */
function zigzagPath(x: number, y: number, w: number, amplitude: number, numZigs = 8): Point[] {
  const pts: Point[] = [];
  const segW = w / numZigs;
  for (let i = 0; i <= numZigs; i++) {
    const px = x + segW * i;
    const py = y + (i % 2 === 0 ? -amplitude : amplitude);
    pts.push({ x: px, y: py });
  }
  return pts;
}

/* ────────────────── stroke generators ────────────────── */

export interface SyntheticSample {
  label: string;
  strokes: Point[][];
}

function generateButtonStroke(): Point[][] {
  const w = rand(80, 200);
  const h = rand(30, 60);
  const x = rand(50, 400);
  const y = rand(50, 400);
  const pts = rectanglePath(x, y, w, h, 10);
  const withTime = addTimestamps(pts, rand(800, 2000));
  return [addNoise(withTime, rand(2, 4))];
}

function generateInputFieldStroke(): Point[][] {
  const w = rand(150, 350);
  const h = rand(25, 50);
  const x = rand(50, 300);
  const y = rand(50, 400);
  const pts = rectanglePath(x, y, w, h, 12);
  const withTime = addTimestamps(pts, rand(1000, 2500));
  return [addNoise(withTime, rand(2, 4))];
}

function generateCheckboxStroke(): Point[][] {
  const size = rand(15, 35);
  const x = rand(50, 500);
  const y = rand(50, 500);
  // Square
  const box = rectanglePath(x, y, size, size, 6);
  const strokes: Point[][] = [addNoise(addTimestamps(box, rand(500, 1000)), rand(2, 3))];
  // Optionally add a checkmark inside
  if (Math.random() > 0.4) {
    const check: Point[] = [
      { x: x + size * 0.2, y: y + size * 0.5 },
      { x: x + size * 0.4, y: y + size * 0.75 },
      { x: x + size * 0.85, y: y + size * 0.2 },
    ];
    strokes.push(addNoise(addTimestamps(check, rand(300, 600)), rand(2, 3)));
  }
  return strokes;
}

function generateRadioStroke(): Point[][] {
  const r = rand(8, 20);
  const cx = rand(50, 500);
  const cy = rand(50, 500);
  const pts = circlePath(cx, cy, r, 24);
  return [addNoise(addTimestamps(pts, rand(500, 1200)), rand(2, 3))];
}

function generateDropdownStroke(): Point[][] {
  const w = rand(120, 250);
  const h = rand(30, 50);
  const x = rand(50, 400);
  const y = rand(50, 400);
  // Main rectangle
  const box = rectanglePath(x, y, w, h, 10);
  const strokes: Point[][] = [addNoise(addTimestamps(box, rand(800, 1800)), rand(2, 4))];
  // Small downward triangle/arrow on right side
  const arrowX = x + w - 20;
  const arrowY = y + h * 0.3;
  const arrow: Point[] = [
    { x: arrowX - 6, y: arrowY },
    { x: arrowX, y: arrowY + 10 },
    { x: arrowX + 6, y: arrowY },
  ];
  strokes.push(addNoise(addTimestamps(arrow, rand(200, 400)), rand(1, 3)));
  return strokes;
}

function generateCardStroke(): Point[][] {
  const w = rand(180, 350);
  const h = rand(150, 300);
  const x = rand(50, 300);
  const y = rand(50, 300);
  const pts = rectanglePath(x, y, w, h, 14);
  return [addNoise(addTimestamps(pts, rand(1200, 3000)), rand(3, 5))];
}

function generateNavbarStroke(): Point[][] {
  const w = rand(400, 700);
  const h = rand(35, 60);
  const x = rand(20, 100);
  const y = rand(10, 50);
  const pts = rectanglePath(x, y, w, h, 16);
  return [addNoise(addTimestamps(pts, rand(1500, 3000)), rand(3, 5))];
}

function generateModalStroke(): Point[][] {
  const w = rand(200, 400);
  const h = rand(180, 350);
  const x = rand(100, 250);
  const y = rand(80, 200);
  // Main rectangle
  const box = rectanglePath(x, y, w, h, 14);
  const strokes: Point[][] = [addNoise(addTimestamps(box, rand(1500, 3000)), rand(3, 5))];
  // X button in top-right corner
  const xSize = 12;
  const xX = x + w - 25;
  const xY = y + 10;
  const cross1 = linePath(xX, xY, xX + xSize, xY + xSize, 8);
  const cross2 = linePath(xX + xSize, xY, xX, xY + xSize, 8);
  strokes.push(addNoise(addTimestamps(cross1, rand(200, 400)), rand(1, 2)));
  strokes.push(addNoise(addTimestamps(cross2, rand(200, 400)), rand(1, 2)));
  return strokes;
}

function generateTextLabelStroke(): Point[][] {
  const x = rand(50, 400);
  const y = rand(50, 500);
  const w = rand(60, 200);
  const pts = zigzagPath(x, y, w, rand(2, 5), Math.floor(rand(4, 10)));
  return [addNoise(addTimestamps(pts, rand(400, 1000)), rand(2, 4))];
}

function generateImagePlaceholderStroke(): Point[][] {
  const w = rand(100, 250);
  const h = rand(80, 200);
  const x = rand(50, 400);
  const y = rand(50, 400);
  // Rectangle
  const box = rectanglePath(x, y, w, h, 10);
  const strokes: Point[][] = [addNoise(addTimestamps(box, rand(1000, 2000)), rand(3, 5))];
  // Diagonal cross (X) inside
  const d1 = linePath(x + 5, y + 5, x + w - 5, y + h - 5, 12);
  const d2 = linePath(x + w - 5, y + 5, x + 5, y + h - 5, 12);
  strokes.push(addNoise(addTimestamps(d1, rand(300, 600)), rand(2, 3)));
  strokes.push(addNoise(addTimestamps(d2, rand(300, 600)), rand(2, 3)));
  return strokes;
}

function generateTableStroke(): Point[][] {
  const x = rand(50, 300);
  const y = rand(50, 300);
  const w = rand(200, 400);
  const h = rand(150, 300);
  const rows = Math.floor(rand(2, 5));
  const cols = Math.floor(rand(2, 4));
  const strokes: Point[][] = [];
  // Outer rectangle
  strokes.push(addNoise(addTimestamps(rectanglePath(x, y, w, h, 12), rand(1000, 2000)), rand(2, 4)));
  // Horizontal lines
  for (let r = 1; r < rows; r++) {
    const ly = y + (h * r) / rows;
    strokes.push(addNoise(addTimestamps(linePath(x, ly, x + w, ly, 10), rand(300, 600)), rand(2, 3)));
  }
  // Vertical lines
  for (let c = 1; c < cols; c++) {
    const lx = x + (w * c) / cols;
    strokes.push(addNoise(addTimestamps(linePath(lx, y, lx, y + h, 10), rand(300, 600)), rand(2, 3)));
  }
  return strokes;
}

function generateDividerStroke(): Point[][] {
  const x = rand(50, 200);
  const y = rand(50, 500);
  const w = rand(200, 500);
  const pts = linePath(x, y, x + w, y + rand(-3, 3), 16);
  return [addNoise(addTimestamps(pts, rand(400, 1000)), rand(2, 4))];
}

function generateArrowConnectorStroke(): Point[][] {
  const x1 = rand(50, 300);
  const y1 = rand(50, 500);
  const x2 = x1 + rand(80, 300);
  const y2 = y1 + rand(-50, 50);
  // Main line
  const line = linePath(x1, y1, x2, y2, 16);
  const strokes: Point[][] = [addNoise(addTimestamps(line, rand(500, 1200)), rand(2, 4))];
  // Arrowhead
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = rand(10, 20);
  const arrowPts: Point[] = [
    { x: x2 - headLen * Math.cos(angle - 0.4), y: y2 - headLen * Math.sin(angle - 0.4) },
    { x: x2, y: y2 },
    { x: x2 - headLen * Math.cos(angle + 0.4), y: y2 - headLen * Math.sin(angle + 0.4) },
  ];
  strokes.push(addNoise(addTimestamps(arrowPts, rand(200, 400)), rand(1, 3)));
  return strokes;
}

function generateContainerBoxStroke(): Point[][] {
  const w = rand(250, 500);
  const h = rand(200, 400);
  const x = rand(30, 200);
  const y = rand(30, 200);
  const pts = rectanglePath(x, y, w, h, 16);
  return [addNoise(addTimestamps(pts, rand(1500, 3500)), rand(3, 5))];
}

/* ────────────────── main API ────────────────── */

type GeneratorFn = () => Point[][];

const GENERATORS: Record<string, GeneratorFn> = {
  button: generateButtonStroke,
  input_field: generateInputFieldStroke,
  checkbox: generateCheckboxStroke,
  radio: generateRadioStroke,
  dropdown: generateDropdownStroke,
  card: generateCardStroke,
  navbar: generateNavbarStroke,
  modal: generateModalStroke,
  text_label: generateTextLabelStroke,
  image_placeholder: generateImagePlaceholderStroke,
  table: generateTableStroke,
  divider: generateDividerStroke,
  arrow_connector: generateArrowConnectorStroke,
  container_box: generateContainerBoxStroke,
};

/**
 * Generate synthetic stroke samples for a given component type.
 *
 * @param label  The UI component type to generate.
 * @param count  Number of samples to generate.
 * @returns Array of synthetic samples.
 */
export function generateSyntheticStrokes(label: string, count: number): SyntheticSample[] {
  const gen = GENERATORS[label];
  if (!gen) throw new Error(`No generator for label: ${label}`);
  const samples: SyntheticSample[] = [];
  for (let i = 0; i < count; i++) {
    samples.push({ label, strokes: gen() });
  }
  return samples;
}

/**
 * Generate a full synthetic dataset for all 14 UI component types.
 *
 * @param samplesPerClass  Number of samples per class (default: 500).
 */
export function generateFullDataset(samplesPerClass = 500): SyntheticSample[] {
  const dataset: SyntheticSample[] = [];
  for (const label of Object.keys(GENERATORS)) {
    dataset.push(...generateSyntheticStrokes(label, samplesPerClass));
  }
  return dataset;
}
