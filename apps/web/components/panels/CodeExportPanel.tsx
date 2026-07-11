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
  // Don't revoke too early — give fonts and external resources time to load
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

import { openReactPreviewInNewTab } from "../../lib/reactPreviewShell";
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
  const [state, setState] = useState<GenerationState>("idle");
  const [generatedCode, setGeneratedCode] = useState("");
  const [generatedFramework, setGeneratedFramework] = useState<"react" | "html" | null>(null);
  const [activeTab, setActiveTab] = useState<OutputTab>("code");
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const autoGenRef = useRef(false);

  /* ── Progress state (Layer 7) ── */
  const [progressStep, setProgressStep] = useState(0);
  const [showProgress, setShowProgress] = useState(false);

  /* ── Full preview modal (Layer 6) ── */
  const [showFullPreview, setShowFullPreview] = useState(false);

  /* ── Upgrade modal states ── */
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeWorkspaceId, setUpgradeWorkspaceId] = useState("");
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);

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
          annotations: annotations ? Object.fromEntries(annotations) : undefined,
          roomId: roomId ? Number(roomId) : undefined,
        }),
      });

      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        if (errData.workspaceId) {
          setUpgradeWorkspaceId(errData.workspaceId);
          setShowUpgradeModal(true);
          setState("idle");
          return;
        }
      }

      setProgressStep(4);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const { code } = await res.json();
      setProgressStep(5);
      await new Promise(r => setTimeout(r, 400));

      setGeneratedCode(code);
      setGeneratedFramework(framework);
      setState("preview");
      setActiveTab("code");
      onGenerationComplete?.();

      // Auto-open preview tab immediately
      setTimeout(() => {
        if (framework === 'html') openPreviewInNewTab(code);
        else openReactPreviewInNewTab(code, componentName);
      }, 100);
    } catch (err: any) {
      setState("error");
      setErrorMsg(err?.message || "Generation failed. Please try again.");
    } finally {
      setShowProgress(false);
      setProgressStep(0);
      progressTimers.forEach(clearTimeout);
    }
  }, [layoutTree, theme, framework, componentName, canvasWidth, canvasHeight, apiBase, onGenerationComplete, annotations, roomId]);

  const handleUpgrade = async (plan: "pro" | "team") => {
    if (!upgradeWorkspaceId) return;
    setIsUpgrading(true);
    setErrorMsg("");

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(`${apiBase}/api/workspaces/${upgradeWorkspaceId}/upgrade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ plan }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Upgrade failed" }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      setUpgradeSuccess(true);
      setTimeout(() => {
        setShowUpgradeModal(false);
        setUpgradeSuccess(false);
        setIsUpgrading(false);
        handleGenerate();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to upgrade workspace.");
      setIsUpgrading(false);
    }
  };

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
            <div className="premium-code-view" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', background: '#111' }}>
              Preview opened in new tab.
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
            Click <strong>Generate Premium UI</strong> to create{" "}
            {framework === "react" ? "React" : "HTML"} code from your wireframe.
          </p>
        </div>
      ) : null}

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
                  Free accounts are limited to <strong>5 premium generations</strong> per day. Upgrade to a subscription model to unlock unlimited AI generations.
                </p>

                {errorMsg && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#fca5a5', padding: '0.75rem', fontSize: '0.8rem', marginBottom: '1rem' }}>
                    {errorMsg}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                  {/* Pro Plan */}
                  <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1.25rem', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
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
                    <button
                      disabled={isUpgrading}
                      onClick={() => handleUpgrade("pro")}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', background: 'var(--accent)', color: 'white', border: 'none', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', transition: 'opacity 0.15s' }}
                    >
                      {isUpgrading ? "Upgrading..." : "Select Pro"}
                    </button>
                  </div>

                  {/* Team Plan */}
                  <div style={{ border: '1px solid var(--accent)', borderRadius: '12px', padding: '1.25rem', background: 'rgba(99,102,241,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
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
                    <button
                      disabled={isUpgrading}
                      onClick={() => handleUpgrade("team")}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', background: 'linear-gradient(135deg, #a855f7, #6366f1)', color: 'white', border: 'none', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', transition: 'opacity 0.15s' }}
                    >
                      {isUpgrading ? "Upgrading..." : "Select Team"}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    disabled={isUpgrading}
                    onClick={() => setShowUpgradeModal(false)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '0.8rem', cursor: 'pointer', padding: '0.5rem 1rem' }}
                  >
                    Cancel
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
