/**
 * UI Component type definitions for the Sketch-to-Wireframe Intelligence pipeline.
 *
 * These 14 component classes replace the original geometric shape labels
 * (circle, rectangle, triangle, etc.) and represent the fundamental UI
 * building blocks that users sketch on the canvas.
 */

/* ────────────────────── core type ────────────────────── */

export type UIComponentType =
  | 'button'
  | 'input_field'
  | 'checkbox'
  | 'radio'
  | 'dropdown'
  | 'card'
  | 'navbar'
  | 'modal'
  | 'text_label'
  | 'image_placeholder'
  | 'table'
  | 'divider'
  | 'arrow_connector'
  | 'container_box'
  // ── v2 wireframe symbols ──
  | 'avatar'
  | 'search_bar'
  | 'rating'
  | 'testimonial'
  | 'list'
  | 'feature_grid'
  | 'nav_menu'
  | 'notification_bell';

/** Ordered label list (indices match CNN output layer). */
export const UI_COMPONENT_LABELS: UIComponentType[] = [
  'button',
  'input_field',
  'checkbox',
  'radio',
  'dropdown',
  'card',
  'navbar',
  'modal',
  'text_label',
  'image_placeholder',
  'table',
  'divider',
  'arrow_connector',
  'container_box',
  // v2 wireframe symbols
  'avatar',
  'search_bar',
  'rating',
  'testimonial',
  'list',
  'feature_grid',
  'nav_menu',
  'notification_bell',
];

/** Total number of classes. */
export const UI_CLASS_COUNT = UI_COMPONENT_LABELS.length;

/* ────────────────────── display helpers ────────────────────── */

/** Emoji / icon map for each component type (used in the UI panel). */
export const UI_COMPONENT_ICONS: Record<UIComponentType, string> = {
  button:            '🔘',
  input_field:       '📝',
  checkbox:          '☑️',
  radio:             '🔘',
  dropdown:          '📋',
  card:              '🃏',
  navbar:            '🧭',
  modal:             '🪟',
  text_label:        '🏷️',
  image_placeholder: '🖼️',
  table:             '📊',
  divider:           '➖',
  arrow_connector:   '➡️',
  container_box:     '📦',
  avatar:            '👤',
  search_bar:        '🔍',
  rating:            '⭐',
  testimonial:       '💬',
  list:              '📜',
  feature_grid:      '⊞',
  nav_menu:          '☰',
  notification_bell: '🔔',
};

/** Human-readable display names. */
export const UI_COMPONENT_DISPLAY_NAMES: Record<UIComponentType, string> = {
  button:            'Button',
  input_field:       'Input Field',
  checkbox:          'Checkbox',
  radio:             'Radio Button',
  dropdown:          'Dropdown',
  card:              'Card',
  navbar:            'Navbar',
  modal:             'Modal',
  text_label:        'Text Label',
  image_placeholder: 'Image Placeholder',
  table:             'Table',
  divider:           'Divider',
  arrow_connector:   'Arrow Connector',
  container_box:     'Container Box',
  avatar:            'Avatar',
  search_bar:        'Search Bar',
  rating:            'Rating',
  testimonial:       'Testimonial',
  list:              'List',
  feature_grid:      'Feature Grid',
  nav_menu:          'Nav Menu',
  notification_bell: 'Notification Bell',
};

/* ────────────────────── classification hints ────────────────────── */

export interface ComponentHint {
  /** Expected aspect ratio range [min, max] (width / height). */
  typicalAspectRatio: [number, number];
  /** Expected stroke count range [min, max]. */
  typicalStrokeCount: [number, number];
  /** How likely the shape is closed (start ≈ end). */
  closureLikelihood: 'high' | 'medium' | 'low';
  /** Relative size on canvas: 'small' < 2%, 'medium' 2-10%, 'large' > 10%. */
  typicalSize: 'small' | 'medium' | 'large';
}

/**
 * Heuristic hints per component type — used by the rule-based classifier
 * to narrow down candidates before DTW matching.
 */
