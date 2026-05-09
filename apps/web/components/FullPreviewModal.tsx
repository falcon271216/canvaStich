"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { X, Monitor, Tablet, Smartphone, Copy, Download, Check, ExternalLink, RotateCcw, Pencil, Eye } from "lucide-react";

/* ────────────────────── types ────────────────────── */

type ViewMode = "desktop" | "tablet" | "mobile";

interface FullPreviewModalProps {
  code: string;
  framework: "react" | "html";
  componentName: string;
  onClose: () => void;
  onRegenerate: () => void;
}

/* ────────────────────── helpers ────────────────────── */

const VIEWPORT_WIDTHS: Record<ViewMode, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

function wrapReactInHTML(reactCode: string): string {
  const closeScript = "<" + "/script>";
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://unpkg.com/react@18/umd/react.development.js">${closeScript}
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js">${closeScript}
  <script src="https://unpkg.com/@babel/standalone/babel.min.js">${closeScript}
  <script src="https://cdn.tailwindcss.com">${closeScript}
  <style>body { margin: 0; }</style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${reactCode}
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(App || (() => null)));
  ${closeScript}
</body>
</html>`;
}

/* ────────────────────── component ────────────────────── */

export default function FullPreviewModal({
  code,
  framework,
  componentName,
  onClose,
  onRegenerate,
}: FullPreviewModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("desktop");
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState(code);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update edited code when new code comes in
  useEffect(() => {
    setEditedCode(code);
    setIsEditing(false);
  }, [code]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(editedCode);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = editedCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [editedCode]);

  const handleDownload = useCallback(() => {
    const ext = framework === "react" ? "tsx" : "html";
    const mimeType = framework === "html" ? "text/html" : "text/javascript";
    const blob = new Blob([editedCode], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${componentName}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [editedCode, framework, componentName]);

  const handleOpenInCodePen = useCallback(() => {
    const form = document.createElement("form");
    form.action = "https://codepen.io/pen/define";
    form.method = "POST";
    form.target = "_blank";

    const data = JSON.stringify({
      html: framework === "html" ? editedCode : "",
      js: framework === "react" ? editedCode : "",
      title: `SketchUI — ${componentName}`,
    });
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "data";
    input.value = data;

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }, [editedCode, framework, componentName]);

  const previewDoc = framework === "html" ? editedCode : wrapReactInHTML(editedCode);
  const lineCount = editedCode.split("\n").length;

  return (
    <div className="fullpreview-overlay">
      {/* Top bar */}
      <div className="fullpreview-topbar">
        <div className="fullpreview-topbar-left">
          <button onClick={onClose} className="fullpreview-close-btn">
            <X size={16} />
            Close
          </button>
          <span className="fullpreview-divider">|</span>
          <span className="fullpreview-title">
            {isEditing ? "✏️ Editing" : "👁️ Preview"} — {componentName}
          </span>
        </div>

        {/* Viewport switcher */}
        <div className="fullpreview-viewport-switcher">
          {(["desktop", "tablet", "mobile"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`fullpreview-viewport-btn ${viewMode === mode ? "active" : ""}`}
            >
              {mode === "desktop" ? <Monitor size={14} /> : mode === "tablet" ? <Tablet size={14} /> : <Smartphone size={14} />}
              {mode}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="fullpreview-actions">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="fullpreview-action-btn"
          >
            {isEditing ? <Eye size={14} /> : <Pencil size={14} />}
            {isEditing ? "Preview" : "Edit"}
          </button>
          <button onClick={onRegenerate} className="fullpreview-action-btn accent">
            <RotateCcw size={14} />
            Regenerate
          </button>
          <button onClick={handleCopy} className="fullpreview-action-btn">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy"}
          </button>
          <button onClick={handleDownload} className="fullpreview-action-btn primary">
            <Download size={14} />
            {framework === "html" ? ".html" : ".tsx"}
          </button>
          <button onClick={handleOpenInCodePen} className="fullpreview-action-btn">
            <ExternalLink size={14} />
            CodePen
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="fullpreview-content">
        {isEditing ? (
          <div className="fullpreview-editor">
            <div className="fullpreview-editor-header">
              <span>{lineCount} lines</span>
              <span>{framework === "html" ? "HTML" : "React / TSX"}</span>
            </div>
            <textarea
              ref={textareaRef}
              value={editedCode}
              onChange={(e) => setEditedCode(e.target.value)}
              className="fullpreview-editor-textarea"
              spellCheck={false}
            />
          </div>
        ) : (
          <div className="fullpreview-iframe-wrapper">
            <div
              className="fullpreview-iframe-container"
              style={{
                width: VIEWPORT_WIDTHS[viewMode],
                maxWidth: "100%",
                borderRadius: viewMode === "desktop" ? "8px" : "20px",
              }}
            >
              <iframe
                srcDoc={previewDoc}
                className="fullpreview-iframe"
                sandbox="allow-scripts allow-same-origin"
                title="Full Preview"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
