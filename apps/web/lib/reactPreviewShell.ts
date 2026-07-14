/**
 * Builds a self-contained HTML shell that runs generated React + Tailwind code in a new tab.
 * Uses Babel standalone + React 18 UMD + Tailwind CDN (all awaited before mount).
 */

const HOOK_NAMES = [
  "useState",
  "useEffect",
  "useRef",
  "useMemo",
  "useCallback",
  "useReducer",
  "useContext",
  "useLayoutEffect",
  "useId",
  "useImperativeHandle",
] as const;

export function cleanReactCodeForPreview(reactCode: string): string {
  let code = reactCode
    .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, "")
    .replace(/^import\s+['"][^'"]+['"];?\s*$/gm, "")
    .replace(/^export\s+default\s+\w+;?\s*$/gm, "")
    .replace(/^export\s+default\s+function\s+/gm, "function ")
    .replace(/^export\s+function\s+/gm, "function ")
    .replace(/^export\s+const\s+/gm, "const ")
    .replace(/^export\s+\{[^}]+\};?\s*$/gm, "")
    .replace(/:\s*(?:React\.)?(?:FC|FunctionComponent|JSX\.Element|ReactElement|ReactNode|string|number|boolean|any|void|null|undefined)\b/g, "")
    .replace(/^(?:interface|type)\s+\w+[^{;]*\{[\s\S]*?\}\s*;?\s*$/gm, "")
    .replace(/^(?:interface|type)\s+\w+[^=\n]*=\s*[^;]+;?\s*$/gm, "")
    .replace(/\s+as\s+(?:const|string|number|boolean|any|\w+)/g, "")
    .trim();

  for (const hook of HOOK_NAMES) {
    // Start of line / after non-dot identifier boundary
    code = code.replace(new RegExp(`(^|[^\\w.$])${hook}(\\s*\\()`, "gm"), `$1React.${hook}$2`);
  }

  return code;
}

export function detectReactComponentName(code: string, fallback = "GeneratedComponent"): string {
  const patterns = [
    /export\s+default\s+function\s+([A-Z][A-Za-z0-9]*)/,
    /function\s+([A-Z][A-Za-z0-9]*)\s*\(/,
    /const\s+([A-Z][A-Za-z0-9]*)\s*=\s*\([^)]*\)\s*=>/,
    /const\s+([A-Z][A-Za-z0-9]*)\s*=\s*function/,
    /const\s+([A-Z][A-Za-z0-9]*)\s*=\s*React\.memo/,
  ];

  for (const pattern of patterns) {
    const match = code.match(pattern);
    if (match?.[1]) return match[1];
  }

  return fallback || "GeneratedComponent";
}

export function buildReactPreviewHtml(reactCode: string, componentNameHint?: string): string {
  const cleanCode = cleanReactCodeForPreview(reactCode);
  const componentName = detectReactComponentName(
    cleanCode,
    componentNameHint?.replace(/[^a-zA-Z0-9]/g, "") || "GeneratedComponent",
  );

  // User code + mount (Babel will compile JSX in the component body)
  const executableCode = `
${cleanCode}

(function mountSketchPreview() {
  var rootEl = document.getElementById("root");
  var loading = document.getElementById("loading-msg");
  if (loading) loading.remove();
  var Component = (typeof ${componentName} !== "undefined") ? ${componentName} : null;
  if (!Component) {
    throw new Error("Component '${componentName}' was not found. Make sure the generated file defines function ${componentName}().");
  }
  if (!window.ReactDOM || !ReactDOM.createRoot) {
    throw new Error("ReactDOM.createRoot is unavailable.");
  }
  ReactDOM.createRoot(rootEl).render(React.createElement(Component));
})();
`.trim();

  const sourceJson = JSON.stringify(reactCode);
  const execJson = JSON.stringify(executableCode);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SketchUI React Preview</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    html, body { margin: 0; min-height: 100%; background: #f8fafc; font-family: "Plus Jakarta Sans", Inter, system-ui, sans-serif; }
    #preview-bar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      height: 44px; background: #0f172a; color: white;
      display: flex; align-items: center; padding: 0 16px; gap: 12px;
      font-size: 13px; box-shadow: 0 1px 0 rgba(255,255,255,0.06);
    }
    #preview-bar button {
      padding: 4px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px;
      background: #1e293b; color: #e2e8f0;
    }
    #preview-bar button:hover { background: #334155; }
    #app { margin-top: 44px; min-height: calc(100vh - 44px); }
    #viewport-container { transition: max-width 0.3s ease; margin: 0 auto; background: #fff; min-height: calc(100vh - 44px); }
    #loading-msg {
      display: flex; align-items: center; justify-content: center;
      min-height: calc(100vh - 44px); color: #64748b; font-size: 14px; gap: 8px;
    }
    #error-msg {
      display: none; padding: 24px; margin: 20px;
      background: #1a0000; border: 1px solid #dc2626; border-radius: 8px;
      color: #fca5a5; font-size: 13px; white-space: pre-wrap; font-family: ui-monospace, monospace;
    }
  </style>
