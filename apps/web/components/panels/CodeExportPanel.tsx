"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Copy, Download, Check, Code2, Eye, Loader2, AlertTriangle, Maximize2 } from "lucide-react";
import type { LayoutNode, DesignTheme } from "@repo/pattern-detection";
import type { ComponentAnnotation } from "../AnnotationEditor";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import FullPreviewModal from "../FullPreviewModal";

/* ────────────────────── types ────────────────────── */

type GenerationState = "idle" | "generating" | "preview" | "error";
type OutputTab = "preview" | "code";

interface CodeExportPanelProps {
  layoutTree: LayoutNode | null;
  canvasWidth?: number;
  canvasHeight?: number;
  autoGenerate?: boolean;
  onGenerationComplete?: () => void;
  annotations?: Map<string, ComponentAnnotation>;
}

/* ────────────────────── theme data ────────────────────── */

const THEMES: { id: DesignTheme; label: string; color: string }[] = [
  { id: "modern-saas",   label: "Modern SaaS",   color: "#2563EB" },
  { id: "glassmorphism", label: "Glassmorphism",  color: "#7C3AED" },
  { id: "brutalist",     label: "Brutalist",      color: "#000000" },
  { id: "soft-ui",       label: "Soft UI",        color: "#94A3B8" },
  { id: "editorial",     label: "Editorial",      color: "#DC2626" },
  { id: "dark-premium",  label: "Dark Premium",   color: "#D4AF37" },
];

/* ────────────────────── progress step labels ────────────────────── */

const PROGRESS_STEPS = [
  { label: "Analyzing wireframe structure...", progress: 10 },
  { label: "Detecting page sections...", progress: 25 },
  { label: "Building layout tree...", progress: 40 },
  { label: "Generating premium UI with AI...", progress: 60 },
  { label: "Polishing output...", progress: 85 },
  { label: "Done! ✨", progress: 100 },
];

/* ────────────────────── React wrapper for iframe preview ────────────────────── */

