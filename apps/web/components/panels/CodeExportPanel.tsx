"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Copy, Download, Check, Code2, Eye, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import type { LayoutNode, DesignTheme } from "@repo/pattern-detection";
import type { ComponentAnnotation } from "../AnnotationEditor";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

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

/* ────────────────────── new tab preview ────────────────────── */

function openPreviewInNewTab(htmlCode: string) {
  const blob = new Blob([htmlCode], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  const previewTab = window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function openReactPreviewInNewTab(reactCode: string) {
  const shell = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SketchUI Preview</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { margin: 0; }
    #preview-bar {
      position: fixed; top: 0; left: 0; right: 0;
      height: 44px; background: #111; color: white;
      display: flex; align-items: center; padding: 0 16px;
      gap: 12px; z-index: 9999; font-family: sans-serif; font-size: 13px;
    }
    #preview-bar button {
      padding: 4px 12px; border-radius: 6px; border: none;
      cursor: pointer; font-size: 12px;
    }
    #app { margin-top: 44px; }
    #viewport-container {
      transition: max-width 0.3s ease;
      margin: 0 auto;
    }
  </style>
</head>
<body>
  <div id="preview-bar">
    <span style="color: #888">✨ SketchUI Preview</span>
    <div style="display:flex; gap:6px; margin-left: 16px">
      <button onclick="setViewport('100%')" style="background:#333; color:white">🖥 Desktop</button>
      <button onclick="setViewport('768px')" style="background:#333; color:white">📱 Tablet</button>
      <button onclick="setViewport('375px')" style="background:#333; color:white">📲 Mobile</button>
    </div>
    <div style="margin-left:auto; display:flex; gap:6px">
      <button onclick="copyCode()" style="background:#333; color:white">Copy Code</button>
      <button onclick="downloadHTML()" style="background:#2563EB; color:white">⬇ Download .html</button>
    </div>
  </div>
  
  <div id="app">
    <div id="viewport-container">
      <div id="root"></div>
    </div>
  </div>
  
  <script>
    function setViewport(width) {
      document.getElementById('viewport-container').style.maxWidth = width;
      document.getElementById('app').style.background = width === '100%' ? '' : '#e5e7eb';
      document.getElementById('app').style.padding = width === '100%' ? '' : '20px';
    }
    
    // We escape the React code to prevent script injection issues
    const SOURCE_CODE = ${JSON.stringify(reactCode)};
    
    function copyCode() {
      navigator.clipboard.writeText(SOURCE_CODE).then(() => alert('Copied!'));
    }
    
    function downloadHTML() {
      const a = document.createElement('a');
      a.href = 'data:text/html,' + encodeURIComponent(document.documentElement.outerHTML);
      a.download = 'sketchui-component.html';
      a.click();
    }
  </script>
  
  <script type="text/babel">
    ${reactCode}
    
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(App || (() => null)));
  </script>
</body>
</html>`;
  
  const blob = new Blob([shell], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 5000);
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

      // Auto-open preview tab immediately
      setTimeout(() => {
        if (framework === 'html') openPreviewInNewTab(code);
        else openReactPreviewInNewTab(code);
      }, 100);
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
                onClick={() => {
                  if (framework === 'html') openPreviewInNewTab(generatedCode);
                  else openReactPreviewInNewTab(generatedCode);
                }}
                className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 transition font-medium text-xs"
              >
                ↗ Open Full Preview
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
            <div className="premium-code-view" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', background: '#111' }}>
              Preview opened in new tab.
            </div>
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
