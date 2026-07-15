"use client";

import { useState, useCallback, useRef, useEffect, Component, type ReactNode } from "react";
import { Copy, Download, Check, Code2, Eye, Loader2, AlertTriangle } from "lucide-react";
import type { LayoutNode, DesignTheme } from "@repo/pattern-detection";
import type { ComponentAnnotation } from "../AnnotationEditor";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

class CodeHighlightBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function CodeBlock({ code, framework }: { code: string; framework: "react" | "html" }) {
  const language = framework === "react" ? "tsx" : "markup";
  const fallback = (
    <pre className="premium-code-fallback">
      <code>{code}</code>
    </pre>
  );

  return (
    <CodeHighlightBoundary fallback={fallback}>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          padding: "0.75rem",
          background: "transparent",
          fontSize: "0.72rem",
          lineHeight: "1.6",
        }}
        wrapLongLines
        PreTag="div"
      >
        {code}
      </SyntaxHighlighter>
    </CodeHighlightBoundary>
  );
}

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
  roomId?: string;
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

/* ────────────────────── progress / engagement ────────────────────── */

const PURPOSE_SUGGESTIONS = [
  "Weather app",
  "College website",
  "E-commerce store",
  "SaaS dashboard",
  "Hospital clinic",
  "Restaurant menu",
  "Portfolio",
  "Banking app",
];

/** Early-phase labels (first ~few seconds). After that, rotate WAIT_TIPS. */
const EARLY_STEPS = [
  "Analyzing wireframe structure…",
  "Mapping sketch positions…",
  "Applying purpose theme…",
  "Handing off to AI…",
];

/** Rotate while waiting on Gemini — keeps the wait feeling active. */
const WAIT_TIPS = [
  "AI is sketching your layout into real UI…",
  "Matching labels & copy to your purpose…",
  "Keeping boxes where you drew them (~90%)…",
  "Picking colors from your design theme…",
  "Polishing typography & spacing…",
  "Almost there — wiring up the final details…",
  "Good sketches make great code. Sit tight…",
  "Brewing premium CSS — espresso-strength…",
];

/* ────────────────────── new tab preview ────────────────────── */

