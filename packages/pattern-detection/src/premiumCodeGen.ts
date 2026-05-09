/**
 * Premium AI Code Generation — Prompt Engineering Layer
 *
 * Converts a LayoutNode tree + design theme into structured prompts
 * for the Claude API. The actual API call happens server-side in
 * the HTTP backend; this module is pure prompt construction.
 */

import type { LayoutNode } from "./layoutTree.js";
import type { UIComponentType } from "./uiLabels.js";

/* ────────────────────── types ────────────────────── */

export type DesignTheme =
  | 'modern-saas'
  | 'glassmorphism'
  | 'brutalist'
  | 'soft-ui'
  | 'editorial'
  | 'dark-premium';

export interface GenerationRequest {
  layoutTree: LayoutNode;
  theme: DesignTheme;
  componentName: string;
  framework: 'react' | 'html';
  pageType?: 'landing' | 'dashboard' | 'form' | 'card' | 'nav' | 'auto';
  canvasWidth?: number;
  canvasHeight?: number;
}

/* ────────────────────── theme metadata ────────────────────── */

export const DESIGN_THEMES: Record<DesignTheme, {
  label: string;
  color: string;
  description: string;
}> = {
  'modern-saas': {
    label: 'Modern SaaS',
    color: '#2563EB',
    description: 'Clean modern SaaS product UI. White background, subtle shadows, blue accent (#2563EB), Inter or Plus Jakarta Sans font, generous whitespace, sharp edges with 8px border-radius max.',
  },
  'glassmorphism': {
    label: 'Glassmorphism',
    color: '#7C3AED',
    description: 'Glassmorphism dark UI. Deep dark background (#0a0a0f), frosted glass cards (backdrop-filter: blur(20px), rgba white fill), purple/cyan gradient accents, Sora or DM Sans font.',
  },
  'brutalist': {
    label: 'Brutalist',
    color: '#000000',
    description: 'Neo-brutalist design. Pure white or yellow background, thick black borders (3-4px), bold grotesque typography (Space Grotesk), hard shadows (no blur, offset: 4px 4px), high contrast.',
  },
  'soft-ui': {
    label: 'Soft UI',
    color: '#94A3B8',
    description: 'Soft neumorphic UI. Light gray background (#e8edf2), elements appear raised via dual shadows (light top-left, dark bottom-right), muted colors, rounded-2xl everywhere, Nunito font.',
  },
  'editorial': {
    label: 'Editorial',
    color: '#DC2626',
    description: 'Editorial magazine layout. Big bold serif display font (Playfair Display or Cormorant), strong typographic hierarchy, asymmetric layout, black and one accent color only, raw grid.',
  },
  'dark-premium': {
    label: 'Dark Premium',
    color: '#D4AF37',
    description: 'Luxury dark UI. Near-black background (#08080c), gold (#D4AF37) or purple (#7C3AED) accents, premium typography (Tenor Sans or Optima), subtle grain texture via CSS, high-end feel.',
  },
};

export const VALID_THEMES = Object.keys(DESIGN_THEMES) as DesignTheme[];

/* ────────────────────── system prompt ────────────────────── */

export const PREMIUM_SYSTEM_PROMPT = `You are an elite UI engineer and designer with 15 years of experience. You produce production-grade, visually stunning UI components that look like they were designed by a senior product designer and implemented by a 10x engineer.

RULES:
- Output ONLY valid, complete, self-contained code — no explanations, no markdown fences, no comments outside the code
- For HTML: single file with embedded <style> and vanilla JS if needed
- For React: single component file with inline Tailwind classes
- Use Google Fonts via CDN (for HTML output)
- Every component must have hover states, transitions, proper shadows
- Typography must be intentional — size hierarchy, weight contrast, line-height
- Color palette must be cohesive — max 3 primary colors + neutrals
- Spacing must follow 4px/8px grid system
- Must be responsive (mobile breakpoints included)
- NO Lorem Ipsum — use realistic placeholder content relevant to the detected component types
- NO generic "Click Here" buttons — infer realistic labels from component type and context
- Add subtle micro-animations (fade-in on load, hover scale, smooth transitions)
- Include proper meta viewport tag for HTML output
- For HTML: ensure the page looks complete and polished, not like a wireframe`;

