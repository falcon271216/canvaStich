/**
 * Premium AI Code Generation v2 — Full-Page Prompt Engineering
 *
 * Converts layout tree + purpose + design theme into structured prompts
 * for Gemini. Preserves sketch positions (~90%) while theming content
 * to the user's stated product purpose.
 */

import type { LayoutNode } from "./layoutTree.js";

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
  /** What the UI is for — e.g. "weather app", "college website". Themes all copy/fields. */
  purpose?: string;
}

/* ────────────────────── rich theme specs ────────────────────── */

interface ThemeSpec {
  label: string;
  color: string;
  description: string;
  font: string;
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  borderRadius: string;
  shadows: string;
  special: string;
}

export const DESIGN_THEMES: Record<DesignTheme, ThemeSpec> = {
  'modern-saas': {
    label: 'Modern SaaS',
    color: '#2563EB',
    description: 'Clean modern SaaS. White background, blue accents, lots of whitespace.',
    font: 'Plus Jakarta Sans',
    primary: '#2563EB',
    secondary: '#7C3AED',
    background: '#FFFFFF',
    surface: '#F8FAFC',
    borderRadius: '10px',
    shadows: 'soft multi-layer (0 1px 3px rgba(0,0,0,0.1), 0 20px 40px rgba(0,0,0,0.08))',
    special: 'Accent gradient text on headlines. Subtle grid dot pattern background.',
  },
  'glassmorphism': {
    label: 'Glassmorphism',
    color: '#7C3AED',
    description: 'Dark glass aesthetic. Deep background, frosted elements, neon accents.',
    font: 'Sora',
    primary: '#A855F7',
    secondary: '#06B6D4',
    background: 'linear-gradient(135deg, #0a0a0f 0%, #0d0a1a 50%, #050d1a 100%)',
    surface: 'rgba(255,255,255,0.05)',
    borderRadius: '16px',
    shadows: 'glow shadows (0 0 30px rgba(168,85,247,0.2))',
    special: 'backdrop-filter: blur(20px) on cards. Gradient borders. Soft ambient orbs (decorative only).',
  },
  'brutalist': {
    label: 'Brutalist',
    color: '#000000',
    description: 'Neo-brutalist. Raw, bold, high contrast. Black borders everything.',
    font: 'Space Grotesk',
    primary: '#FACC15',
    secondary: '#EF4444',
    background: '#FFFFFF',
    surface: '#F5F5F5',
    borderRadius: '0px',
    shadows: 'hard offset (4px 4px 0px #000000)',
    special: 'Thick 3px black borders on ALL elements. No border-radius. Offset shadows only.',
  },
  'soft-ui': {
    label: 'Soft UI',
    color: '#94A3B8',
    description: 'Soft neumorphic. Light gray base, raised/inset elements, calming.',
    font: 'Nunito',
    primary: '#6366F1',
    secondary: '#EC4899',
    background: '#E8ECF0',
    surface: '#E8ECF0',
    borderRadius: '16px',
    shadows: 'neumorphic (8px 8px 16px #c5c9cd, -8px -8px 16px #ffffff)',
    special: 'Both light and dark shadows for neumorphic depth. Inset variant for pressed states.',
  },
  'editorial': {
    label: 'Editorial',
    color: '#DC2626',
    description: 'Magazine editorial. Bold typography, asymmetric layout, raw grid, one accent.',
    font: 'Playfair Display',
    primary: '#DC2626',
    secondary: '#171717',
    background: '#FAF9F6',
    surface: '#F0EEE9',
    borderRadius: '2px',
    shadows: 'none or very subtle',
    special: 'Strong display typography. High contrast sections. Stay within sketched regions.',
  },
  'dark-premium': {
    label: 'Dark Premium',
    color: '#D4AF37',
    description: 'Luxury dark. Near-black, gold accents, premium typography, high-end feel.',
    font: 'Cormorant Garamond',
    primary: '#D4AF37',
    secondary: '#C0C0C0',
    background: '#080808',
    surface: '#111111',
    borderRadius: '4px',
    shadows: 'subtle gold glow (0 0 40px rgba(212,175,55,0.1))',
    special: 'Gold gradient accents. Thin elegant borders. Serif display font for headings.',
  },
};

