/**
 * Wireframe Renderers — Canvas drawing functions for each component type.
 *
 * Each renderer draws a proper wireframe symbol (dashed borders,
 * gray fills, internal details) instead of a plain rectangle.
 * Used when palette items are stamped onto the canvas.
 */

export interface WireframeBBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

type WireframeRenderer = (ctx: CanvasRenderingContext2D, bbox: WireframeBBox) => void;

/* ────────────────────── renderers ────────────────────── */

const renderNavbar: WireframeRenderer = (ctx, bbox) => {
  ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
  // Logo square (left)
  const pad = 8;
  const logoSize = bbox.h - pad * 2;
  ctx.strokeRect(bbox.x + pad + 4, bbox.y + pad, logoSize, logoSize);
  // Nav links (right side)
  const linkW = 32;
  const linkH = 6;
  const linkY = bbox.y + bbox.h / 2 - linkH / 2;
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(bbox.x + bbox.w - 180 + i * 44, linkY, linkW, linkH);
  }
};

const renderHero: WireframeRenderer = (ctx, bbox) => {
  ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
  // Headline (two thick lines)
  const cx = bbox.x + bbox.w / 2;
  const lineY = bbox.y + bbox.h * 0.3;
  ctx.fillRect(cx - 140, lineY, 280, 10);
  ctx.fillRect(cx - 100, lineY + 20, 200, 6);
  // Subtitle line
  ctx.fillRect(cx - 80, lineY + 40, 160, 4);
  // CTA button
  ctx.strokeRect(cx - 50, lineY + 65, 100, 30);
  ctx.fillRect(cx - 30, lineY + 76, 60, 8);
};

const renderImageBox: WireframeRenderer = (ctx, bbox) => {
  ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
  // Diagonal X
  ctx.beginPath();
  ctx.moveTo(bbox.x, bbox.y);
  ctx.lineTo(bbox.x + bbox.w, bbox.y + bbox.h);
  ctx.moveTo(bbox.x + bbox.w, bbox.y);
  ctx.lineTo(bbox.x, bbox.y + bbox.h);
  ctx.stroke();
};

const renderTextBlock: WireframeRenderer = (ctx, bbox) => {
  const lineCount = Math.max(2, Math.floor(bbox.h / 16));
  const spacing = bbox.h / (lineCount + 1);
  for (let i = 1; i <= lineCount; i++) {
    const y = bbox.y + spacing * i;
    const isLast = i === lineCount;
    const endX = isLast ? bbox.x + bbox.w * 0.6 : bbox.x + bbox.w - 8;
    ctx.fillRect(bbox.x + 8, y - 2, endX - bbox.x - 8, 4);
  }
};

const renderAvatar: WireframeRenderer = (ctx, bbox) => {
  const cx = bbox.x + bbox.w / 2;
  const cy = bbox.y + bbox.h / 2;
  const r = Math.min(bbox.w, bbox.h) / 2 - 2;
  // Circle outline
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  // Head
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.2, r * 0.3, 0, Math.PI * 2);
  ctx.stroke();
  // Shoulders
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.7, r * 0.45, Math.PI, 0);
  ctx.stroke();
};

const renderCard: WireframeRenderer = (ctx, bbox) => {
  // Card outline with rounded corners hint
  ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
  // Image area (top 40%)
  const imgH = bbox.h * 0.4;
  ctx.beginPath();
  ctx.moveTo(bbox.x, bbox.y + imgH);
  ctx.lineTo(bbox.x + bbox.w, bbox.y + imgH);
  ctx.stroke();
  // Diagonal X in image area
  ctx.beginPath();
  ctx.moveTo(bbox.x, bbox.y);
  ctx.lineTo(bbox.x + bbox.w, bbox.y + imgH);
  ctx.moveTo(bbox.x + bbox.w, bbox.y);
  ctx.lineTo(bbox.x, bbox.y + imgH);
  ctx.stroke();
  // Title line
  ctx.fillRect(bbox.x + 12, bbox.y + imgH + 16, bbox.w * 0.6, 8);
  // Description lines
  ctx.fillRect(bbox.x + 12, bbox.y + imgH + 34, bbox.w - 24, 4);
  ctx.fillRect(bbox.x + 12, bbox.y + imgH + 44, bbox.w * 0.7, 4);
};

