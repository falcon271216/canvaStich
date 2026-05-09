/**
 * Page-Level Semantic Analysis — Section Detection & Grid Layout
 *
 * Divides detected components into semantic page sections based on
 * vertical position (navbar, hero, features, footer) and detects
 * column/grid layouts within each section.
 *
 * This module bridges raw component detection and the AI prompt,
 * providing rich page-level context for high-quality generation.
 */

import type { UIComponentType } from "./uiLabels.js";
import type { BoundingBox } from "./uiFeatures.js";
import type { DetectedComponent } from "./clustering.js";

/* ────────────────────── types ────────────────────── */

export interface PageSection {
  name: string;
  role: string;
  yRange: [number, number];
  components: DetectedComponent[];
  grid: GridLayout | null;
}

export interface GridLayout {
  type: 'row' | 'column' | 'grid';
  columns: number;
  rows: number;
  gap: number;
}

/* ────────────────────── section zones ────────────────────── */

const SECTION_ZONES = [
  { name: 'navbar',   yRange: [0,    0.10] as [number, number], role: 'navigation'    },
  { name: 'hero',     yRange: [0.10, 0.38] as [number, number], role: 'primary_cta'   },
  { name: 'section1', yRange: [0.38, 0.58] as [number, number], role: 'features'      },
  { name: 'section2', yRange: [0.58, 0.78] as [number, number], role: 'social_proof'  },
  { name: 'section3', yRange: [0.78, 0.92] as [number, number], role: 'secondary_cta' },
  { name: 'footer',   yRange: [0.92, 1.00] as [number, number], role: 'footer'        },
];

/* ────────────────────── grid detection ────────────────────── */

function computeVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
}

function detectGap(sorted: DetectedComponent[]): number {
  if (sorted.length < 2) return 0;
  let totalGap = 0;
  let count = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = sorted[i - 1]!.boundingBox.x + sorted[i - 1]!.boundingBox.width;
    const gap = sorted[i]!.boundingBox.x - prevEnd;
    if (gap > 0) {
      totalGap += gap;
      count++;
    }
  }
  return count > 0 ? Math.round(totalGap / count) : 16;
}

/**
 * Detect if components within a section form a column/grid layout.
 */
export function detectColumnGrid(components: DetectedComponent[]): GridLayout | null {
  if (components.length < 2) return null;

  const sortedByX = [...components].sort((a, b) => a.boundingBox.x - b.boundingBox.x);
  const yPositions = components.map(c => c.boundingBox.y);
  const yVariance = computeVariance(yPositions);

  // All components on roughly the same row → row layout
  if (yVariance < 900 && components.length >= 2) {
    // Check that widths are roughly similar (within 50%)
    const widths = components.map(c => c.boundingBox.width);
    const avgW = widths.reduce((a, b) => a + b, 0) / widths.length;
    const widthsUniform = widths.every(w => Math.abs(w - avgW) / avgW < 0.6);

    if (widthsUniform) {
      return {
        type: 'row',
        columns: components.length,
        rows: 1,
        gap: detectGap(sortedByX),
      };
    }
  }

  // Check for multi-row grid pattern
  // Cluster by Y position to find rows
  const yTolerance = 40;
  const rows: DetectedComponent[][] = [];
  const sortedByY = [...components].sort((a, b) => a.boundingBox.y - b.boundingBox.y);

  for (const comp of sortedByY) {
    const existingRow = rows.find(row =>
      Math.abs(row[0]!.boundingBox.y - comp.boundingBox.y) < yTolerance
    );
    if (existingRow) {
      existingRow.push(comp);
    } else {
      rows.push([comp]);
    }
  }

  if (rows.length >= 2) {
    const avgColsPerRow = rows.reduce((s, r) => s + r.length, 0) / rows.length;
    if (avgColsPerRow >= 2) {
      return {
        type: 'grid',
        columns: Math.round(avgColsPerRow),
        rows: rows.length,
        gap: detectGap(sortedByX),
      };
    }

    // Single-column stack
    return {
      type: 'column',
      columns: 1,
      rows: rows.length,
      gap: 0,
    };
  }

  return null;
}

/* ────────────────────── section detection ────────────────────── */

/**
 * Divide detected components into semantic page sections based on
 * their Y position relative to the canvas height.
 */
export function detectPageSections(
  components: DetectedComponent[],
  canvasHeight: number,
): PageSection[] {
  if (components.length === 0 || canvasHeight <= 0) return [];

  const sections: PageSection[] = SECTION_ZONES.map(zone => {
    const sectionComponents = components.filter(c => {
      const centerY = (c.boundingBox.y + c.boundingBox.height / 2) / canvasHeight;
      return centerY >= zone.yRange[0] && centerY < zone.yRange[1];
    });

    return {
      name: zone.name,
      role: zone.role,
      yRange: zone.yRange,
      components: sectionComponents,
      grid: sectionComponents.length >= 2 ? detectColumnGrid(sectionComponents) : null,
    };
  });

  // Only return sections that have components
  return sections.filter(s => s.components.length > 0);
}

/* ────────────────────── serialization ────────────────────── */

/**
 * Serialize page sections into a structured natural-language description
 * for injection into the AI prompt.
 */
export function serializePageSections(
  sections: PageSection[],
  annotations?: Record<string, { semanticLabel?: string; contentHint?: string; styleOverride?: string }>,
): string {
  return sections.map(section => {
    let header = `## ${section.name.toUpperCase()} [role: ${section.role}]`;
    if (section.grid) {
      header += ` — ${section.grid.columns}-column ${section.grid.type} layout`;
      if (section.grid.gap > 0) header += ` (${section.grid.gap}px gap)`;
    }

    const componentDescs = section.components.map(c => {
      let desc = `  - ${c.type}`;
      desc += ` (${c.boundingBox.width}×${c.boundingBox.height}px)`;

      const ann = annotations?.[c.id];
      if (ann?.semanticLabel) desc += ` → "${ann.semanticLabel}"`;
      if (ann?.contentHint)   desc += `: ${ann.contentHint}`;
      if (ann?.styleOverride) desc += ` [style: ${ann.styleOverride}]`;

      return desc;
    }).join('\n');

    return `${header}\n${componentDescs}`;
  }).join('\n\n');
}
