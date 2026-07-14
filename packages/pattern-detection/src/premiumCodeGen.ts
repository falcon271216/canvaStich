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

export const PREMIUM_SYSTEM_PROMPT = `You are an elite product designer + UI engineer (Stripe / Linear / Vercel level). You turn wireframes into premium SaaS product UI — polished, dense with craft, never a bare wireframe.

LAYOUT FIDELITY (≈90% structure — not visual plainness):
- DETECTED LAYOUT is a spatial map. Keep each component's left%/top%/width%/height% (±10%).
- Do NOT invent entire new sections missing from the layout.
- Do NOT flatten everything into a generic marketing page.
- Nested children stay inside parent boxes.
- Inside each box you MUST design a premium product surface (not empty bordered rectangles).

PREMIUM SAAS VISUAL QUALITY (NON-NEGOTIABLE):
- Look like a shipped $50k product UI: layered shadows, soft borders, refined typography, clear hierarchy, purposeful whitespace INSIDE boxes.
- Navbar: logo wordmark + nav links + primary CTA pill; subtle bottom border or glass blur; height-fitting padding.
- Buttons: gradient or solid primary, px-5 py-2.5, font-semibold, shadow-sm, hover:brightness/scale, focus ring.
- Inputs/search: labeled or floating placeholder, 1px border, focus:ring-2 with primary/30, rounded-xl, subtle bg.
- Cards/containers: rounded-2xl, soft multi-layer shadow, light border, inner padding 20–28px, optional header + badge.
- Footer: darker surface, link columns or compact legal row matching the box size.
- Background: subtle gradient mesh OR soft radial wash OR faint grid — never barren flat gray.
- Typography: display headings bold (tracking-tight), body readable, muted secondary text (#64748B range).
- Micro-polish: hover lifts on cards, smooth 200ms transitions, active states, occasional subtle badge/pill.
- Use theme colors precisely. Icons as inline SVG or Unicode — sharp and on-brand.
- NO Lorem Ipsum. NO unlabeled “Button” / “Text”. NO empty white boxes with thin gray strokes only.

PURPOSE THEMING:
- PURPOSE defines the product domain. All copy, fields, and CTAs must match it while staying in the sketched boxes.
- weather → temps, city search, conditions; college → admissions, courses, campus; etc.

OUTPUT RULES:
- ONLY valid complete code — no markdown fences, no commentary
- HTML: full document, Google Fonts <link>, all CSS in <style>, meta viewport
- React: one component function, Tailwind utility classes only for styling, NO import/export, use React.useState / React.useEffect / React.useRef
- Root: position relative, canvas-sized frame; children absolute with % matching layout
- Desktop (≥768px) mirrors sketch positions; mobile may gently adapt under 640px
- Images: REPLACE_ME_* src constants only — no external http(s) image URLs
- Every interactive control has hover + focus styles`;

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

## POSITIONING RULES (structure only)
1. Root container: width ${canvasW}px (max-width 100%), min-height ${canvasH}px (aspect-ratio ${canvasW}/${canvasH}), position: relative; overflow: hidden.
2. Place each listed component with absolute positioning using the left%/top%/width%/height% values (±10%).
3. Do NOT add or remove components from the layout list.
4. Nested children stay inside their parent.
5. Visual budget inside each box is FREE for premium SaaS craft — fill every region with designed content, not empty strokes.

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

## PREMIUM SAAS REQUIREMENTS (must look expensive)
- Root background uses the theme background + a subtle decorative layer (gradient mesh, soft blobs, or dotted grid at low opacity)
- Surfaces use ${themeSpec.surface} with ${themeSpec.shadows} and hairline borders
- Typography hierarchy: large tight headings, muted body, tiny uppercase labels where appropriate
- Primary buttons use ${themeSpec.primary}; secondary uses outline/ghost
- Cards/modals feel elevated (padding, radius ${themeSpec.borderRadius}, hover shadow deepening)
- Search bars include icon + placeholder + optional filter chip
- Nav feels productized (logo mark + links + CTA), not a raw rectangle
- Footers use darker contrast surface with readable link hierarchy
- ${themeSpec.special}
- Anti-patterns forbidden: unstyled div borders only, default browser buttons, gray-on-gray empty panels, Lorem Ipsum, “Click me”, “Title”

## PAGE/COMPONENT TYPE HINT
${request.pageType || 'derive only from detected component types — do not invent sections'}

## COMPONENT NAME
${request.componentName}

## CONTENT RULES
- Every label, heading, placeholder, button, and nav item MUST sound like a "${purpose}" product
- Example mappings: weather → city, forecast, °C; college → admissions, courses, campus; ecommerce → cart, price, product
- Dense but readable copy sized to fit each sketched box

## OUTPUT
${request.framework === 'html' ?
    `Output a single complete HTML file:
- <!DOCTYPE html>, meta viewport, Google Fonts link for "${themeSpec.font}"
- All CSS embedded in <style> — use CSS variables for primary/secondary/surface
- Rich CSS (gradients, shadows, transitions) — not minimal reset-only styles
- Optional tiny vanilla JS for hover/nav if needed
- ALL tags closed; end with </html>` :
    `Output a single React functional component named "${request.componentName}" using Tailwind CSS utilities heavily (gradients, shadows, rings, rounded-2xl, backdrop-blur, font-semibold, tracking-tight).

CRITICAL React Rules:
- Do NOT use import or export (React / ReactDOM are globals)
- Use React.useState, React.useEffect, React.useRef — never bare useState
- Define: function ${request.componentName}() { ... }
- Plain JavaScript only — NO TypeScript types/interfaces
- Subcomponents as plain functions in the same file
- Root element must use className with relative + explicit width/height matching the canvas
- Children use absolute + style={{left:'..%', top:'..%', width:'..%', height:'..%'}} OR Tailwind inset equivalents matching layout %
- Style EVERY box like Linear/Stripe UI — never leave a naked border box`}
Output ONLY the code — no markdown fences, no explanations.
IMPORTANT: COMPLETE code with all tags/braces closed. Do not truncate.
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