function wrapReactInHTML(reactCode: string): string {
  // Use string concatenation for closing script tags to avoid
  // the browser prematurely closing the script element
  const closeScript = '<' + '/script>';
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

export default function CodeExportPanel({
  layoutTree,
  canvasWidth = 900,
  canvasHeight = 600,
  autoGenerate = false,
  onGenerationComplete,
  annotations,
}: CodeExportPanelProps) {
  const [theme, setTheme] = useState<DesignTheme>("modern-saas");
  const [framework, setFramework] = useState<"react" | "html">("html");
  const [componentName, setComponentName] = useState("GeneratedComponent");
  const [state, setState] = useState<GenerationState>("idle");
  const [generatedCode, setGeneratedCode] = useState("");
  const [activeTab, setActiveTab] = useState<OutputTab>("preview");
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const autoGenRef = useRef(false);

  /* ── Progress state (Layer 7) ── */
  const [progressStep, setProgressStep] = useState(0);
  const [showProgress, setShowProgress] = useState(false);

  /* ── Full preview modal (Layer 6) ── */
  const [showFullPreview, setShowFullPreview] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_HTTP_API ?? "http://localhost:4000";

  const handleGenerate = useCallback(async () => {
    if (!layoutTree) return;
    setState("generating");
    setErrorMsg("");
    setShowProgress(true);
    setProgressStep(0);

    // Simulate progress steps
    const progressTimers: ReturnType<typeof setTimeout>[] = [];
    progressTimers.push(setTimeout(() => setProgressStep(1), 300));
    progressTimers.push(setTimeout(() => setProgressStep(2), 700));
    progressTimers.push(setTimeout(() => setProgressStep(3), 1200));

    try {
      const res = await fetch(`${apiBase}/api/generate-premium-ui`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layoutTree,
          theme,
          framework,
          componentName,
          canvasWidth,
          canvasHeight,
          annotations: annotations ? Object.fromEntries(annotations) : undefined,
        }),
      });

      setProgressStep(4);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const { code } = await res.json();
      setProgressStep(5);
      await new Promise(r => setTimeout(r, 400));

      setGeneratedCode(code);
      setState("preview");
      setActiveTab("preview");
      onGenerationComplete?.();
    } catch (err: any) {
      setState("error");
      setErrorMsg(err?.message || "Generation failed. Please try again.");
    } finally {
      setShowProgress(false);
      setProgressStep(0);
      progressTimers.forEach(clearTimeout);
    }
  }, [layoutTree, theme, framework, componentName, canvasWidth, canvasHeight, apiBase, onGenerationComplete, annotations]);

  // Auto-generate on mount when triggered from AutoDraw
  useEffect(() => {
    if (autoGenerate && !autoGenRef.current && layoutTree) {
      autoGenRef.current = true;
      handleGenerate();
    }
  }, [autoGenerate, layoutTree, handleGenerate]);

  // Reset autoGen ref when autoGenerate prop becomes false
  useEffect(() => {
    if (!autoGenerate) {
      autoGenRef.current = false;
    }
  }, [autoGenerate]);

  const handleCopy = useCallback(async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = generatedCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [generatedCode]);

  const handleDownload = useCallback(() => {
    if (!generatedCode) return;
    const ext = framework === "react" ? "tsx" : "html";
    const mimeType = framework === "html" ? "text/html" : "text/javascript";
    const blob = new Blob([generatedCode], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${componentName}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [generatedCode, framework, componentName]);

  /* ── Empty state ── */
  if (!layoutTree) {
    return (
      <div className="code-empty">
        <Code2 size={20} style={{ color: "var(--text-dim)", marginBottom: "0.5rem" }} />
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
          Draw some UI components on the canvas first, then generate premium code.
        </p>
      </div>
    );
  }

  const currentProgress = PROGRESS_STEPS[progressStep] || PROGRESS_STEPS[0]!;

  return (
    <div className="code-panel">
      {/* ── Progress overlay (Layer 7) ── */}
      {showProgress && (
        <div className="autodraw-progress-overlay">
          <div className="autodraw-progress-card">
            <div className="autodraw-progress-icon">✨</div>
            <div className="autodraw-progress-step">
              {currentProgress.label}
            </div>
            <div className="autodraw-progress-bar-bg">
              <div
                className="autodraw-progress-bar-fill"
                style={{ width: `${currentProgress.progress}%` }}
              />
            </div>
            <div className="autodraw-progress-percent">
              {currentProgress.progress}%
            </div>
          </div>
        </div>
      )}

      {/* ── Full preview modal (Layer 6) ── */}
      {showFullPreview && generatedCode && (
        <FullPreviewModal
          code={generatedCode}
          framework={framework}
          componentName={componentName}
          onClose={() => setShowFullPreview(false)}
          onRegenerate={() => {
            setShowFullPreview(false);
            handleGenerate();
          }}
        />
      )}

      {/* Component Name */}
      <div className="code-name-field">
        <label>Component Name</label>
        <input
          type="text"
          value={componentName}
          onChange={(e) =>
            setComponentName(e.target.value.replace(/[^a-zA-Z0-9]/g, "") || "Component")
          }
          placeholder="GeneratedComponent"
        />
      </div>

      {/* Framework Toggle */}
      <div className="code-framework-toggle">
        {(["html", "react"] as const).map((f) => (
          <button
            key={f}
            onClick={() => {
              setFramework(f);
              if (state === "preview") setState("idle");
            }}
            className={`code-framework-btn ${framework === f ? "active" : ""}`}
          >
            {f === "react" ? "⚛️ React" : "🌐 HTML"}
          </button>
        ))}
      </div>

      {/* Theme Selector */}
      <div className="premium-theme-section">
        <label className="premium-theme-label">Design Theme</label>
        <div className="premium-theme-grid">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`premium-theme-card ${theme === t.id ? "selected" : ""}`}
            >
              <div
                className="premium-theme-swatch"
                style={{ background: t.color }}
              />
              <span className="premium-theme-name">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={state === "generating"}
        className="premium-generate-btn"
      >
        {state === "generating" ? (
          <>
            <Loader2 size={14} className="premium-spinner" />
            Generating premium UI...
          </>
        ) : (
          <>✨ Generate Premium UI</>
        )}
      </button>

      {/* Error State */}
      {state === "error" && (
        <div className="premium-error">
          <AlertTriangle size={14} />
          <span>{errorMsg}</span>
          <button onClick={handleGenerate} className="premium-retry-btn">
            Retry
          </button>
        </div>
      )}

      {/* Output Area */}
      {state === "preview" && generatedCode && (
        <div className="premium-output">
          {/* Tab bar + actions */}
          <div className="premium-output-toolbar">
            <div className="premium-output-tabs">
              <button
                onClick={() => setActiveTab("preview")}
                className={`premium-output-tab ${activeTab === "preview" ? "active" : ""}`}
              >
                <Eye size={12} />
                Preview
              </button>
              <button
                onClick={() => setActiveTab("code")}
                className={`premium-output-tab ${activeTab === "code" ? "active" : ""}`}
              >
                <Code2 size={12} />
                Code
              </button>
            </div>
            <div className="premium-output-actions">
              <button
                onClick={() => setShowFullPreview(true)}
                className="code-action-btn"
                title="Full screen preview"
              >
                <Maximize2 size={13} />
                Expand
              </button>
              <button onClick={handleDownload} className="code-action-btn" title="Download file">
                <Download size={13} />
                {framework === "html" ? ".html" : ".tsx"}
              </button>
              <button onClick={handleCopy} className="code-action-btn" title="Copy to clipboard">
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Content */}
          {activeTab === "preview" ? (
            <iframe
              srcDoc={
                framework === "html"
                  ? generatedCode
                  : wrapReactInHTML(generatedCode)
              }
              className="premium-preview-iframe"
              sandbox="allow-scripts allow-same-origin"
              title="Premium UI Preview"
            />
          ) : (
            <div className="premium-code-view">
              <SyntaxHighlighter
                language={framework === "react" ? "jsx" : "htmlbars"}
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  padding: "0.75rem",
                  background: "transparent",
                  fontSize: "0.72rem",
                  lineHeight: "1.6",
                }}
                wrapLongLines
              >
                {generatedCode}
              </SyntaxHighlighter>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