export const VALID_THEMES = Object.keys(DESIGN_THEMES) as DesignTheme[];

/* ────────────────────── system prompt ────────────────────── */

export const PREMIUM_SYSTEM_PROMPT = `You are an elite UI engineer who turns hand-drawn wireframes into production UI.

HIGHEST PRIORITY — SKETCH FIDELITY (≈90%):
- The DETECTED LAYOUT is a spatial map of what the user drew. Treat it as law.
- Place EVERY component using absolute (or equivalent) positioning that matches left%/top%/width%/height% from the layout.
- Do NOT invent extra sections, columns, heroes, stats strips, or marketing blocks that are not in the layout.
- Do NOT rearrange, restack, or center everything into a generic landing page.
- Hierarchy from the tree may nest children inside parents; children must stay inside the parent's box.
- Allow ≈10% improvisation only for: padding, fonts, colors, realistic copy, hover states, and small visual polish INSIDE each box.

PURPOSE THEMING:
- The PURPOSE field defines the product domain (e.g. weather app, college website).
- ALL visible text, labels, placeholders, nav links, button copy, and field meanings MUST match that purpose.
- Example: purpose "weather" → navbar "Weather", search "Search city…", cards temperature/conditions — still in the same boxes.
- Example: purpose "college website" → navbar college name, hero admissions, inputs student email/course — same boxes.
- Match purpose to component types: input_field → domain-relevant fields; button → domain CTAs; table → domain data; etc.

ABSOLUTE RULES:
- Output ONLY valid, complete, self-contained code — no explanations, no markdown fences
- For HTML: single complete file with embedded <style> and vanilla JS. Import Google Fonts via CDN.
- For React: single component function with inline Tailwind CSS classes. NO import/export statements. Use React.useState etc. from global React.
- MUST include meta viewport for HTML
- Root canvas: position relative; fixed aspect matching the wireframe canvas size. Components positioned absolute with % units from layout.
- ALL tags closed; never truncate
- Every interactive element has hover/focus states (0.2–0.3s)
- NO Lorem Ipsum — realistic purpose-specific content only
- Images: use REPLACE_ME_* constants for img src — no external http(s) image URLs
- Mobile: may stack only if needed under 640px, but desktop (≥768px) MUST mirror sketch positions`;

/* ────────────────────── layout serializer ────────────────────── */

/**
 * Convert a LayoutNode tree into a spatial description with % positions
 * so the model can place components where the sketch is.
 */
export function serializeLayoutForPrompt(
  tree: LayoutNode,
  canvasWidth = 900,
  canvasHeight = 600,
): string {
  function describeNode(node: LayoutNode, depth: number = 0): string {
    const indent = '  '.repeat(depth);
    const bbox = node.component.boundingBox;
    const left = Math.round((bbox.x / canvasWidth) * 1000) / 10;
    const top = Math.round((bbox.y / canvasHeight) * 1000) / 10;
    const relativeW = Math.round((bbox.width / canvasWidth) * 1000) / 10;
    const relativeH = Math.round((bbox.height / canvasHeight) * 1000) / 10;

    let desc = `${indent}[${node.component.type.toUpperCase()}]`;
    desc += ` position: left ${left}%, top ${top}%, width ${relativeW}%, height ${relativeH}%`;
    desc += ` (px: x=${Math.round(bbox.x)}, y=${Math.round(bbox.y)}, w=${Math.round(bbox.width)}, h=${Math.round(bbox.height)}`;
    if (node.component.confidence > 0) {
      desc += `, confidence: ${Math.round(node.component.confidence * 100)}%`;
    }
    desc += ')';

    if (node.layoutHints.isRow) desc += ' — horizontal row inside this box';
    if (node.layoutHints.isColumn && !node.layoutHints.isRow) desc += ' — vertical stack inside this box';
    if (node.layoutHints.alignment !== 'start') desc += ` [align: ${node.layoutHints.alignment}]`;

    if (node.children.length > 0) {
      desc += `\n${indent}  Contains:`;
      desc += '\n' + node.children.map(child => describeNode(child, depth + 2)).join('\n');
    }

    return desc;
  }

  return [
    `Canvas size: ${canvasWidth}×${canvasHeight}px (use this as the root frame)`,
    `Place each node at the listed left%/top%/width%/height% relative to the canvas.`,
    describeNode(tree),
  ].join('\n');
}

