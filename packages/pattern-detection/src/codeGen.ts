/**
 * Code generation engine — converts a LayoutNode tree into React/Tailwind
 * or plain HTML code.
 *
 * Each UIComponentType maps to a JSX or HTML template. The tree is traversed
 * recursively, nesting children inside container components.
 */

import type { LayoutNode } from "./layoutTree.js";
import type { UIComponentType } from "./uiLabels.js";

/* ────────────────────── types ────────────────────── */

export type Framework = 'react' | 'html';

/* ────────────────────── React / Tailwind templates ────────────────────── */

function reactTemplate(type: UIComponentType, node: LayoutNode, childrenCode: string): string {
  const gap = node.layoutHints.gap || 4;
  const gapClass = `gap-${Math.max(1, Math.round(gap / 4))}`;

  switch (type) {
    case 'button':
      return `<button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium">
  Button
</button>`;

    case 'input_field':
      return `<input
  type="text"
  placeholder="Enter text..."
  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
/>`;

    case 'checkbox':
      return `<label className="flex items-center gap-2 cursor-pointer">
  <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
  <span className="text-sm text-gray-700">Checkbox label</span>
</label>`;

    case 'radio':
      return `<label className="flex items-center gap-2 cursor-pointer">
  <input type="radio" name="radio-group" className="w-4 h-4 border-gray-300 text-blue-600 focus:ring-blue-500" />
  <span className="text-sm text-gray-700">Option</span>
</label>`;

    case 'dropdown':
      return `<select className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
  <option>Select an option</option>
  <option>Option 1</option>
  <option>Option 2</option>
</select>`;

    case 'card':
      return `<div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
${indent(childrenCode || '<p className="text-gray-600">Card content</p>', 2)}
</div>`;

    case 'navbar':
      return `<nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
  <div className="text-lg font-semibold text-gray-900">Logo</div>
  <div className="flex items-center gap-6">
${indent(childrenCode || '<a href="#" className="text-gray-600 hover:text-gray-900">Link</a>', 4)}
  </div>
</nav>`;

    case 'footer':
      return `<footer className="bg-gray-900 text-gray-300 px-8 py-10">
  <div className="grid grid-cols-3 gap-8 mb-8">
    <div>
      <div className="text-white font-semibold mb-3">Product</div>
      <a href="#" className="block text-sm hover:text-white mb-2">Features</a>
      <a href="#" className="block text-sm hover:text-white mb-2">Pricing</a>
      <a href="#" className="block text-sm hover:text-white">Docs</a>
    </div>
    <div>
      <div className="text-white font-semibold mb-3">Company</div>
      <a href="#" className="block text-sm hover:text-white mb-2">About</a>
      <a href="#" className="block text-sm hover:text-white mb-2">Blog</a>
      <a href="#" className="block text-sm hover:text-white">Careers</a>
    </div>
    <div>
      <div className="text-white font-semibold mb-3">Support</div>
      <a href="#" className="block text-sm hover:text-white mb-2">Help</a>
      <a href="#" className="block text-sm hover:text-white mb-2">Contact</a>
      <a href="#" className="block text-sm hover:text-white">Status</a>
    </div>
  </div>
${indent(childrenCode || '<p className="text-sm text-gray-500 border-t border-gray-800 pt-6">© 2026 Company. All rights reserved.</p>', 2)}
</footer>`;

    case 'modal':
      return `<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold text-gray-900">Modal Title</h3>
      <button className="text-gray-400 hover:text-gray-600">✕</button>
    </div>
    <div>
${indent(childrenCode || '<p className="text-gray-600">Modal content goes here.</p>', 6)}
    </div>
  </div>
</div>`;

    case 'text_label':
      return `<p className="text-sm text-gray-700">Label text</p>`;

    case 'image_placeholder':
      return `<div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center aspect-video overflow-hidden relative">
  <img
    src="REPLACE_ME_IMAGE_URL"
    alt="Replace this image"
    className="w-full h-full object-cover"
    loading="lazy"
  />
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    <span className="text-sm text-gray-400 bg-white/70 px-2 py-1 rounded">Replace Image</span>
  </div>
</div>`;

    case 'table':
      return `<table className="w-full border-collapse border border-gray-200">
  <thead>
    <tr className="bg-gray-50">
      <th className="border border-gray-200 px-4 py-2 text-left text-sm font-medium text-gray-700">Header 1</th>
      <th className="border border-gray-200 px-4 py-2 text-left text-sm font-medium text-gray-700">Header 2</th>
      <th className="border border-gray-200 px-4 py-2 text-left text-sm font-medium text-gray-700">Header 3</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td className="border border-gray-200 px-4 py-2 text-sm text-gray-600">Cell 1</td>
      <td className="border border-gray-200 px-4 py-2 text-sm text-gray-600">Cell 2</td>
      <td className="border border-gray-200 px-4 py-2 text-sm text-gray-600">Cell 3</td>
    </tr>
    <tr>
      <td className="border border-gray-200 px-4 py-2 text-sm text-gray-600">Cell 4</td>
      <td className="border border-gray-200 px-4 py-2 text-sm text-gray-600">Cell 5</td>
      <td className="border border-gray-200 px-4 py-2 text-sm text-gray-600">Cell 6</td>
    </tr>
  </tbody>
</table>`;

    case 'divider':
      return `<hr className="border-t border-gray-200 my-4" />`;

    case 'arrow_connector':
      return `<div className="flex items-center gap-1 text-gray-400">
  <div className="h-px w-12 bg-gray-300"></div>
  <span>→</span>
</div>`;

    case 'container_box': {
      const dirClass = node.layoutHints.isRow ? 'flex flex-row' : 'flex flex-col';
      const alignClass = getAlignmentClass(node.layoutHints.alignment);
      return `<div className="${dirClass} ${gapClass} ${alignClass} p-4">
${indent(childrenCode, 2)}
</div>`;
    }

    default:
      return `<div className="p-4 border border-gray-200 rounded">
${indent(childrenCode || `<!-- ${type} -->`, 2)}
</div>`;
  }
}