const renderButton: WireframeRenderer = (ctx, bbox) => {
  // Rounded rectangle
  const r = Math.min(6, bbox.h / 2);
  ctx.beginPath();
  ctx.moveTo(bbox.x + r, bbox.y);
  ctx.lineTo(bbox.x + bbox.w - r, bbox.y);
  ctx.quadraticCurveTo(bbox.x + bbox.w, bbox.y, bbox.x + bbox.w, bbox.y + r);
  ctx.lineTo(bbox.x + bbox.w, bbox.y + bbox.h - r);
  ctx.quadraticCurveTo(bbox.x + bbox.w, bbox.y + bbox.h, bbox.x + bbox.w - r, bbox.y + bbox.h);
  ctx.lineTo(bbox.x + r, bbox.y + bbox.h);
  ctx.quadraticCurveTo(bbox.x, bbox.y + bbox.h, bbox.x, bbox.y + bbox.h - r);
  ctx.lineTo(bbox.x, bbox.y + r);
  ctx.quadraticCurveTo(bbox.x, bbox.y, bbox.x + r, bbox.y);
  ctx.closePath();
  ctx.stroke();
  // Label line
  ctx.fillRect(bbox.x + bbox.w * 0.25, bbox.y + bbox.h / 2 - 3, bbox.w * 0.5, 6);
};

const renderInputField: WireframeRenderer = (ctx, bbox) => {
  ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
  // Placeholder text
  ctx.fillRect(bbox.x + 10, bbox.y + bbox.h / 2 - 2, bbox.w * 0.35, 4);
};

const renderCheckbox: WireframeRenderer = (ctx, bbox) => {
  const size = Math.min(16, bbox.h - 4);
  const bx = bbox.x + 2;
  const by = bbox.y + (bbox.h - size) / 2;
  ctx.strokeRect(bx, by, size, size);
  // Label
  ctx.fillRect(bx + size + 8, bbox.y + bbox.h / 2 - 2, bbox.w - size - 18, 4);
};

const renderRadio: WireframeRenderer = (ctx, bbox) => {
  const r = Math.min(8, (bbox.h - 4) / 2);
  const cx = bbox.x + r + 4;
  const cy = bbox.y + bbox.h / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  // Inner dot
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
  // Label
  ctx.fillRect(cx + r + 8, cy - 2, bbox.w - r * 2 - 20, 4);
};

const renderDropdown: WireframeRenderer = (ctx, bbox) => {
  ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
  // Selected text
  ctx.fillRect(bbox.x + 10, bbox.y + bbox.h / 2 - 2, bbox.w * 0.45, 4);
  // Down arrow
  const ax = bbox.x + bbox.w - 20;
  const ay = bbox.y + bbox.h / 2 - 3;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax + 10, ay);
  ctx.lineTo(ax + 5, ay + 8);
  ctx.closePath();
  ctx.fill();
};