/* ────────────────────── layout serializer ────────────────────── */

/**
 * Convert a LayoutNode tree into a natural-language description
 * that preserves hierarchy, sizing, and positioning intent.
 */
export function serializeLayoutForPrompt(
  tree: LayoutNode,
  canvasWidth = 900,
  canvasHeight = 600,
): string {
  function describeNode(node: LayoutNode, depth: number = 0): string {
    const indent = '  '.repeat(depth);
    const bbox = node.component.boundingBox;
    const relativeW = Math.round((bbox.width / canvasWidth) * 100);
    const relativeH = Math.round((bbox.height / canvasHeight) * 100);

    let desc = `${indent}[${node.component.type.toUpperCase()}]`;
    desc += ` (${relativeW}% wide, ${relativeH}% tall`;
    if (node.component.confidence > 0) {
      desc += `, confidence: ${Math.round(node.component.confidence * 100)}%`;
    }
    desc += ')';

    if (node.layoutHints.isRow) desc += ' — horizontal row layout';
    if (node.layoutHints.isColumn && !node.layoutHints.isRow) desc += ' — vertical stack layout';
    if (node.layoutHints.alignment !== 'start') desc += ` [align: ${node.layoutHints.alignment}]`;

    if (node.children.length > 0) {
      desc += `\n${indent}  Contains:`;
      desc += '\n' + node.children.map(child => describeNode(child, depth + 2)).join('\n');
    }

    return desc;
  }

  return describeNode(tree);
}

/* ────────────────────── user prompt builder ────────────────────── */

/**
 * Build the complete user prompt for the Claude API call.
 */
export function buildPremiumPrompt(request: GenerationRequest): {
  system: string;
  user: string;
} {
  const canvasW = request.canvasWidth ?? 900;
  const canvasH = request.canvasHeight ?? 600;
  const layoutDescription = serializeLayoutForPrompt(request.layoutTree, canvasW, canvasH);

  const themeInfo = DESIGN_THEMES[request.theme];

  const userPrompt = `
Generate a premium ${request.framework === 'react' ? 'React component with Tailwind CSS' : 'standalone HTML page'} based on this hand-drawn sketch layout:

DETECTED LAYOUT:
${layoutDescription}

DESIGN THEME: ${themeInfo.description}

PAGE/COMPONENT TYPE HINT: ${request.pageType || 'auto-detect from components'}

COMPONENT NAME: ${request.componentName}

Requirements:
- Make it look production-ready and visually impressive — like a $500 Dribbble shot
- Infer realistic content from component types (navbar gets logo + nav links, cards get relevant titles/descriptions, buttons get action-oriented labels)
- The sketch is just a structural guide — enhance it significantly with polish
- Add micro-interactions where appropriate (hover effects, transitions, subtle animations)
- Include all necessary CSS (${request.framework === 'html' ? 'in <style> tag' : 'as Tailwind classes'})
${request.framework === 'html' ? '- Import Google Fonts in <head> via CDN link' : ''}
${request.framework === 'html' ? '- Make it a complete, standalone HTML file with <!DOCTYPE html>' : '- Export as default React functional component'}
- Output ONLY the code, nothing else — no markdown fences, no explanations
  `.trim();

  return {
    system: PREMIUM_SYSTEM_PROMPT,
    user: userPrompt,
  };
}

/* ────────────────────── helpers ────────────────────── */

/**
 * Count total nodes in a layout tree.
 */
export function countLayoutNodes(node: LayoutNode): number {
  let count = 1;
  for (const child of node.children) {
    count += countLayoutNodes(child);
  }
  return count;
}

/**
 * Strip markdown code fences from generated output if Claude
 * accidentally wraps the code in ``` blocks.
 */
export function stripCodeFences(code: string): string {
  let cleaned = code.trim();

  // Remove leading ```html or ```tsx or ```jsx etc.
  const fenceStart = /^```(?:html|tsx|jsx|react|javascript|js)?\s*\n?/;
  if (fenceStart.test(cleaned)) {
    cleaned = cleaned.replace(fenceStart, '');
  }

  // Remove trailing ```
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3).trimEnd();
  }

  return cleaned;
}
