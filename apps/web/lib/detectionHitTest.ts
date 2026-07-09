export interface DetectionBBox {
  id: string;
  boundingBox: { x: number; y: number; width: number; height: number };
}

export function bboxArea(bbox: { width: number; height: number }): number {
  return bbox.width * bbox.height;
}

export function pointInBBox(
  x: number,
  y: number,
  bbox: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    x >= bbox.x &&
    x <= bbox.x + bbox.width &&
    y >= bbox.y &&
    y <= bbox.y + bbox.height
  );
}

/** Smallest-area first — best for selecting nested / overlapping components. */
export function detectionsAtPoint<T extends DetectionBBox>(
  detections: T[],
  worldX: number,
  worldY: number,
): T[] {
  return detections
    .filter((d) => pointInBBox(worldX, worldY, d.boundingBox))
    .sort((a, b) => bboxArea(a.boundingBox) - bboxArea(b.boundingBox));
}

/** Largest first for paint order (smallest ends up on top for hit testing). */
export function sortDetectionsForHitLayer<T extends DetectionBBox>(detections: T[]): T[] {
  return [...detections].sort(
    (a, b) => bboxArea(b.boundingBox) - bboxArea(a.boundingBox),
  );
}

export function cyclePickId(
  hits: DetectionBBox[],
  session: { x: number; y: number; ids: string[]; index: number } | null,
  clientX: number,
  clientY: number,
  epsilon = 6,
): { id: string; session: { x: number; y: number; ids: string[]; index: number } } {
  const ids = hits.map((h) => h.id);
  const sameSpot =
    session != null &&
    Math.hypot(clientX - session.x, clientY - session.y) <= epsilon;
  const sameStack =
    session != null &&
    session.ids.length === ids.length &&
    session.ids.every((id, i) => id === ids[i]);

  if (hits.length === 0) {
    return { id: "", session: { x: clientX, y: clientY, ids: [], index: 0 } };
  }

  if (sameSpot && sameStack && hits.length > 1) {
    const nextIndex = (session!.index + 1) % hits.length;
    return {
      id: hits[nextIndex]!.id,
      session: { x: clientX, y: clientY, ids, index: nextIndex },
    };
  }

  return {
    id: hits[0]!.id,
    session: { x: clientX, y: clientY, ids, index: 0 },
  };
}
