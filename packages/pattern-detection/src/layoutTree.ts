/**
 * Layout tree builder — containment detection + hierarchy construction.
 *
 * Takes a flat list of detected UI components and builds a tree
 * representing the DOM hierarchy by detecting spatial containment
 * (component A contains component B) and inferring layout direction.
 */

import type { DetectedComponent } from "./clustering.js";
import type { UIComponentType } from "./uiLabels.js";
import type { BoundingBox } from "./uiFeatures.js";

/* ────────────────────── types ────────────────────── */

export interface LayoutNode {
  id: string;
  component: DetectedComponent;
  children: LayoutNode[];
  layoutHints: {
    isRow: boolean;
    isColumn: boolean;
    gap: number;
    alignment: 'start' | 'center' | 'end' | 'between';
    isScrollable: boolean;
  };
  domDepth: number;
}

/* ────────────────────── helpers ────────────────────── */

function bboxArea(bbox: BoundingBox): number {
  return bbox.width * bbox.height;
}

/** Check if bbox `inner` is fully contained within bbox `outer` (with tolerance). */
function isContainedIn(inner: BoundingBox, outer: BoundingBox, tolerance = 5): boolean {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.width <= outer.x + outer.width + tolerance &&
    inner.y + inner.height <= outer.y + outer.height + tolerance
  );
}

/* ────────────────────── containment tree builder ────────────────────── */

/**
 * Build a containment tree from a flat list of detected components.
 *
 * Algorithm:
 * 1. Sort components by bounding box area (largest first)
 * 2. For each component, find the smallest parent that fully contains it
 * 3. Build a tree where children are nested inside parents
 *
 * @param components  Flat list of detected components.
 * @returns Root node of the layout tree.
 */
export function buildContainmentTree(components: DetectedComponent[]): LayoutNode {
  if (components.length === 0) {
    return createRootNode();
  }

  // Sort by area descending (largest first)
  const sorted = [...components].sort(
    (a, b) => bboxArea(b.boundingBox) - bboxArea(a.boundingBox),
  );

  // Create layout nodes
  const nodes: LayoutNode[] = sorted.map((comp, idx) => ({
    id: comp.id,
    component: comp,
    children: [],
    layoutHints: {
      isRow: false,
      isColumn: true,
      gap: 8,
      alignment: 'start' as const,
      isScrollable: false,
    },
    domDepth: 0,
  }));

  // For each node, find the smallest parent that contains it
  const parentIdx = new Array<number>(nodes.length).fill(-1);

  for (let i = 1; i < nodes.length; i++) {
    const child = nodes[i]!;
    let bestParent = -1;
    let bestArea = Infinity;

    for (let j = 0; j < i; j++) {
      const parent = nodes[j]!;
      if (isContainedIn(child.component.boundingBox, parent.component.boundingBox)) {
        const area = bboxArea(parent.component.boundingBox);
        if (area < bestArea) {
          bestArea = area;
          bestParent = j;
        }
      }
    }

    parentIdx[i] = bestParent;
  }

  // Build tree
  const roots: LayoutNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const pi = parentIdx[i]!;
    if (pi === -1) {
      roots.push(nodes[i]!);
    } else {
      nodes[pi]!.children.push(nodes[i]!);
    }
  }

  // Set domDepth
  function setDepth(node: LayoutNode, depth: number): void {
    node.domDepth = depth;
    for (const child of node.children) {
      setDepth(child, depth + 1);
    }
  }

  // If multiple roots, create a virtual container_box root
  let root: LayoutNode;
  if (roots.length === 1) {
    root = roots[0]!;
  } else {
    root = createRootNode();
    root.children = roots;
  }

  setDepth(root, 0);

  // Infer layout direction for each parent node
  inferLayoutDirections(root);

  return root;
}

/* ────────────────────── layout direction inference ────────────────────── */

const Y_THRESHOLD = 20; // px — components within this y-range are "same row"
const X_THRESHOLD = 20; // px — components within this x-range are "same column"

/**
 * Infer whether children of a node are laid out in a row or column,
 * and estimate gap and alignment.
 */
