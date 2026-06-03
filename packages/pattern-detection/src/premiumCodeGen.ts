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

export const PREMIUM_SYSTEM_PROMPT = `You are an elite UI engineer and designer with 15 years of experience at companies like Stripe, Linear, Vercel, and Figma. You produce production-grade, visually stunning UI that looks like a $50,000 professionally designed website.

ABSOLUTE RULES:
- Output ONLY valid, complete, self-contained code — no explanations, no markdown fences, no comments about the code
- For HTML: single complete file with embedded <style> and vanilla JS. Import Google Fonts via CDN link tag.
- For React: single component function with inline Tailwind CSS classes. NO import/export statements. Use React.useState, React.useEffect etc. from the global React object.
- MUST include meta viewport tag for HTML output
- MUST be fully responsive with mobile breakpoints
- ALL code must be syntactically valid and complete — never truncate or leave tags unclosed

DESIGN QUALITY STANDARDS (CRITICAL — the output MUST look premium):
- Hero sections: large bold headlines (48-72px), gradient text effects, compelling subheadlines, dual CTA buttons (primary filled + secondary outline)
- Navigation: clean horizontal nav with logo, links, and a prominent CTA button. Sticky on scroll.
- Cards: generous padding (24-32px), subtle borders, multi-layer shadows, hover lift transform with transition
- Every interactive element MUST have hover/focus states with smooth 0.2-0.3s transitions
- Typography: use a clear hierarchy — display headings (bold 600-800 weight), body text (regular 400), captions (light 300). Line-height 1.5-1.8 for body text.
- Color: use the theme palette precisely. Apply the primary color to CTAs, links, and accents. Use neutrals for text hierarchy (900 for headings, 600 for body, 400 for muted).
- Spacing: 8px grid system. Sections should have 80-120px vertical padding. Cards should have 24-32px inner padding.
- Backgrounds: use subtle gradients, dot patterns, or gradient mesh. Never plain flat white unless brutalist theme.
- Micro-animations: elements should fade-in on scroll using IntersectionObserver (HTML) or useEffect (React). Buttons should scale(1.02) on hover.
- Stats/metrics sections: show 3-4 impressive numbers with labels (e.g., "10K+ Users", "99.9% Uptime")
- Feature grids: 3-column card layouts with icons, titles, and descriptions
- Social proof: testimonial cards with avatar initials, name, role, and quote
- NO Lorem Ipsum — use realistic, compelling placeholder content
- NO generic labels — infer contextually accurate button text, headings, and descriptions
- NO external images — use CSS gradients, SVG shapes, or initials for visual elements
- Decorative elements: floating gradient orbs, subtle grid backgrounds, border accents

COMPONENT QUALITY:
- navbar: stylized text logo, horizontal nav links, CTA button, mobile hamburger menu with toggle
- hero: big headline with gradient text, subtext paragraph, primary + ghost CTA buttons, decorative background element (gradient orb, grid)
- card: rounded corners, padding 24px+, icon/emoji area, title, description, subtle border + layered shadow, hover translateY(-4px) with shadow increase
- button: gradient or solid fill, padding 12px 24px+, rounded, hover brightness/scale, focus ring
- form inputs: label above, 1px border, focus ring with primary accent color, placeholder text, rounded
- footer: dark background, logo, 3-4 column link groups, social icons, copyright line
- tables: styled header row, alternating row backgrounds, proper cell padding
- avatars: circular with background color and white initials text
- badges/pills: small rounded-full elements with tinted backgrounds`;

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
    'Output a single complete HTML file. Embed ALL CSS in <style> tags. Import fonts from Google Fonts CDN via <link> tag. Include <!DOCTYPE html>. No external JS dependencies. The file must be fully self-contained and render beautifully on its own. Make sure ALL HTML tags are properly closed. End the file with </html>.' :
    `Output a single React functional component named "${request.componentName}". Use Tailwind CSS utility classes for all styling.

CRITICAL React Rules:
- Do NOT use any import or export statements (the code runs in a browser with React and ReactDOM as globals)
- Use React.useState, React.useEffect, React.useRef etc. — NOT destructured hooks
- Define the component as: function ${request.componentName}() { ... }
- Do NOT use TypeScript syntax — no type annotations, no interfaces, no 'as' casts
- Keep all sub-components in the same file as regular functions
- Make sure ALL JSX tags are properly closed
- The component must return a single root element`}
Output ONLY the code, nothing else — no markdown fences, no explanations, no commentary.
IMPORTANT: Make sure the code is COMPLETE and all tags/braces are properly closed. Do not truncate.
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