const PREVIEW_LOADING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>SketchUI Preview</title>
  <style>
    html, body { height: 100%; margin: 0; background: #09090b; color: #a1a1aa; font-family: ui-sans-serif, system-ui, sans-serif; }
    .wrap { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px; text-align: center; }
    .spin { width: 36px; height: 36px; border: 3px solid rgba(99,102,241,0.25); border-top-color: #818cf8; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { margin: 0; font-size: 1.05rem; color: #e4e4e7; font-weight: 600; }
    p { margin: 0; font-size: 0.85rem; max-width: 280px; line-height: 1.45; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="spin"></div>
    <h1>Generating your UI…</h1>
    <p>This tab will show the live preview as soon as generation finishes.</p>
  </div>
</body>
</html>`;

/** Open blank preview tab during a user gesture (survives async fetch). */
function reservePreviewTab(): Window | null {
  const win = window.open("about:blank", "_blank");
  if (!win) return null;
  try {
    win.document.open();
    win.document.write(PREVIEW_LOADING_HTML);
    win.document.close();
  } catch {
    // Tab may still be usable for navigation later
  }
  return win;
}

function fillHtmlPreviewTab(win: Window | null, htmlCode: string): boolean {
  if (!win || win.closed) return false;
  try {
    const blob = new Blob([htmlCode], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    win.location.href = url;
    win.focus();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  } catch {
    try {
      win.document.open();
      win.document.write(htmlCode);
      win.document.close();
      win.focus();
      return true;
    } catch {
      return false;
    }
  }
}

function closePreviewTab(win: Window | null) {
  if (!win || win.closed) return;
  try {
    win.close();
  } catch {
    /* ignore */
  }
}

function openPreviewInNewTab(htmlCode: string) {
  const blob = new Blob([htmlCode], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

import {
  openReactPreviewInNewTab,
  cleanReactCodeForPreview,
  mountReactPreviewInIframe,
  fillReactPreviewWindow,
} from "../../lib/reactPreviewShell";
/* ────────────────────── component ────────────────────── */

export default function CodeExportPanel({
  layoutTree,
  canvasWidth = 900,
  canvasHeight = 600,
  autoGenerate = false,
  onGenerationComplete,
  annotations,
  roomId,
}: CodeExportPanelProps) {
  const [theme, setTheme] = useState<DesignTheme>("modern-saas");
  const [framework, setFramework] = useState<"react" | "html">("html");
  const [componentName, setComponentName] = useState("GeneratedComponent");
  const [purpose, setPurpose] = useState("");
  const [purposeDraft, setPurposeDraft] = useState("");
  const [showPurposeModal, setShowPurposeModal] = useState(false);
  const [state, setState] = useState<GenerationState>("idle");
  const [generatedCode, setGeneratedCode] = useState("");
  const [generatedFramework, setGeneratedFramework] = useState<"react" | "html" | null>(null);
  const [activeTab, setActiveTab] = useState<OutputTab>("code");
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const autoGenRef = useRef(false);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  /** Reserved during user click so auto-preview isn't blocked after the API returns. */
  const previewTabRef = useRef<Window | null>(null);

  /* ── Progress / engagement state ── */
  const [showProgress, setShowProgress] = useState(false);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [statusLabel, setStatusLabel] = useState(EARLY_STEPS[0]!);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressStartRef = useRef(0);

  /* ── Full preview modal (Layer 6) ── */
  const [showFullPreview, setShowFullPreview] = useState(false);

  /* ── Upgrade modal states ── */
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeWorkspaceId, setUpgradeWorkspaceId] = useState("");
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);
  const [upgradeCoupon, setUpgradeCoupon] = useState("");
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState<"pro" | "team" | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_HTTP_API ?? "http://localhost:4000";

  const handleGenerate = useCallback(async (purposeOverride?: string) => {
    if (!layoutTree) return;
    const purposeText = (purposeOverride ?? purpose).trim();
    if (!purposeText) {
      setPurposeDraft(purpose);
      setShowPurposeModal(true);
      return;
    }
    setPurpose(purposeText);
    setShowPurposeModal(false);
    setState("generating");
    setErrorMsg("");
    setShowProgress(true);
    setDisplayProgress(0);
    setElapsedSec(0);
    setTipIndex(0);
    setStatusLabel(EARLY_STEPS[0]!);
    progressStartRef.current = Date.now();

    // Open preview tab NOW (user gesture) — browsers block window.open after await
    if (!previewTabRef.current || previewTabRef.current.closed) {
      previewTabRef.current = reservePreviewTab();
    }

    // Asymptotic progress: creeps toward ~92% so the bar never feels stuck
    const tickProgress = () => {
      const elapsed = Date.now() - progressStartRef.current;
      // Ease toward 92% over ~45s: 1 - e^(-t/τ)
      const pct = Math.min(92, (1 - Math.exp(-elapsed / 14000)) * 92);
      setDisplayProgress(pct);
      setElapsedSec(Math.floor(elapsed / 1000));

      // Early discrete labels (first ~4s), then rotate tips
      if (elapsed < 900) setStatusLabel(EARLY_STEPS[0]!);
      else if (elapsed < 1800) setStatusLabel(EARLY_STEPS[1]!);
      else if (elapsed < 2800) setStatusLabel(EARLY_STEPS[2]!);
      else if (elapsed < 4000) setStatusLabel(EARLY_STEPS[3]!);
      else {
        const tipIdx = Math.floor((elapsed - 4000) / 3500) % WAIT_TIPS.length;
        setTipIndex(tipIdx);
        setStatusLabel(WAIT_TIPS[tipIdx]!);
      }
    };
    tickProgress();
    progressTimerRef.current = setInterval(tickProgress, 120);

    const stopProgressLoop = () => {
      if (progressTimerRef.current != null) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(`${apiBase}/api/generate-premium-ui`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          layoutTree,
          theme,
          framework,
          componentName,
          canvasWidth,
          canvasHeight,
          purpose: purposeText,
          annotations: annotations ? Object.fromEntries(annotations) : undefined,
          roomId: roomId ? Number(roomId) : undefined,
        }),
      });

      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        if (errData.workspaceId) {
          stopProgressLoop();
          setShowProgress(false);
          closePreviewTab(previewTabRef.current);
          previewTabRef.current = null;
          setUpgradeWorkspaceId(errData.workspaceId);
          setUpgradeCoupon("");
          setSelectedUpgradePlan(null);
          setShowUpgradeModal(true);
          setState("idle");
          return;
        }
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const { code: rawCode } = await res.json();
      // Model sometimes returns HTML even when React was requested
      const looksHtml = /^\s*<!DOCTYPE/i.test(rawCode) || /^\s*<html[\s>]/i.test(rawCode);
      const effectiveFramework = framework === "react" && looksHtml ? "html" : framework;
      const code =
        effectiveFramework === "react" ? cleanReactCodeForPreview(rawCode) : rawCode;

      stopProgressLoop();
      setStatusLabel("Polishing output…");
      setDisplayProgress(96);
      await new Promise((r) => setTimeout(r, 350));
      setStatusLabel("Done! ✨");
      setDisplayProgress(100);
      await new Promise((r) => setTimeout(r, 280));

      setGeneratedCode(code);
      setGeneratedFramework(effectiveFramework);
      setState("preview");
      setActiveTab("preview");
      onGenerationComplete?.();

      // Fill the tab reserved at click-time (survives popup blockers after async)
      const reserved = previewTabRef.current;
      let opened = false;
      if (effectiveFramework === "html") {
        opened = fillHtmlPreviewTab(reserved, code);
        if (!opened) openPreviewInNewTab(code);
      } else {
        opened = fillReactPreviewWindow(reserved, code, componentName);
        if (!opened) openReactPreviewInNewTab(code, componentName);
      }
      previewTabRef.current = opened ? reserved : null;
    } catch (err: any) {
      closePreviewTab(previewTabRef.current);
      previewTabRef.current = null;
      setState("error");
      setErrorMsg(err?.message || "Generation failed. Please try again.");
    } finally {
      stopProgressLoop();
      setShowProgress(false);
      setDisplayProgress(0);
    }
  }, [layoutTree, theme, framework, componentName, canvasWidth, canvasHeight, apiBase, onGenerationComplete, annotations, roomId, purpose]);

  const openPurposeModal = useCallback(() => {
    setPurposeDraft(purpose);
    setShowPurposeModal(true);
  }, [purpose]);

  const confirmPurposeAndGenerate = useCallback(() => {
    const trimmed = purposeDraft.trim();
    if (!trimmed) {
      setErrorMsg("Enter what this UI is for (e.g. weather, college website).");
      return;
    }
    setErrorMsg("");
    void handleGenerate(trimmed);
  }, [purposeDraft, handleGenerate]);

  const handleUpgrade = async (plan?: "pro" | "team") => {
    if (!upgradeWorkspaceId) return;
    const targetPlan = plan ?? selectedUpgradePlan;
    if (!targetPlan) {
      setErrorMsg("Select a plan first.");
      return;
    }

    const coupon = upgradeCoupon.trim();
    if (!coupon) {
      setErrorMsg("Enter a coupon code to upgrade.");
      return;
    }

    setSelectedUpgradePlan(targetPlan);
    setIsUpgrading(true);
    setErrorMsg("");

    // Reserve preview tab on this click so post-upgrade generate can fill it
    if (!previewTabRef.current || previewTabRef.current.closed) {
      previewTabRef.current = reservePreviewTab();
    }

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(`${apiBase}/api/workspaces/${upgradeWorkspaceId}/upgrade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ plan: targetPlan, coupon }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Upgrade failed" }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      setUpgradeSuccess(true);
      setUpgradeCoupon("");
      setSelectedUpgradePlan(null);
      setTimeout(() => {
        setShowUpgradeModal(false);
        setUpgradeSuccess(false);
        setIsUpgrading(false);
        handleGenerate(purpose.trim() || undefined);
      }, 1500);
    } catch (err: any) {
      closePreviewTab(previewTabRef.current);
      previewTabRef.current = null;
      setErrorMsg(err.message || "Failed to upgrade workspace.");
      setIsUpgrading(false);
    }
  };

  // Cleanup progress timer on unmount
  useEffect(() => {
    return () => {
      if (progressTimerRef.current != null) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, []);

  // Auto-generate on mount when triggered from AutoDraw — ask purpose first
  useEffect(() => {
    if (autoGenerate && !autoGenRef.current && layoutTree) {
      autoGenRef.current = true;
      setPurposeDraft(purpose);
      setShowPurposeModal(true);
    }
  }, [autoGenerate, layoutTree, purpose]);

  // Reset autoGen ref when autoGenerate prop becomes false
  useEffect(() => {
    if (!autoGenerate) {
      autoGenRef.current = false;
    }
  }, [autoGenerate]);

  // Mount live preview into the in-panel iframe
  useEffect(() => {
    if (state !== "preview" || !generatedCode || activeTab !== "preview") return;
    const iframe = previewFrameRef.current;
    if (!iframe) return;

    const fw = generatedFramework ?? framework;
    if (fw === "html") {
      iframe.srcdoc = generatedCode;
      return;
    }
    mountReactPreviewInIframe(iframe, generatedCode, componentName);
  }, [state, generatedCode, activeTab, generatedFramework, framework, componentName]);

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

  return (
    <div className="code-panel">
      {/* ── Engaging generation overlay ── */}
      {showProgress && (
        <div className="autodraw-progress-overlay" role="status" aria-live="polite">
          <div className="autodraw-progress-card gen-engage-card">
            {/* Mini “building UI” skeleton — visual engagement trick */}
            <div className="gen-skeleton" aria-hidden>
              <div className="gen-skeleton-nav" />
              <div className="gen-skeleton-body">
                <div className={`gen-skeleton-block tall ${tipIndex % 3 === 0 ? "lit" : ""}`} />
                <div className="gen-skeleton-col">
                  <div className={`gen-skeleton-block ${tipIndex % 3 === 1 ? "lit" : ""}`} />
                  <div className={`gen-skeleton-block short ${tipIndex % 3 === 2 ? "lit" : ""}`} />
                  <div className="gen-skeleton-row">
                    <div className="gen-skeleton-pill" />
                    <div className="gen-skeleton-pill narrow" />
                  </div>
                </div>
              </div>
              <div className="gen-skeleton-shimmer" />
            </div>

            <div className="autodraw-progress-icon gen-engage-icon">✨</div>
            <div className="autodraw-progress-step gen-engage-step">{statusLabel}</div>

            <div className="autodraw-progress-bar-bg gen-engage-bar-bg">
              <div
                className="autodraw-progress-bar-fill gen-engage-bar-fill"
                style={{ width: `${Math.round(displayProgress)}%` }}
              />
            </div>

            <div className="gen-engage-meta">
              <span className="autodraw-progress-percent">{Math.round(displayProgress)}%</span>
              <span className="gen-engage-elapsed">
                {elapsedSec < 1 ? "just started" : `${elapsedSec}s elapsed`}
              </span>
            </div>

            {elapsedSec >= 8 && (
              <p className="gen-engage-hint">
                Premium generation usually takes 15–40s — hang tight.
              </p>
            )}
          </div>
        </div>
      )}



      {/* Purpose */}
      <div className="code-name-field">
        <label>UI Purpose</label>
        <input
          type="text"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value.slice(0, 200))}
          placeholder="e.g. weather app, college website…"
          onKeyDown={(e) => {
            if (e.key === "Enter") openPurposeModal();
          }}
        />
        <p className="code-purpose-hint">
          Content &amp; field labels match this purpose. Layout stays where you sketched (~90%).
        </p>
      </div>

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
            type="button"
            onClick={() => {
              setFramework(f);
              if (generatedFramework && generatedFramework !== f) {
                setGeneratedCode("");
                setGeneratedFramework(null);
                setState("idle");
              }
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
        onClick={openPurposeModal}
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
          <button onClick={openPurposeModal} className="premium-retry-btn">
            Retry
          </button>
        </div>
      )}

      {/* Output Area */}
      {state === "preview" && generatedCode ? (
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
                  const fw = generatedFramework ?? framework;
                  if (fw === "html") openPreviewInNewTab(generatedCode);
                  else openReactPreviewInNewTab(generatedCode, componentName);
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
            <div className="premium-preview-frame-wrap">
              <iframe
                ref={previewFrameRef}
                title="UI Preview"
                className="premium-preview-iframe"
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
              />
              <p className="premium-preview-hint">
                Live preview below. Use <strong>Open Full Preview</strong> if the panel looks blank (allow popups).
              </p>
            </div>
          ) : (
            <div className="premium-code-panel">
              <div className="premium-code-header">
                <span className="premium-code-header-label">
                  {(generatedFramework ?? framework) === "react" ? "React / TSX" : "HTML"} source
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`premium-copy-all-btn ${copied ? "copied" : ""}`}
                  title="Copy all code to clipboard"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied!" : "Copy All"}
                </button>
              </div>
              <div className="premium-code-view">
                <CodeBlock code={generatedCode} framework={generatedFramework ?? framework} />
              </div>
            </div>
          )}
        </div>
      ) : state === "idle" ? (
        <div className="code-output-placeholder">
          <Code2 size={18} style={{ opacity: 0.4 }} />
          <p>
            Click <strong>Generate Premium UI</strong>, set the purpose (weather, college…), then generate code matched to your sketch positions.
          </p>
        </div>
      ) : null}

      {/* ── Purpose modal ── */}
      {showPurposeModal && (
        <div className="project-create-overlay" style={{ backdropFilter: "blur(12px)", zIndex: 10000 }}>
          <div
            className="project-create-modal purpose-modal"
            style={{
              maxWidth: "440px",
              background: "rgba(18,18,24,0.98)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
              padding: "1.5rem",
              borderRadius: "16px",
            }}
          >
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#fafafa", marginBottom: "0.35rem" }}>
              What is this UI for?
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", lineHeight: 1.5, marginBottom: "1rem" }}>
              We keep your sketch layout (~90% same positions) and theme labels, fields, and copy to this purpose.
            </p>

            <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "var(--text-dim)", marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Purpose
            </label>
            <input
              type="text"
              autoFocus
              value={purposeDraft}
              onChange={(e) => setPurposeDraft(e.target.value.slice(0, 200))}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmPurposeAndGenerate();
                if (e.key === "Escape") setShowPurposeModal(false);
              }}
              placeholder="e.g. weather, college website, food delivery…"
              style={{
                width: "100%",
                padding: "0.65rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.35)",
                color: "#fafafa",
                fontSize: "0.9rem",
                marginBottom: "0.75rem",
                outline: "none",
              }}
            />

            <div className="purpose-chip-row">
              {PURPOSE_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`purpose-chip ${purposeDraft === s ? "active" : ""}`}
                  onClick={() => setPurposeDraft(s)}
                >
                  {s}
                </button>
              ))}
            </div>

            {errorMsg && state !== "error" && (
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", color: "#fca5a5", padding: "0.6rem", fontSize: "0.78rem", marginTop: "0.75rem" }}>
                {errorMsg}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button
                type="button"
                onClick={() => {
                  setShowPurposeModal(false);
                  setErrorMsg("");
                }}
                style={{ background: "transparent", border: "none", color: "var(--text-dim)", fontSize: "0.8rem", cursor: "pointer", padding: "0.5rem 0.85rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPurposeAndGenerate}
                className="premium-generate-btn"
                style={{ margin: 0, width: "auto", padding: "0.55rem 1rem" }}
              >
                Generate with this purpose
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Subscription Upgrade Modal ── */}
      {showUpgradeModal && (
        <div className="project-create-overlay" style={{ backdropFilter: 'blur(12px)', zIndex: 10000 }}>
          <div className="project-create-modal" style={{ maxWidth: '540px', background: 'rgba(18,18,24,0.98)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', padding: '2rem', borderRadius: '16px' }}>
            {upgradeSuccess ? (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <div style={{ fontSize: '3.5rem', marginBottom: '1.25rem', color: '#10b981', animation: 'premium-spin 0.5s ease-out' }}>✓</div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 'bold', color: '#fafafa', marginBottom: '0.5rem' }}>Subscription Activated!</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Your plan has been upgraded. Re-generating premium UI code...</p>
              </div>
            ) : (
              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#fafafa', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>Daily limit reached</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: '1.5', marginBottom: '1.75rem' }}>
                  Free accounts are limited to <strong>5 premium generations</strong> per day. Upgrade with a valid coupon to unlock unlimited AI generations.
                </p>

                {errorMsg && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#fca5a5', padding: '0.75rem', fontSize: '0.8rem', marginBottom: '1rem' }}>
                    {errorMsg}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  {/* Pro Plan */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => !isUpgrading && setSelectedUpgradePlan("pro")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (!isUpgrading) setSelectedUpgradePlan("pro");
                      }
                    }}
                    style={{
                      border: selectedUpgradePlan === "pro" ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      background: selectedUpgradePlan === "pro" ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.01)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: isUpgrading ? 'default' : 'pointer',
                      outline: 'none',
                    }}
                  >
                    <div>
                      <h4 style={{ fontWeight: '700', fontSize: '1rem', color: '#fafafa', marginBottom: '0.25rem' }}>Pro Plan</h4>
                      <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--accent-hover)', marginBottom: '0.75rem' }}>
                        $99<span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-dim)' }}>/month</span>
                      </div>
                      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <li>✓ Unlimited AI UI generation</li>
                        <li>✓ Up to 50 active projects</li>
                        <li>✓ Up to 5 collaborators</li>
                      </ul>
                    </div>
                    <div style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', background: selectedUpgradePlan === "pro" ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: selectedUpgradePlan === "pro" ? 'white' : 'var(--text-muted)', border: 'none', fontWeight: '600', fontSize: '0.8rem', textAlign: 'center' }}>
                      {selectedUpgradePlan === "pro" ? "Selected" : "Select Pro"}
                    </div>
                  </div>

                  {/* Team Plan */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => !isUpgrading && setSelectedUpgradePlan("team")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (!isUpgrading) setSelectedUpgradePlan("team");
                      }
                    }}
                    style={{
                      border: selectedUpgradePlan === "team" ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      background: selectedUpgradePlan === "team" ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative',
                      cursor: isUpgrading ? 'default' : 'pointer',
                      outline: 'none',
                    }}
                  >
                    <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: 'white', fontSize: '0.6rem', padding: '2px 8px', borderRadius: '20px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Best Value</div>
                    <div>
                      <h4 style={{ fontWeight: '700', fontSize: '1rem', color: '#fafafa', marginBottom: '0.25rem' }}>Team Plan</h4>
                      <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--accent-hover)', marginBottom: '0.75rem' }}>
                        $299<span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-dim)' }}>/month</span>
                      </div>
                      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <li>✓ Everything in Pro</li>
                        <li>✓ Unlimited active projects</li>
                        <li>✓ Unlimited collaborators</li>
                        <li>✓ Priority generation speed</li>
                      </ul>
                    </div>
                    <div style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', background: selectedUpgradePlan === "team" ? 'linear-gradient(135deg, #a855f7, #6366f1)' : 'rgba(255,255,255,0.06)', color: selectedUpgradePlan === "team" ? 'white' : 'var(--text-muted)', border: 'none', fontWeight: '700', fontSize: '0.8rem', textAlign: 'center' }}>
                      {selectedUpgradePlan === "team" ? "Selected" : "Select Team"}
                    </div>
                  </div>
                </div>

                {/* Coupon verification — required until payment is integrated */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Coupon code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    disabled={isUpgrading}
                    value={upgradeCoupon}
                    onChange={(e) => {
                      setUpgradeCoupon(e.target.value.replace(/\s/g, "").slice(0, 32));
                      if (errorMsg) setErrorMsg("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleUpgrade();
                    }}
                    placeholder="Enter coupon to unlock upgrade"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(0,0,0,0.35)',
                      color: '#fafafa',
                      fontSize: '0.9rem',
                      letterSpacing: '0.08em',
                      outline: 'none',
                    }}
                  />
                  <p style={{ margin: '0.45rem 0 0', fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
                    Payment is not live yet. Upgrades are protected by coupon verification only.
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    disabled={isUpgrading}
                    onClick={() => {
                      setShowUpgradeModal(false);
                      setUpgradeCoupon("");
                      setSelectedUpgradePlan(null);
                      setErrorMsg("");
                    }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '0.8rem', cursor: 'pointer', padding: '0.5rem 1rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isUpgrading || !selectedUpgradePlan || !upgradeCoupon.trim()}
                    onClick={() => void handleUpgrade()}
                    className="premium-generate-btn"
                    style={{
                      margin: 0,
                      width: 'auto',
                      padding: '0.55rem 1rem',
                      opacity: isUpgrading || !selectedUpgradePlan || !upgradeCoupon.trim() ? 0.5 : 1,
                      cursor: isUpgrading || !selectedUpgradePlan || !upgradeCoupon.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isUpgrading ? "Verifying…" : `Confirm ${selectedUpgradePlan === "team" ? "Team" : selectedUpgradePlan === "pro" ? "Pro" : ""} upgrade`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