/* ────────────────────── HTML templates ────────────────────── */

function htmlTemplate(type: UIComponentType, node: LayoutNode, childrenCode: string): string {
  const gap = node.layoutHints.gap || 8;

  switch (type) {
    case 'button':
      return `<button style="padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
  Button
</button>`;

    case 'input_field':
      return `<input type="text" placeholder="Enter text..." style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; outline: none;" />`;

    case 'checkbox':
      return `<label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
  <input type="checkbox" />
  <span>Checkbox label</span>
</label>`;

    case 'radio':
      return `<label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
  <input type="radio" name="radio-group" />
  <span>Option</span>
</label>`;

    case 'dropdown':
      return `<select style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; background: white;">
  <option>Select an option</option>
  <option>Option 1</option>
  <option>Option 2</option>
</select>`;

    case 'card':
      return `<div style="background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 24px; border: 1px solid #e5e7eb;">
${indent(childrenCode || '<p>Card content</p>', 2)}
</div>`;

    case 'navbar':
      return `<nav style="display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; background: white; border-bottom: 1px solid #e5e7eb;">
  <div style="font-size: 18px; font-weight: 600;">Logo</div>
  <div style="display: flex; align-items: center; gap: 24px;">
${indent(childrenCode || '<a href="#">Link</a>', 4)}
  </div>
</nav>`;

    case 'footer':
      return `<footer style="background: #111827; color: #d1d5db; padding: 40px 32px;">
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; margin-bottom: 32px;">
    <div>
      <div style="color: white; font-weight: 600; margin-bottom: 12px;">Product</div>
      <a href="#" style="display: block; font-size: 14px; margin-bottom: 8px; color: inherit;">Features</a>
      <a href="#" style="display: block; font-size: 14px; margin-bottom: 8px; color: inherit;">Pricing</a>
      <a href="#" style="display: block; font-size: 14px; color: inherit;">Docs</a>
    </div>
    <div>
      <div style="color: white; font-weight: 600; margin-bottom: 12px;">Company</div>
      <a href="#" style="display: block; font-size: 14px; margin-bottom: 8px; color: inherit;">About</a>
      <a href="#" style="display: block; font-size: 14px; margin-bottom: 8px; color: inherit;">Blog</a>
      <a href="#" style="display: block; font-size: 14px; color: inherit;">Careers</a>
    </div>
    <div>
      <div style="color: white; font-weight: 600; margin-bottom: 12px;">Support</div>
      <a href="#" style="display: block; font-size: 14px; margin-bottom: 8px; color: inherit;">Help</a>
      <a href="#" style="display: block; font-size: 14px; margin-bottom: 8px; color: inherit;">Contact</a>
      <a href="#" style="display: block; font-size: 14px; color: inherit;">Status</a>
    </div>
  </div>
${indent(childrenCode || '<p style="font-size: 14px; color: #6b7280; border-top: 1px solid #1f2937; padding-top: 24px;">© 2026 Company. All rights reserved.</p>', 2)}
</footer>`;

    case 'modal':
      return `<div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 50;">
  <div style="background: white; border-radius: 12px; box-shadow: 0 25px 50px rgba(0,0,0,0.25); padding: 24px; max-width: 28rem; width: 100%;">
    <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
      <h3 style="font-size: 18px; font-weight: 600;">Modal Title</h3>
      <button style="background: none; border: none; cursor: pointer; color: #9ca3af;">✕</button>
    </div>
${indent(childrenCode || '<p>Modal content goes here.</p>', 4)}
  </div>
</div>`;

    case 'text_label':
      return `<p style="font-size: 14px; color: #374151;">Label text</p>`;

    case 'image_placeholder':
      return `<div style="background: #f3f4f6; border: 2px dashed #d1d5db; border-radius: 8px; display: flex; align-items: center; justify-content: center; aspect-ratio: 16/9; overflow: hidden; position: relative;">
  <img
    src="REPLACE_ME_IMAGE_URL"
    alt="Replace this image"
    style="width: 100%; height: 100%; object-fit: cover;"
  />
  <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none;">
    <span style="font-size: 14px; color: #9ca3af; background: rgba(255,255,255,0.75); padding: 4px 8px; border-radius: 6px;">Replace Image</span>
  </div>
</div>`;

    case 'table':
      return `<table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
  <thead>
    <tr style="background: #f9fafb;">
      <th style="border: 1px solid #e5e7eb; padding: 8px 16px; text-align: left;">Header 1</th>
      <th style="border: 1px solid #e5e7eb; padding: 8px 16px; text-align: left;">Header 2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="border: 1px solid #e5e7eb; padding: 8px 16px;">Cell 1</td>
      <td style="border: 1px solid #e5e7eb; padding: 8px 16px;">Cell 2</td>
    </tr>
  </tbody>
</table>`;

    case 'divider':
      return `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />`;

    case 'arrow_connector':
      return `<div style="display: flex; align-items: center; gap: 4px; color: #9ca3af;">
  <div style="height: 1px; width: 48px; background: #d1d5db;"></div>
  <span>→</span>
</div>`;

    case 'container_box': {
      const direction = node.layoutHints.isRow ? 'row' : 'column';
      return `<div style="display: flex; flex-direction: ${direction}; gap: ${gap}px; padding: 16px;">
${indent(childrenCode, 2)}
</div>`;
    }

    default:
      return `<div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 6px;">
${indent(childrenCode || `<!-- ${type} -->`, 2)}
</div>`;
  }
}

