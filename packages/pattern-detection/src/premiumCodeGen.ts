/**
 * Premium AI Code Generation v2 — Full-Page Prompt Engineering
 *
 * Converts page sections + annotations + design theme into rich
 * structured prompts for the Gemini API. Produces prompts that
 * generate $50k-quality production UI.
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
    special: 'Blue gradient text on hero headline. Subtle grid dot pattern background.',
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
    special: 'backdrop-filter: blur(20px) on cards. Gradient borders. Animated gradient orbs in background.',
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
    special: 'HUGE display text (8rem+). Asymmetric columns. Black background sections for contrast.',
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
    special: 'Gold gradient accents. Thin elegant borders. Serif display font for headings. Grain texture overlay.',
  },
};

export const VALID_THEMES = Object.keys(DESIGN_THEMES) as DesignTheme[];

/* ────────────────────── system prompt ────────────────────── */

export const PREMIUM_SYSTEM_PROMPT = `You are an elite UI engineer and designer with 15 years of experience at companies like Stripe, Linear, and Vercel. You produce production-grade, visually stunning UI that looks like a $50,000 professionally designed website.

ABSOLUTE RULES:
- Output ONLY valid, complete, self-contained code — no explanations, no markdown fences, no comments outside the code
- For HTML: single file with embedded <style> and vanilla JS. Import Google Fonts via CDN.
- For React: single component file with inline Tailwind CSS classes
- MUST include meta viewport tag for HTML output
- MUST be fully responsive with mobile breakpoints

DESIGN QUALITY STANDARDS:
- Every component MUST have hover states, transitions (0.2s ease), proper shadows
- Typography: intentional size hierarchy (12/14/16/20/24/32/48/64px), weight contrast, line-height
- Color palette: max 3 primary colors + neutral text scale. Must be cohesive.
- Spacing: strict 4px/8px grid system. Generous padding and margins.
- Micro-animations: fade-in on load, hover scale/lift, smooth transitions
- NO Lorem Ipsum — use realistic, compelling placeholder content
- NO generic "Click Here" buttons — infer contextually accurate labels
- Hero headlines must be specific and compelling (e.g. "Ship your SaaS 10x faster")
- Add realistic data to tables, charts, stats

COMPONENT QUALITY:
- navbar: logo (stylized text), nav links, CTA button, mobile hamburger
- hero: big headline (gradient text if dark theme), subtext, primary + secondary CTA, decorative background element
- card: proper padding, icon/image area, title, description, subtle border + shadow, hover lift effect
- button: gradient or solid with hover state, proper padding, border-radius, transition
- form inputs: label above, proper border, focus ring with accent color, placeholder text
- footer: logo, multi-column links, social icons, copyright line, top border separator
- tables: header row styling, alternating row colors, proper cell padding
- avatars: initials-based circular components (no external images)`;

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

/* ────────────────────── full page prompt builder ────────────────────── */

/**
 * Build the complete prompt with rich design specs and page structure.
 */
export function buildPremiumPrompt(request: GenerationRequest): {
  system: string;
  user: string;
} {
  const canvasW = request.canvasWidth ?? 900;
  const canvasH = request.canvasHeight ?? 600;
  const layoutDescription = serializeLayoutForPrompt(request.layoutTree, canvasW, canvasH);
  const themeSpec = DESIGN_THEMES[request.theme];

  const userPrompt = `
Generate a premium ${request.framework === 'react' ? 'React component with Tailwind CSS' : 'standalone HTML page'} based on this hand-drawn wireframe layout:

## DETECTED LAYOUT
${layoutDescription}

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
${request.pageType || 'auto-detect from the component layout'}

## COMPONENT NAME
${request.componentName}

## DESIGN REQUIREMENTS
- This must look like a $50,000 professionally designed website
- Every section must have proper visual hierarchy and breathing room
- Typography: display font for headings, body font for text, clear size scale
- Colors: dominant background, 1 primary accent, 1 secondary accent, neutral text scale
- Animations: entrance animations on scroll (use IntersectionObserver for HTML)
- Hover states on ALL interactive elements with smooth transitions
- Proper shadow depth (sm/md/lg shadow scale)
- Mobile responsive (include @media queries / Tailwind responsive classes)

## CONTENT RULES
- Use REALISTIC, SPECIFIC placeholder content (never Lorem Ipsum)
- Infer content from component semantics and layout context
- Hero headlines should be compelling and specific
- Badge text, button labels, nav links must be contextually accurate
- Add realistic user avatars as initials-based avatar components (no external images)

## OUTPUT
${request.framework === 'html' ?
    'Output a single complete HTML file. Embed ALL CSS in <style> tags. Import fonts from Google Fonts CDN. Include <!DOCTYPE html>. No external JS dependencies except what is necessary.' :
    'Output a single React functional component. Use Tailwind CSS classes. Include all sub-components inline. Export as default.'}
Output ONLY the code, nothing else — no markdown fences, no explanations.
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
 * Strip markdown code fences from generated output.
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
