"use client";

import { useState, useRef, useCallback } from "react";
import { ChevronDown, ChevronRight, GripVertical, PanelLeftClose, PanelLeftOpen } from "lucide-react";

/* ────────────────────── palette data ────────────────────── */

export interface PaletteItem {
  id: string;
  icon: string;
  label: string;
  defaultSize: { w: number; h: number };
  description?: string;
}

interface PaletteSection {
  label: string;
  items: PaletteItem[];
}

const PALETTE_SECTIONS: PaletteSection[] = [
  {
    label: "Layout",
    items: [
      { id: "navbar",   icon: "▬",  label: "Header",   defaultSize: { w: 600, h: 50  } },
      { id: "hero",     icon: "⬛", label: "Hero",     defaultSize: { w: 600, h: 300 } },
      { id: "slideshow", icon: "⏵", label: "Slideshow", defaultSize: { w: 700, h: 320 }, description: "Carousel image + controls + caption" },
      { id: "offer_section", icon: "💸", label: "Offer Section", defaultSize: { w: 700, h: 360 }, description: "Image + value text + CTA button" },
      { id: "section",  icon: "□",  label: "Section",  defaultSize: { w: 600, h: 220 } },
      { id: "sidebar",  icon: "▯",  label: "Sidebar",  defaultSize: { w: 180, h: 400 } },
      { id: "footer",   icon: "▬",  label: "Footer",   defaultSize: { w: 600, h: 100 } },
      { id: "modal",    icon: "◫",  label: "Modal",    defaultSize: { w: 350, h: 250 } },
    ],
  },
  {
    label: "Content",
    items: [
      { id: "image_placeholder", icon: "⊠",  label: "Image",  defaultSize: { w: 180, h: 130 } },
      { id: "text_label",        icon: "≡",  label: "Text",   defaultSize: { w: 180, h: 70  } },
      { id: "avatar",            icon: "◉",  label: "Avatar", defaultSize: { w: 44,  h: 44  } },
      { id: "card",              icon: "▭",  label: "Card",   defaultSize: { w: 220, h: 260 } },
      { id: "list",              icon: "☰",  label: "List",   defaultSize: { w: 260, h: 180 } },
      { id: "table",             icon: "⊞",  label: "Table",  defaultSize: { w: 360, h: 180 } },
    ],
  },
  {
    label: "Forms",
    items: [
      { id: "input_field", icon: "▱",  label: "Input",    defaultSize: { w: 180, h: 36  } },
      { id: "button",      icon: "⬭",  label: "Button",   defaultSize: { w: 110, h: 36  } },
      { id: "checkbox",    icon: "☐",  label: "Checkbox", defaultSize: { w: 130, h: 26  } },
      { id: "dropdown",    icon: "⌄",  label: "Select",   defaultSize: { w: 160, h: 36  } },
      { id: "search_bar",  icon: "🔍", label: "Search",   defaultSize: { w: 220, h: 36  } },
      { id: "radio",       icon: "◎",  label: "Radio",    defaultSize: { w: 130, h: 26  } },
    ],
  },
  {
    label: "Data",
    items: [
      { id: "feature_grid", icon: "▦",  label: "Grid",      defaultSize: { w: 280, h: 200 } },
      { id: "rating",       icon: "⭐", label: "Rating",    defaultSize: { w: 120, h: 24  } },
      { id: "testimonial",  icon: "💬", label: "Quote",     defaultSize: { w: 260, h: 120 } },
      { id: "divider",      icon: "—",  label: "Divider",   defaultSize: { w: 300, h: 4   } },
      { id: "notification_bell", icon: "🔔", label: "Alert", defaultSize: { w: 280, h: 50 } },
    ],
  },
  {
    label: "Templates",
    items: [
      { id: "tpl_landing",   icon: "🏠", label: "Landing",   defaultSize: { w: 600, h: 500 }, description: "Hero + Features + CTA" },
      { id: "tpl_dashboard", icon: "📊", label: "Dashboard", defaultSize: { w: 600, h: 500 }, description: "Sidebar + Stats + Table" },
      { id: "auth_login",    icon: "🔐", label: "Login",     defaultSize: { w: 520, h: 440 }, description: "Email/password login + social buttons" },
      { id: "auth_signup",   icon: "✅", label: "Sign Up",   defaultSize: { w: 520, h: 500 }, description: "Name/email/password sign up + terms checkbox" },
      { id: "profile_page",  icon: "👤", label: "Profile",   defaultSize: { w: 560, h: 520 }, description: "Cover image + avatar + profile form" },
      { id: "tpl_pricing",   icon: "💳", label: "Pricing",   defaultSize: { w: 600, h: 400 }, description: "3-tier pricing cards" },
    ],
  },
];

