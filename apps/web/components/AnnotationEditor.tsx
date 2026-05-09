"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Tag, MessageSquare, Sparkles } from "lucide-react";

/* ────────────────────── types ────────────────────── */

export interface ComponentAnnotation {
  componentId: string;
  /** Semantic label — "Hero section", "Login form", etc. */
  semanticLabel: string;
  /** Content hint — "3 feature cards about our AI product" */
  contentHint: string;
  /** Style preference — "make this bold and prominent" */
  styleOverride: string;
}

interface AnnotationEditorProps {
  componentId: string;
  componentType: string;
  position: { x: number; y: number };
  annotation: ComponentAnnotation | null;
  onSave: (annotation: ComponentAnnotation) => void;
  onClose: () => void;
}

/* ────────────────────── component ────────────────────── */

export default function AnnotationEditor({
  componentId,
  componentType,
  position,
  annotation,
  onSave,
  onClose,
}: AnnotationEditorProps) {
  const [semanticLabel, setSemanticLabel] = useState(
    annotation?.semanticLabel || ""
  );
  const [contentHint, setContentHint] = useState(
    annotation?.contentHint || ""
  );
  const [styleOverride, setStyleOverride] = useState(
    annotation?.styleOverride || ""
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  // Focus on mount
  useEffect(() => {
    labelInputRef.current?.focus();
  }, []);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        handleSave();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [semanticLabel, contentHint, styleOverride]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSave = useCallback(() => {
    if (!semanticLabel && !contentHint && !styleOverride) {
      onClose();
      return;
    }
    onSave({
      componentId,
      semanticLabel,
      contentHint,
      styleOverride,
    });
  }, [componentId, semanticLabel, contentHint, styleOverride, onSave, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  // Smart placement — keep within viewport
  const style: React.CSSProperties = {
    position: "absolute",
    left: Math.min(position.x, window.innerWidth - 320),
    top: Math.min(position.y, window.innerHeight - 280),
    zIndex: 1000,
  };

  return (
    <div ref={containerRef} className="annotation-editor" style={style}>
      <div className="annotation-editor-header">
        <Tag size={14} />
        <span className="annotation-editor-type">
          {componentType.replace(/_/g, " ")}
        </span>
        <button className="annotation-close-btn" onClick={onClose}>
          <X size={14} />
        </button>
      </div>

      <div className="annotation-editor-body">
        <div className="annotation-field">
          <label>
            <Tag size={12} />
            What is this?
          </label>
          <input
            ref={labelInputRef}
            type="text"
            value={semanticLabel}
            onChange={(e) => setSemanticLabel(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Hero section, Pricing card..."
            className="annotation-input"
          />
        </div>

        <div className="annotation-field">
          <label>
            <MessageSquare size={12} />
            Content description
          </label>
          <textarea
            value={contentHint}
            onChange={(e) => setContentHint(e.target.value)}
            placeholder="e.g. 3 feature cards about our AI product..."
            className="annotation-textarea"
            rows={2}
          />
        </div>

        <div className="annotation-field">
          <label>
            <Sparkles size={12} />
            Style hint
          </label>
          <input
            type="text"
            value={styleOverride}
            onChange={(e) => setStyleOverride(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. bold, dark theme, gradient..."
            className="annotation-input"
          />
        </div>
      </div>

      <div className="annotation-editor-footer">
        <span className="annotation-hint">Enter to save · Esc to cancel</span>
        <button className="annotation-save-btn" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
}