function inferLayoutDirections(node: LayoutNode): void {
  if (node.children.length < 2) {
    // Recurse into children
    for (const child of node.children) {
      inferLayoutDirections(child);
    }
    return;
  }

  const children = node.children;

  // Sort children by vertical position first
  const sortedByY = [...children].sort(
    (a, b) => a.component.boundingBox.y - b.component.boundingBox.y,
  );

  // Check if children are in a row (similar y-positions)
  const yPositions = sortedByY.map((c) => c.component.boundingBox.y);
  const yRange = Math.max(...yPositions) - Math.min(...yPositions);

  if (yRange <= Y_THRESHOLD && children.length >= 2) {
    // Row layout
    node.layoutHints.isRow = true;
    node.layoutHints.isColumn = false;

    // Sort by x-position for rows
    const sortedByX = [...children].sort(
      (a, b) => a.component.boundingBox.x - b.component.boundingBox.x,
    );
    node.children = sortedByX;

    // Estimate gap
    const gaps: number[] = [];
    for (let i = 1; i < sortedByX.length; i++) {
      const prevEnd = sortedByX[i - 1]!.component.boundingBox.x +
        sortedByX[i - 1]!.component.boundingBox.width;
      const currStart = sortedByX[i]!.component.boundingBox.x;
      gaps.push(Math.max(0, currStart - prevEnd));
    }
    node.layoutHints.gap = gaps.length > 0
      ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
      : 8;

    // Infer alignment from how children are positioned in parent
    node.layoutHints.alignment = inferRowAlignment(node, sortedByX);
  } else {
    // Column layout (default)
    node.layoutHints.isRow = false;
    node.layoutHints.isColumn = true;
    node.children = sortedByY;

    // Estimate vertical gap
    const gaps: number[] = [];
    for (let i = 1; i < sortedByY.length; i++) {
      const prevEnd = sortedByY[i - 1]!.component.boundingBox.y +
        sortedByY[i - 1]!.component.boundingBox.height;
      const currStart = sortedByY[i]!.component.boundingBox.y;
      gaps.push(Math.max(0, currStart - prevEnd));
    }
    node.layoutHints.gap = gaps.length > 0
      ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
      : 8;

    node.layoutHints.alignment = inferColumnAlignment(node, sortedByY);
  }

  // Recurse into children
  for (const child of node.children) {
    inferLayoutDirections(child);
  }
}

function inferRowAlignment(
  parent: LayoutNode,
  children: LayoutNode[],
): LayoutNode['layoutHints']['alignment'] {
  if (children.length < 2) return 'start';

  const parentBBox = parent.component.boundingBox;
  const firstChild = children[0]!.component.boundingBox;
  const lastChild = children[children.length - 1]!.component.boundingBox;

  const leftGap = firstChild.x - parentBBox.x;
  const rightGap = (parentBBox.x + parentBBox.width) - (lastChild.x + lastChild.width);

  // If roughly equal gaps on both sides → center or space-between
  if (Math.abs(leftGap - rightGap) < 20) {
    if (children.length >= 3) return 'between';
    return 'center';
  }

  if (leftGap < rightGap) return 'start';
  return 'end';
}

function inferColumnAlignment(
  parent: LayoutNode,
  children: LayoutNode[],
): LayoutNode['layoutHints']['alignment'] {
  if (children.length < 2) return 'start';

  // Check horizontal alignment of children
  const xCenters = children.map(
    (c) => c.component.boundingBox.x + c.component.boundingBox.width / 2,
  );
  const xRange = Math.max(...xCenters) - Math.min(...xCenters);
  const parentCenter = parent.component.boundingBox.x + parent.component.boundingBox.width / 2;
  const avgCenter = xCenters.reduce((a, b) => a + b, 0) / xCenters.length;

  if (xRange < X_THRESHOLD) {
    // All aligned — check if centered in parent
    if (Math.abs(avgCenter - parentCenter) < 20) return 'center';
    if (avgCenter < parentCenter) return 'start';
    return 'end';
  }

  return 'start';
}

/* ────────────────────── virtual root node ────────────────────── */

function createRootNode(): LayoutNode {
  return {
    id: 'root',
    component: {
      id: 'root',
      type: 'container_box' as UIComponentType,
      confidence: 1,
      boundingBox: { x: 0, y: 0, width: 0, height: 0 },
      strokes: [],
    },
    children: [],
    layoutHints: {
      isRow: false,
      isColumn: true,
      gap: 16,
      alignment: 'start',
      isScrollable: false,
    },
    domDepth: 0,
  };
}

/**
 * Flatten a layout tree into a list of all nodes (DFS order).
 */
export function flattenTree(node: LayoutNode): LayoutNode[] {
  const result: LayoutNode[] = [node];
  for (const child of node.children) {
    result.push(...flattenTree(child));
  }
  return result;
}

/**
 * Find a node in the tree by ID.
 */
export function findNodeById(root: LayoutNode, id: string): LayoutNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

/**
 * Update a node's component type (manual override).
 */
export function updateNodeType(
  root: LayoutNode,
  nodeId: string,
  newType: UIComponentType,
): boolean {
  const node = findNodeById(root, nodeId);
  if (!node) return false;
  node.component.type = newType;
  return true;
}