export const UI_COMPONENT_HINTS: Record<UIComponentType, ComponentHint> = {
  button: {
    typicalAspectRatio: [1.5, 5],
    typicalStrokeCount: [1, 2],
    closureLikelihood: 'high',
    typicalSize: 'small',
  },
  input_field: {
    typicalAspectRatio: [3, 12],
    typicalStrokeCount: [1, 2],
    closureLikelihood: 'high',
    typicalSize: 'medium',
  },
  checkbox: {
    typicalAspectRatio: [0.7, 1.3],
    typicalStrokeCount: [1, 3],
    closureLikelihood: 'high',
    typicalSize: 'small',
  },
  radio: {
    typicalAspectRatio: [0.7, 1.3],
    typicalStrokeCount: [1, 1],
    closureLikelihood: 'high',
    typicalSize: 'small',
  },
  dropdown: {
    typicalAspectRatio: [2, 8],
    typicalStrokeCount: [2, 4],
    closureLikelihood: 'high',
    typicalSize: 'medium',
  },
  card: {
    typicalAspectRatio: [0.5, 2],
    typicalStrokeCount: [1, 2],
    closureLikelihood: 'high',
    typicalSize: 'large',
  },
  navbar: {
    typicalAspectRatio: [6, 30],
    typicalStrokeCount: [1, 3],
    closureLikelihood: 'high',
    typicalSize: 'large',
  },
  modal: {
    typicalAspectRatio: [0.6, 2],
    typicalStrokeCount: [1, 4],
    closureLikelihood: 'high',
    typicalSize: 'large',
  },
  text_label: {
    typicalAspectRatio: [2, 20],
    typicalStrokeCount: [1, 1],
    closureLikelihood: 'low',
    typicalSize: 'small',
  },
  image_placeholder: {
    typicalAspectRatio: [0.5, 2],
    typicalStrokeCount: [2, 5],
    closureLikelihood: 'high',
    typicalSize: 'medium',
  },
  table: {
    typicalAspectRatio: [0.5, 3],
    typicalStrokeCount: [3, 20],
    closureLikelihood: 'medium',
    typicalSize: 'large',
  },
  divider: {
    typicalAspectRatio: [8, 100],
    typicalStrokeCount: [1, 1],
    closureLikelihood: 'low',
    typicalSize: 'small',
  },
  arrow_connector: {
    typicalAspectRatio: [0.3, 10],
    typicalStrokeCount: [1, 3],
    closureLikelihood: 'low',
    typicalSize: 'small',
  },
  container_box: {
    typicalAspectRatio: [0.3, 3],
    typicalStrokeCount: [1, 2],
    closureLikelihood: 'high',
    typicalSize: 'large',
  },
  // ── v2 wireframe symbols ──
  avatar: {
    typicalAspectRatio: [0.7, 1.3],
    typicalStrokeCount: [2, 4],
    closureLikelihood: 'high',
    typicalSize: 'small',
  },
  search_bar: {
    typicalAspectRatio: [3, 12],
    typicalStrokeCount: [2, 4],
    closureLikelihood: 'high',
    typicalSize: 'medium',
  },
  rating: {
    typicalAspectRatio: [0.7, 1.5],
    typicalStrokeCount: [1, 5],
    closureLikelihood: 'medium',
    typicalSize: 'small',
  },
  testimonial: {
    typicalAspectRatio: [0.8, 2.5],
    typicalStrokeCount: [1, 3],
    closureLikelihood: 'high',
    typicalSize: 'medium',
  },
  list: {
    typicalAspectRatio: [0.3, 1.5],
    typicalStrokeCount: [2, 10],
    closureLikelihood: 'medium',
    typicalSize: 'large',
  },
  feature_grid: {
    typicalAspectRatio: [0.6, 1.8],
    typicalStrokeCount: [4, 12],
    closureLikelihood: 'high',
    typicalSize: 'large',
  },
  nav_menu: {
    typicalAspectRatio: [1, 5],
    typicalStrokeCount: [3, 6],
    closureLikelihood: 'low',
    typicalSize: 'small',
  },
  notification_bell: {
    typicalAspectRatio: [0.6, 1.4],
    typicalStrokeCount: [1, 3],
    closureLikelihood: 'high',
    typicalSize: 'small',
  },
};