/* ────────────────────── component ────────────────────── */

export interface PaletteDropEvent {
  item: PaletteItem;
  x: number;
  y: number;
}

interface ComponentPaletteProps {
  onDrop: (event: PaletteDropEvent) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  width?: number;
}

export default function ComponentPalette({
  onDrop,
  collapsed = false,
  onToggleCollapse,
  width = 200,
}: ComponentPaletteProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["Layout", "Content", "Forms", "Templates"])
  );
  const dragItemRef = useRef<PaletteItem | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);

  const toggleSection = useCallback((label: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  /* ── drag handlers ── */
  const handleDragStart = useCallback(
    (e: React.DragEvent, item: PaletteItem) => {
      dragItemRef.current = item;
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData("text/plain", JSON.stringify(item));

      // Create drag ghost
      const ghost = document.createElement("div");
      ghost.className = "palette-drag-ghost";
      ghost.textContent = `${item.icon} ${item.label}`;
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 40, 18);
      dragGhostRef.current = ghost;
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    dragItemRef.current = null;
    if (dragGhostRef.current) {
      document.body.removeChild(dragGhostRef.current);
      dragGhostRef.current = null;
    }
  }, []);

  if (collapsed) {
    return (
      <button
        type="button"
        className="palette-collapsed"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleCollapse?.();
        }}
        title="Expand components palette"
        aria-label="Expand components palette"
      >
        <div className="palette-collapsed-icon">
          <PanelLeftOpen size={16} />
          <GripVertical size={14} style={{ opacity: 0.45 }} />
        </div>
        <div className="palette-collapsed-label">Components</div>
      </button>
    );
  }

  return (
    <div
      className="palette-sidebar"
      style={{ width, minWidth: width, flex: `0 0 ${width}px` }}
    >
      <div className="palette-header">
        <span className="palette-title">⚡ Components</span>
        <button
          type="button"
          className="palette-collapse-btn"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleCollapse?.();
          }}
          title="Collapse palette"
          aria-label="Collapse components palette"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      <div className="palette-sections">
        {PALETTE_SECTIONS.map((section) => {
          const isExpanded = expandedSections.has(section.label);

          return (
            <div key={section.label} className="palette-section">
              <button
                type="button"
                className="palette-section-toggle"
                onClick={() => toggleSection(section.label)}
              >
                {isExpanded ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
                <span>{section.label}</span>
                <span className="palette-section-count">
                  {section.items.length}
                </span>
              </button>

              {isExpanded && (
                <div className="palette-items-grid">
                  {section.items.map((item) => (
                    <div
                      key={item.id}
                      className="palette-item"
                      draggable
                      onDragStart={(e) => handleDragStart(e, item)}
                      onDragEnd={handleDragEnd}
                      title={
                        item.description ||
                        `${item.label} (${item.defaultSize.w}×${item.defaultSize.h})`
                      }
                    >
                      <span className="palette-item-icon">{item.icon}</span>
                      <span className="palette-item-label">{item.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="palette-footer">
        <span>Drag onto canvas</span>
      </div>
    </div>
  );
}
