/**
 * DBSCAN proximity clustering for detected UI components.
 *
 * After individual strokes are classified into UI component types,
 * this module groups spatially close components together using DBSCAN
 * (Density-Based Spatial Clustering of Applications with Noise).
 */

import type { UIComponentType } from "./uiLabels.js";
import type { BoundingBox } from "./uiFeatures.js";
import type { Point } from "./normalizePath.js";

/* ────────────────────── types ────────────────────── */

export interface DetectedComponent {
  id: string;
  type: UIComponentType;
  confidence: number;
  boundingBox: BoundingBox;
  strokes: Point[][];
}

export interface ComponentGroup {
  id: string;
  components: DetectedComponent[];
  boundingBox: BoundingBox;
}

/* ────────────────────── helpers ────────────────────── */

function bboxCenter(bbox: BoundingBox): { cx: number; cy: number } {
  return {
    cx: bbox.x + bbox.width / 2,
    cy: bbox.y + bbox.height / 2,
  };
}

function distance(a: { cx: number; cy: number }, b: { cx: number; cy: number }): number {
  return Math.hypot(a.cx - b.cx, a.cy - b.cy);
}

function unionBBox(components: DetectedComponent[]): BoundingBox {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  for (const c of components) {
    minX = Math.min(minX, c.boundingBox.x);
    minY = Math.min(minY, c.boundingBox.y);
    maxX = Math.max(maxX, c.boundingBox.x + c.boundingBox.width);
    maxY = Math.max(maxY, c.boundingBox.y + c.boundingBox.height);
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/* ────────────────────── DBSCAN ────────────────────── */

/**
 * DBSCAN implementation on component bounding box centres.
 *
 * @param components  Array of detected UI components.
 * @param eps         Maximum distance between two components to be neighbours (default: 40px).
 * @param minPts      Minimum number of components to form a cluster (default: 1).
 * @returns Array of component groups.
 */
export function clusterComponents(
  components: DetectedComponent[],
  eps = 40,
  minPts = 1,
): ComponentGroup[] {
  const n = components.length;
  if (n === 0) return [];

  const centres = components.map((c) => bboxCenter(c.boundingBox));
  const labels = new Array<number>(n).fill(-1); // -1 = unvisited
  let clusterId = 0;

  for (let i = 0; i < n; i++) {
    if (labels[i] !== -1) continue;

    const neighbours = regionQuery(centres, i, eps);
    if (neighbours.length < minPts) {
      // Noise point — treat as its own cluster
      labels[i] = clusterId++;
      continue;
    }

    // Expand cluster
    const currentCluster = clusterId++;
    labels[i] = currentCluster;
    const seedSet = [...neighbours];
    const visited = new Set<number>([i]);

    while (seedSet.length > 0) {
      const j = seedSet.pop()!;
      if (visited.has(j)) continue;
      visited.add(j);

      if (labels[j] === -1) {
        labels[j] = currentCluster;
      }

      const jNeighbours = regionQuery(centres, j, eps);
      if (jNeighbours.length >= minPts) {
        for (const k of jNeighbours) {
          if (!visited.has(k)) {
            seedSet.push(k);
          }
          if (labels[k] === -1) {
            labels[k] = currentCluster;
          }
        }
      }
    }
  }

  // Group components by cluster label
  const clusterMap = new Map<number, DetectedComponent[]>();
  for (let i = 0; i < n; i++) {
    const cId = labels[i]!;
    if (!clusterMap.has(cId)) clusterMap.set(cId, []);
    clusterMap.get(cId)!.push(components[i]!);
  }

  const groups: ComponentGroup[] = [];
  let groupIdx = 0;
  for (const [, comps] of clusterMap) {
    groups.push({
      id: `group_${groupIdx++}`,
      components: comps,
      boundingBox: unionBBox(comps),
    });
  }

  return groups;
}

function regionQuery(
  centres: { cx: number; cy: number }[],
  idx: number,
  eps: number,
): number[] {
  const neighbours: number[] = [];
  const p = centres[idx]!;
  for (let i = 0; i < centres.length; i++) {
    if (i === idx) continue;
    if (distance(p, centres[i]!) <= eps) {
      neighbours.push(i);
    }
  }
  return neighbours;
}

/**
 * Merge overlapping or nearly-touching components based on bounding box
 * overlap rather than centre distance. Useful as a second-pass refinement.
 */
export function mergeOverlappingComponents(
  components: DetectedComponent[],
  overlapThreshold = 0.3,
): DetectedComponent[][] {
  const used = new Set<number>();
  const groups: DetectedComponent[][] = [];

  for (let i = 0; i < components.length; i++) {
    if (used.has(i)) continue;
    const group = [components[i]!];
    used.add(i);

    for (let j = i + 1; j < components.length; j++) {
      if (used.has(j)) continue;
      const overlap = computeOverlap(components[i]!.boundingBox, components[j]!.boundingBox);
      if (overlap > overlapThreshold) {
        group.push(components[j]!);
        used.add(j);
      }
    }

    groups.push(group);
  }

  return groups;
}

function computeOverlap(a: BoundingBox, b: BoundingBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);

  if (x2 <= x1 || y2 <= y1) return 0;

  const intersection = (x2 - x1) * (y2 - y1);
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const minArea = Math.min(areaA, areaB);

  return minArea > 0 ? intersection / minArea : 0;
}