/* ────────────────────── helpers ────────────────────── */

function indent(code: string, spaces: number): string {
  if (!code) return '';
  const pad = ' '.repeat(spaces);
  return code
    .split('\n')
    .map((line) => (line.trim() ? pad + line : line))
    .join('\n');
}

function getAlignmentClass(alignment: string): string {
  switch (alignment) {
    case 'center':  return 'items-center justify-center';
    case 'end':     return 'items-end justify-end';
    case 'between': return 'items-center justify-between';
    default:        return 'items-start justify-start';
  }
}

/* ────────────────────── main code generation ────────────────────── */

/**
 * Recursively generate code for a layout node and its children.
 */
export function generateCode(node: LayoutNode, framework: Framework = 'react'): string {
  // Generate children code first
  const childrenCode = node.children
    .map((child) => generateCode(child, framework))
    .join('\n');

  const template = framework === 'react' ? reactTemplate : htmlTemplate;
  return template(node.component.type, node, childrenCode);
}

/**
 * Generate a complete React component file from a layout tree.
 */
export function generateFullComponent(
  tree: LayoutNode,
  componentName = 'GeneratedComponent',
  framework: Framework = 'react',
): string {
  const code = generateCode(tree, framework);

  if (framework === 'react') {
    return `import React from 'react';

export default function ${componentName}() {
  return (
${indent(code, 4)}
  );
}
`;
  }

  // HTML output
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${componentName}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  </style>
</head>
<body>
${indent(code, 2)}
</body>
</html>
`;
}

/**
 * Generate code for multiple frameworks at once.
 */
export function generateAllFormats(
  tree: LayoutNode,
  componentName = 'GeneratedComponent',
): { react: string; html: string } {
  return {
    react: generateFullComponent(tree, componentName, 'react'),
    html: generateFullComponent(tree, componentName, 'html'),
  };
}