const renderSearchBar: WireframeRenderer = (ctx, bbox) => {
  ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
  // Magnifying glass icon (left side)
  const iconR = Math.min(6, bbox.h / 4);
  const icx = bbox.x + 16;
  const icy = bbox.y + bbox.h / 2;
  ctx.beginPath();
  ctx.arc(icx, icy - 1, iconR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(icx + iconR * 0.7, icy + iconR * 0.7 - 1);
  ctx.lineTo(icx + iconR * 1.4, icy + iconR * 1.4 - 1);
  ctx.stroke();
  // Placeholder
  ctx.fillRect(icx + iconR * 2, icy - 2, bbox.w * 0.35, 4);
};

const renderTable: WireframeRenderer = (ctx, bbox) => {
  ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
  // Header row
  const headerH = 24;
  ctx.beginPath();
  ctx.moveTo(bbox.x, bbox.y + headerH);
  ctx.lineTo(bbox.x + bbox.w, bbox.y + headerH);
  ctx.stroke();
  // Columns (3)
  const cols = 3;
  for (let c = 1; c < cols; c++) {
    const cx = bbox.x + (bbox.w / cols) * c;
    ctx.beginPath();
    ctx.moveTo(cx, bbox.y);
    ctx.lineTo(cx, bbox.y + bbox.h);
    ctx.stroke();
  }
  // Data rows
  const rows = Math.floor((bbox.h - headerH) / 20);
  for (let r = 1; r < rows; r++) {
    const ry = bbox.y + headerH + r * 20;
    ctx.beginPath();
    ctx.moveTo(bbox.x, ry);
    ctx.lineTo(bbox.x + bbox.w, ry);
    ctx.stroke();
  }
};

const renderDivider: WireframeRenderer = (ctx, bbox) => {
  const y = bbox.y + bbox.h / 2;
  ctx.beginPath();
  ctx.moveTo(bbox.x, y);
  ctx.lineTo(bbox.x + bbox.w, y);
  ctx.stroke();
};

const renderList: WireframeRenderer = (ctx, bbox) => {
  const itemH = Math.max(32, bbox.h / 4);
  const count = Math.floor(bbox.h / itemH);
  for (let i = 0; i < count; i++) {
    const iy = bbox.y + i * itemH;
    ctx.strokeRect(bbox.x, iy, bbox.w, itemH - 4);
    // Bullet dot
    ctx.beginPath();
    ctx.arc(bbox.x + 14, iy + itemH / 2 - 2, 3, 0, Math.PI * 2);
    ctx.fill();
    // Text lines
    ctx.fillRect(bbox.x + 26, iy + itemH / 2 - 4, bbox.w * 0.5, 4);
    ctx.fillRect(bbox.x + 26, iy + itemH / 2 + 4, bbox.w * 0.3, 3);
  }
};

const renderFeatureGrid: WireframeRenderer = (ctx, bbox) => {
  const cols = 2;
  const rows = 2;
  const gap = 8;
  const cellW = (bbox.w - gap * (cols - 1)) / cols;
  const cellH = (bbox.h - gap * (rows - 1)) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = bbox.x + c * (cellW + gap);
      const cy = bbox.y + r * (cellH + gap);
      ctx.strokeRect(cx, cy, cellW, cellH);
      // Icon circle
      ctx.beginPath();
      ctx.arc(cx + cellW / 2, cy + cellH * 0.3, 8, 0, Math.PI * 2);
      ctx.stroke();
      // Text line
      ctx.fillRect(cx + cellW * 0.2, cy + cellH * 0.65, cellW * 0.6, 4);
    }
  }
};

const renderRating: WireframeRenderer = (ctx, bbox) => {
  const starCount = 5;
  const starSize = Math.min(bbox.h - 4, (bbox.w - 8) / starCount - 2);
  const startX = bbox.x + 4;
  for (let i = 0; i < starCount; i++) {
    const cx = startX + i * (starSize + 2) + starSize / 2;
    const cy = bbox.y + bbox.h / 2;
    drawStar(ctx, cx, cy, starSize / 2, i < 3);
  }
};

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, filled: boolean) {
  const spikes = 5;
  const step = Math.PI / spikes;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = i * step - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (filled) ctx.fill();
  else ctx.stroke();
}

const renderTestimonial: WireframeRenderer = (ctx, bbox) => {
  // Speech bubble outline
  ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h - 12);
  // Tail triangle
  const tailX = bbox.x + 30;
  ctx.beginPath();
  ctx.moveTo(tailX, bbox.y + bbox.h - 12);
  ctx.lineTo(tailX + 8, bbox.y + bbox.h);
  ctx.lineTo(tailX + 16, bbox.y + bbox.h - 12);
  ctx.stroke();
  // Quote lines
  ctx.fillRect(bbox.x + 12, bbox.y + 14, bbox.w - 24, 4);
  ctx.fillRect(bbox.x + 12, bbox.y + 24, bbox.w * 0.7, 4);
  ctx.fillRect(bbox.x + 12, bbox.y + 34, bbox.w * 0.5, 4);
};

const renderSection: WireframeRenderer = (ctx, bbox) => {
  ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
};

const renderSidebar: WireframeRenderer = (ctx, bbox) => {
  ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
  // Menu items
  const itemH = 28;
  for (let i = 0; i < 6; i++) {
    const iy = bbox.y + 12 + i * itemH;
    ctx.fillRect(bbox.x + 12, iy, bbox.w - 24, 4);
  }
};