</head>
<body>
  <div id="preview-bar">
    <span style="color:#94a3b8">✨ SketchUI React Preview</span>
    <div style="display:flex;gap:6px;margin-left:16px">
      <button type="button" onclick="setViewport('100%')">🖥 Desktop</button>
      <button type="button" onclick="setViewport('768px')">📱 Tablet</button>
      <button type="button" onclick="setViewport('375px')">📲 Mobile</button>
    </div>
    <div style="margin-left:auto;display:flex;gap:6px">
      <button type="button" onclick="copyCode()">Copy Code</button>
      <button type="button" onclick="downloadCode()" style="background:#2563eb;color:#fff">⬇ Download</button>
    </div>
  </div>

  <div id="app">
    <div id="viewport-container">
      <div id="root"><div id="loading-msg">Loading React + Tailwind…</div></div>
    </div>
  </div>
  <div id="error-msg"></div>

  <script>
    const SOURCE_CODE = ${sourceJson};

    function setViewport(width) {
      document.getElementById("viewport-container").style.maxWidth = width;
      document.getElementById("app").style.background = width === "100%" ? "" : "#e2e8f0";
      document.getElementById("app").style.padding = width === "100%" ? "" : "20px";
    }

    function copyCode() {
      navigator.clipboard.writeText(SOURCE_CODE).then(function() { alert("Copied!"); });
    }

    function downloadCode() {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([SOURCE_CODE], { type: "text/plain" }));
      a.download = "GeneratedComponent.jsx";
      a.click();
    }

    function showError(msg) {
      var el = document.getElementById("error-msg");
      el.textContent = "Preview Error:\\n\\n" + msg;
      el.style.display = "block";
      var loading = document.getElementById("loading-msg");
      if (loading) loading.textContent = "Preview failed — see error below.";
    }

    window.addEventListener("error", function(e) {
      showError(e.message || "Unknown runtime error");
    });
    window.addEventListener("unhandledrejection", function(e) {
      showError(String(e.reason || "Unhandled promise rejection"));
    });

    function loadScript(src, timeoutMs) {
      return new Promise(function(resolve, reject) {
        var done = false;
        var timer = setTimeout(function() {
          if (done) return;
          done = true;
          reject(new Error("Timed out loading: " + src));
        }, timeoutMs || 25000);

        var s = document.createElement("script");
        s.src = src;
        s.crossOrigin = "anonymous";
        s.onload = function() {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve();
        };
        s.onerror = function() {
          if (done) return;
          done = true;
          clearTimeout(timer);
          reject(new Error("Failed to load: " + src));
        };
        document.head.appendChild(s);
      });
    }

    async function bootstrap() {
      try {
        await loadScript("https://unpkg.com/react@18.3.1/umd/react.development.js");
        await loadScript("https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js");
        await loadScript("https://unpkg.com/@babel/standalone@7.26.0/babel.min.js");

        // Tailwind MUST be ready before first paint of utilities
        await loadScript("https://cdn.tailwindcss.com");
        try {
          if (window.tailwind && typeof window.tailwind.config !== "function") {
            window.tailwind.config = {
              theme: {
                extend: {
                  fontFamily: {
                    sans: ["Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"],
                  },
                },
              },
            };
          }
        } catch (_) {}

        // Give the CDN a tick to register the MutationObserver
        await new Promise(function(r) { setTimeout(r, 80); });

        if (typeof React === "undefined") throw new Error("React failed to load.");
        if (typeof ReactDOM === "undefined") throw new Error("ReactDOM failed to load.");
        if (typeof Babel === "undefined") throw new Error("Babel failed to load.");

        var userCode = ${execJson};
        var transformed = Babel.transform(userCode, {
          presets: [["react", { runtime: "classic" }]],
          filename: "GeneratedComponent.jsx",
        }).code;

        var scriptEl = document.createElement("script");
        scriptEl.type = "text/javascript";
        scriptEl.textContent = transformed;
        document.body.appendChild(scriptEl);
      } catch (err) {
        showError(err && err.message ? err.message : String(err));
      }
    }

    bootstrap();
  </script>
</body>
</html>`;
}

export function openReactPreviewInNewTab(reactCode: string, componentNameHint?: string): void {
  const html = buildReactPreviewHtml(reactCode, componentNameHint);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    // Popup blocked — fall back to downloading the preview HTML
    const a = document.createElement("a");
    a.href = url;
    a.download = "sketchui-react-preview.html";
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 180000);
}
