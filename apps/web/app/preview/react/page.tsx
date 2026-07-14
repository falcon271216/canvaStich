"use client";

import { useEffect, useRef, useState } from "react";
import { mountReactPreviewInIframe } from "../../../lib/reactPreviewShell";

const CODE_KEY = "sketchui-react-code";
const NAME_KEY = "sketchui-react-name";

/**
 * Same-origin dedicated preview route. Uses a fullscreen iframe + about:blank
 * write so React/Babel/Tailwind CDNs load (blob: URLs were failing).
 */
export default function ReactPreviewPage() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const code = sessionStorage.getItem(CODE_KEY);
      const name = sessionStorage.getItem(NAME_KEY) || "GeneratedComponent";
      if (!code) {
        setError("No React preview data found. Generate UI again and click Open Full Preview.");
        return;
      }
      const iframe = iframeRef.current;
      if (!iframe) return;
      mountReactPreviewInIframe(iframe, code, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  if (error) {
    return (
      <div style={{ padding: 32, fontFamily: "system-ui", color: "#b91c1c", maxWidth: 640 }}>
        <h1 style={{ fontSize: 18, marginBottom: 8 }}>React preview failed</h1>
        <p style={{ whiteSpace: "pre-wrap" }}>{error}</p>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      title="SketchUI React Preview"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: "none", background: "#fff" }}
      sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
    />
  );
}