const renderFooter: WireframeRenderer = (ctx, bbox) => {
  ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
  // 3 column footer
  const colW = bbox.w / 3;
  for (let c = 0; c < 3; c++) {
    const cx = bbox.x + c * colW + 16;
    ctx.fillRect(cx, bbox.y + 14, colW * 0.4, 6);
    for (let l = 0; l < 3; l++) {
      ctx.fillRect(cx, bbox.y + 28 + l * 14, colW * 0.55, 3);
    }
  }
};

const renderModal: WireframeRenderer = (ctx, bbox) => {
  ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
  // Title bar
  ctx.beginPath();
  ctx.moveTo(bbox.x, bbox.y + 30);
  ctx.lineTo(bbox.x + bbox.w, bbox.y + 30);
  ctx.stroke();
  // Title text
  ctx.fillRect(bbox.x + 14, bbox.y + 11, bbox.w * 0.4, 8);
  // Close X
  const closeX = bbox.x + bbox.w - 22;
  const closeY = bbox.y + 10;
  ctx.beginPath();
  ctx.moveTo(closeX, closeY);
  ctx.lineTo(closeX + 10, closeY + 10);
  ctx.moveTo(closeX + 10, closeY);
  ctx.lineTo(closeX, closeY + 10);
  ctx.stroke();
};

const renderNotificationBell: WireframeRenderer = (ctx, bbox) => {
  ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
  // Bell icon
  const icx = bbox.x + 18;
  const icy = bbox.y + bbox.h / 2;
  ctx.beginPath();
  ctx.arc(icx, icy - 4, 6, Math.PI, 0);
  ctx.lineTo(icx + 8, icy + 4);
  ctx.lineTo(icx - 8, icy + 4);
  ctx.closePath();
  ctx.stroke();
  // Text
  ctx.fillRect(bbox.x + 34, icy - 4, bbox.w * 0.5, 4);
  ctx.fillRect(bbox.x + 34, icy + 4, bbox.w * 0.35, 3);
};

/* ────────────────────── generic fallback ────────────────────── */

const renderGeneric: WireframeRenderer = (ctx, bbox) => {
  ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
};

/* ────────────────────── export map ────────────────────── */

export const WIREFRAME_RENDERERS: Record<string, WireframeRenderer> = {
  navbar:             renderNavbar,
  hero:               renderHero,
  section:            renderSection,
  sidebar:            renderSidebar,
  footer:             renderFooter,
  modal:              renderModal,
  image_placeholder:  renderImageBox,
  text_label:         renderTextBlock,
  avatar:             renderAvatar,
  card:               renderCard,
  list:               renderList,
  table:              renderTable,
  input_field:        renderInputField,
  button:             renderButton,
  checkbox:           renderCheckbox,
  dropdown:           renderDropdown,
  search_bar:         renderSearchBar,
  radio:              renderRadio,
  feature_grid:       renderFeatureGrid,
  rating:             renderRating,
  testimonial:        renderTestimonial,
  divider:            renderDivider,
  notification_bell:  renderNotificationBell,
  // Aliases
  container_box:      renderGeneric,
  nav_menu:           renderNavbar,
  arrow_connector:    renderDivider,
};

/**
 * Render a wireframe symbol at the given bounding box.
 * Falls back to a plain rectangle if no specific renderer exists.
 */
export function renderWireframeSymbol(
  ctx: CanvasRenderingContext2D,
  type: string,
  bbox: WireframeBBox,
): void {
  ctx.save();
  ctx.strokeStyle = "#64748b";
  ctx.fillStyle = "#94a3b8";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.globalAlpha = 0.8;

  const renderer = WIREFRAME_RENDERERS[type] || renderGeneric;
  renderer(ctx, bbox);

  // Component label
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.7;
  ctx.font = "bold 10px Inter, system-ui, sans-serif";
  const label = type.replace(/_/g, " ");
  const textW = ctx.measureText(label).width;
  ctx.fillStyle = "#475569";
  ctx.fillRect(bbox.x, bbox.y - 14, textW + 8, 14);
  ctx.fillStyle = "#fff";
  ctx.fillText(label, bbox.x + 4, bbox.y - 3);

  ctx.restore();
}
