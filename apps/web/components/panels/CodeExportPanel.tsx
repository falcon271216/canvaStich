"use client";

import { useState, useCallback } from "react";
import { Copy, Download, Check, Code2 } from "lucide-react";
import type { LayoutNode, Framework } from "@repo/pattern-detection";
import { generateFullComponent } from "@repo/pattern-detection";

interface CodeExportPanelProps {
  layoutTree: LayoutNode | null;
}

export default function CodeExportPanel({ layoutTree }: CodeExportPanelProps) {
  const [framework, setFramework] = useState<Framework>("react");
  const [code, setCode] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [componentName, setComponentName] = useState("GeneratedComponent");

  const handleGenerate = useCallback(async () => {
    if (!layoutTree) return;
    setGenerating(true);
    try {
      // Client-side generation (fast, no server call needed)
      const generated = generateFullComponent(layoutTree, componentName, framework);
      setCode(generated);
    } catch (err) {
      console.error("Code generation failed:", err);
      setCode("// Error generating code. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [layoutTree, framework, componentName]);

  const handleCopy = useCallback(async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);

  const handleDownload = useCallback(() => {
    if (!code) return;
    const ext = framework === "react" ? "tsx" : "html";
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${componentName}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [code, framework, componentName]);

  if (!layoutTree) {
    return (
      <div className="code-empty">
        <Code2 size={20} style={{ color: "var(--text-dim)", marginBottom: "0.5rem" }} />
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
          Build a layout tree first, then generate code.
        </p>
      </div>
    );
  }

  return (
    <div className="code-panel">
      {/* Component name input */}
      <div className="code-name-field">
        <label>Component Name</label>
        <input
          type="text"
          value={componentName}
          onChange={(e) => setComponentName(e.target.value.replace(/[^a-zA-Z0-9]/g, '') || 'Component')}
          placeholder="GeneratedComponent"
        />
      </div>

      {/* Framework toggle */}
      <div className="code-framework-toggle">
        {(["react", "html"] as Framework[]).map((f) => (
          <button
            key={f}
            onClick={() => { setFramework(f); setCode(""); }}
            className={`code-framework-btn ${framework === f ? "active" : ""}`}
          >
            {f === "react" ? "⚛️ React" : "🌐 HTML"}
          </button>
        ))}
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="code-generate-btn"
      >
        {generating ? (
          <>Generating...</>
        ) : (
          <>
            <Code2 size={14} />
            Generate {framework === "react" ? "React + Tailwind" : "HTML"} Code
          </>
        )}
      </button>

      {/* Code preview */}
      {code && (
        <>
          <div className="code-toolbar">
            <span className="code-lang-badge">
              {framework === "react" ? "TSX" : "HTML"}
            </span>
            <div className="code-toolbar-actions">
              <button onClick={handleCopy} className="code-action-btn" title="Copy to clipboard">
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copied!" : "Copy"}
              </button>
              <button onClick={handleDownload} className="code-action-btn" title="Download file">
                <Download size={13} />
                Download
              </button>
            </div>
          </div>
          <div className="code-preview">
            <pre>
              <code>{code}</code>
            </pre>
          </div>
        </>
      )}
    </div>
  );
}