/* ────────────────────── full page prompt builder ────────────────────── */

/**
 * Build the complete prompt with purpose theming + positional fidelity.
 */
export function buildPremiumPrompt(request: GenerationRequest): {
  system: string;
  user: string;
} {
  const canvasW = request.canvasWidth ?? 900;
  const canvasH = request.canvasHeight ?? 600;
  const layoutDescription = serializeLayoutForPrompt(request.layoutTree, canvasW, canvasH);
  const themeSpec = DESIGN_THEMES[request.theme];
  const purpose = (request.purpose || '').trim() || 'general product UI (infer carefully from layout types only)';

  const userPrompt = `
Generate a ${request.framework === 'react' ? 'React component with Tailwind CSS' : 'standalone HTML page'} from this hand-drawn wireframe.

## PURPOSE (theme all content & meaning to this — do not invent other products)
${purpose}

## DETECTED LAYOUT (spatial map — ≈90% fidelity REQUIRED)
${layoutDescription}

## POSITIONING RULES (CRITICAL)
1. Root container: width ${canvasW}px (max-width 100%), height ${canvasH}px (or aspect-ratio ${canvasW}/${canvasH}), position: relative; overflow: hidden.
2. Every component MUST use position:absolute (or Tailwind absolute) with left/top/width/height matching the % values above (±10% max drift).
3. Do NOT add components that are not listed. Do NOT remove listed components.
4. Nested children must stay inside their parent box.
5. The remaining ≈10% budget is only for styling, typography, icons, and purpose-specific copy INSIDE those boxes.

## DESIGN SYSTEM
Theme: ${themeSpec.label} — ${themeSpec.description}
Font: ${themeSpec.font} (import from Google Fonts CDN)
Primary Color: ${themeSpec.primary}
Secondary Color: ${themeSpec.secondary}
Background: ${themeSpec.background}
Surface: ${themeSpec.surface}
Border Radius: ${themeSpec.borderRadius}
Shadow Style: ${themeSpec.shadows}
Special Effects: ${themeSpec.special}

## PAGE/COMPONENT TYPE HINT
${request.pageType || 'derive only from detected component types — do not invent sections'}

## COMPONENT NAME
${request.componentName}

## CONTENT RULES
- Every label, heading, placeholder, button, and nav item MUST sound like a "${purpose}" product
- Example mappings: weather → city, forecast, °C; college → admissions, courses, campus; ecommerce → cart, price, product
- NO Lorem Ipsum; NO generic SaaS marketing if it conflicts with PURPOSE
- Prefer short, precise copy that fits the sketched box sizes

## OUTPUT
${request.framework === 'html' ?
    'Output a single complete HTML file. Embed ALL CSS in <style> tags. Import fonts from Google Fonts CDN via <link> tag. Include <!DOCTYPE html>. No external JS dependencies. ALL HTML tags properly closed. End with </html>.' :
    `Output a single React functional component named "${request.componentName}". Use Tailwind CSS utility classes.

CRITICAL React Rules:
- Do NOT use any import or export statements (React and ReactDOM are globals)
- Use React.useState, React.useEffect, React.useRef — NOT destructured hooks
- Define: function ${request.componentName}() { ... }
- No TypeScript syntax
- Keep sub-components in the same file as regular functions
- ALL JSX tags closed
- Return a single root element sized to the canvas`}
Output ONLY the code — no markdown fences, no explanations.
IMPORTANT: Code must be COMPLETE with all tags/braces closed. Do not truncate.
  `.trim();

  return {
    system: PREMIUM_SYSTEM_PROMPT,
    user: userPrompt,
  };
}

/* ────────────────────── helpers ────────────────────── */

export function countLayoutNodes(node: LayoutNode): number {
  let count = 1;
  for (const child of node.children) {
    count += countLayoutNodes(child);
  }
  return count;
}

export function stripCodeFences(code: string): string {
  let cleaned = code.trim();

  const fenceStart = /^```(?:html|tsx|jsx|react|javascript|js)?\s*\n?/;
  if (fenceStart.test(cleaned)) {
    cleaned = cleaned.replace(fenceStart, '');
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3).trimEnd();
  }

  return cleaned;
}
