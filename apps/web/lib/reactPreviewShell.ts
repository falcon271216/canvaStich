/**
 * Reliable React+Tailwind preview for generated SketchUI code.
 *
 * Opens a same-origin about:blank window and document.writes the shell so CDN
 * scripts (React / Babel / Tailwind) load. Blob URLs are opaque and frequently
 * fail CDN loads when crossOrigin is set — avoid that path for execution.
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

const REACT_CDNS = [
  "https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.development.js",
  "https://unpkg.com/react@18.3.1/umd/react.development.js",
];
const REACT_DOM_CDNS = [
  "https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.development.js",
  "https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js",
];
const BABEL_CDNS = [
  "https://cdn.jsdelivr.net/npm/@babel/standalone@7.26.0/babel.min.js",
  "https://unpkg.com/@babel/standalone@7.26.0/babel.min.js",
];
const TAILWIND_CDNS = [
  "https://cdn.tailwindcss.com",
  "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4",
];

export function cleanReactCodeForPreview(reactCode: string): string {
  let code = String(reactCode || "")
    .replace(/^```(?:tsx|jsx|javascript|js|react)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, "")
    .replace(/^import\s+['"][^'"]+['"];?\s*$/gm, "")
    .replace(/^export\s+default\s+\w+;?\s*$/gm, "")
    .replace(/^export\s+default\s+function\s+/gm, "function ")
    .replace(/^export\s+function\s+/gm, "function ")
    .replace(/^export\s+const\s+/gm, "const ")
    .replace(/^export\s+\{[^}]+\};?\s*$/gm, "")
    .replace(
      /:\s*(?:React\.)?(?:FC|FunctionComponent|JSX\.Element|ReactElement|ReactNode|string|number|boolean|any|void|null|undefined)\b/g,
      "",
    )
    .replace(/^(?:interface|type)\s+\w+[^{;]*\{[\s\S]*?\}\s*;?\s*$/gm, "")
    .replace(/^(?:interface|type)\s+\w+[^=\n]*=\s*[^;]+;?\s*$/gm, "")
    .replace(/\s+as\s+(?:const|string|number|boolean|any|\w+)/g, "")
    .trim();

  for (const hook of HOOK_NAMES) {
    code = code.replace(new RegExp(`(^|[^\\w.$])${hook}(\\s*\\()`, "gm"), `$1React.${hook}$2`);
  }

  // Ensure at least one top-level component exists
  if (!/function\s+[A-Z][A-Za-z0-9]*\s*\(/.test(code) && !/const\s+[A-Z][A-Za-z0-9]*\s*=/.test(code)) {
    code = `function GeneratedComponent() {\n  return (\n${code}\n  );\n}`;
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

function cdnListJson(urls: string[]): string {
  return JSON.stringify(urls);
}

export function buildReactPreviewHtml(reactCode: string, componentNameHint?: string): string {
  const cleanCode = cleanReactCodeForPreview(reactCode);
  const componentName = detectReactComponentName(
    cleanCode,
    componentNameHint?.replace(/[^a-zA-Z0-9]/g, "") || "GeneratedComponent",
  );

  // Keep user JSX and mount SEPARATE: transform only the component, then mount from plain JS.
  // Mixing IIFE + Babel can leave the component in a temporal-dead-zone / scope mess.
  const sourceJson = JSON.stringify(reactCode);
  const cleanJson = JSON.stringify(cleanCode);
  const nameJson = JSON.stringify(componentName);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SketchUI React Preview</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    html, body { margin: 0; min-height: 100%; background: #f8fafc; font-family: "Plus Jakarta Sans", system-ui, sans-serif; }
    #preview-bar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      height: 44px; background: #0f172a; color: white;
      display: flex; align-items: center; padding: 0 16px; gap: 12px;
      font-size: 13px;
    }
    #preview-bar button {
      padding: 4px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px;
      background: #1e293b; color: #e2e8f0;
    }
    #app { margin-top: 44px; min-height: calc(100vh - 44px); }
    #viewport-container { margin: 0 auto; background: #fff; min-height: calc(100vh - 44px); }
    #loading-msg {
      display: flex; align-items: center; justify-content: center;
      min-height: calc(100vh - 44px); color: #64748b; font-size: 14px;
    }
    #error-msg {
      display: none; padding: 20px; margin: 16px;
      background: #1a0000; border: 1px solid #dc2626; border-radius: 8px;
      color: #fca5a5; font-size: 13px; white-space: pre-wrap; font-family: ui-monospace, monospace;
    }
  </style>
</head>
<body>
  <div id="preview-bar">
    <span style="color:#94a3b8">✨ SketchUI React Preview</span>
    <div style="display:flex;gap:6px;margin-left:16px">
      <button type="button" onclick="setViewport('100%')">Desktop</button>
      <button type="button" onclick="setViewport('768px')">Tablet</button>
      <button type="button" onclick="setViewport('375px')">Mobile</button>
    </div>
    <div style="margin-left:auto;display:flex;gap:6px">
      <button type="button" onclick="copyCode()">Copy Code</button>
    </div>
  </div>

  <div id="app">
    <div id="viewport-container">
      <div id="root"><div id="loading-msg">Loading React + Tailwind…</div></div>
    </div>
  </div>
  <div id="error-msg"></div>

  <script>
    var SOURCE_CODE = ${sourceJson};
    var USER_JSX = ${cleanJson};
    var COMPONENT_NAME = ${nameJson};
    var REACT_URLS = ${cdnListJson(REACT_CDNS)};
    var REACT_DOM_URLS = ${cdnListJson(REACT_DOM_CDNS)};
    var BABEL_URLS = ${cdnListJson(BABEL_CDNS)};
    var TAILWIND_URLS = ${cdnListJson(TAILWIND_CDNS)};

    function setViewport(width) {
      document.getElementById("viewport-container").style.maxWidth = width;
      document.getElementById("app").style.background = width === "100%" ? "" : "#e2e8f0";
      document.getElementById("app").style.padding = width === "100%" ? "" : "20px";
    }

    function copyCode() {
      navigator.clipboard.writeText(SOURCE_CODE).then(function () { alert("Copied!"); });
    }

    function showError(msg) {
      var el = document.getElementById("error-msg");
      el.style.display = "block";
      el.textContent = "Preview Error:\\n\\n" + msg;
      var loading = document.getElementById("loading-msg");
      if (loading) loading.textContent = "Preview failed — see error below.";
      console.error("[SketchUI Preview]", msg);
    }

    window.addEventListener("error", function (e) {
      showError(e.message || "Unknown runtime error");
    });

    function loadScript(src) {
      return new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.src = src;
        // Do NOT set crossOrigin — breaks CDN loads on about:blank / some browsers
        s.onload = function () { resolve(src); };
        s.onerror = function () { reject(new Error("Failed: " + src)); };
        document.head.appendChild(s);
      });
    }

    function loadFirst(urls) {
      var chain = Promise.reject(new Error("no urls"));
      urls.forEach(function (url) {
        chain = chain.catch(function () { return loadScript(url); });
      });
      return chain;
    }

    async function bootstrap() {
      try {
        await loadFirst(REACT_URLS);
        await loadFirst(REACT_DOM_URLS);
        await loadFirst(BABEL_URLS);
        try {
          await loadFirst(TAILWIND_URLS);
        } catch (twErr) {
          console.warn("Tailwind CDN unavailable, continuing without it:", twErr);
        }

        if (typeof React === "undefined") throw new Error("React failed to load from CDN.");
        if (typeof ReactDOM === "undefined") throw new Error("ReactDOM failed to load from CDN.");
        if (typeof Babel === "undefined") throw new Error("Babel failed to load from CDN.");

        // Compile JSX → plain JS that assigns component on window
        var wrapped =
          USER_JSX +
          "\\n;" +
          "window." + COMPONENT_NAME + " = " + COMPONENT_NAME + ";" +
          "window.__SKETCH_UI_COMPONENT__ = " + COMPONENT_NAME + ";";

        var transformed;
        try {
          transformed = Babel.transform(wrapped, {
            presets: [["react", { runtime: "classic" }]],
            filename: "GeneratedComponent.jsx",
          }).code;
        } catch (babelErr) {
          throw new Error("Babel compile failed: " + (babelErr && babelErr.message ? babelErr.message : babelErr));
        }

        // Execute compiled component in global scope
        try {
          // Prefer indirect eval so function declarations bind to window in sloppy... 
          // Babel emits "use strict", so we MUST assign onto window (done in wrapped source).
          (0, eval)(transformed);
        } catch (runErr) {
          throw new Error("Runtime error in generated UI: " + (runErr && runErr.message ? runErr.message : runErr));
        }

        var Component =
          (typeof window[COMPONENT_NAME] === "function" && window[COMPONENT_NAME]) ||
          (typeof window.__SKETCH_UI_COMPONENT__ === "function" && window.__SKETCH_UI_COMPONENT__) ||
          null;

        if (!Component) {
          throw new Error(
            "Component '" + COMPONENT_NAME + "' was not found after compile.\\n" +
            "Make sure the generated code defines: function " + COMPONENT_NAME + "() { ... }"
          );
        }

        var rootEl = document.getElementById("root");
        rootEl.innerHTML = "";
        if (!ReactDOM.createRoot) {
          throw new Error("ReactDOM.createRoot missing — React 18 CDN required.");
        }
        ReactDOM.createRoot(rootEl).render(React.createElement(Component));
      } catch (err) {
        showError(err && err.message ? err.message : String(err));
      }
    }

    bootstrap();
  </script>
</body>
</html>`;
}

/**
 * Open preview via same-origin /preview/react (CDN-safe).
 * Falls back to about:blank document.write, then blob.
 */
export function openReactPreviewInNewTab(reactCode: string, componentNameHint?: string): void {
  const name =
    componentNameHint?.replace(/[^a-zA-Z0-9]/g, "") ||
    detectReactComponentName(cleanReactCodeForPreview(reactCode));

  try {
    sessionStorage.setItem("sketchui-react-code", reactCode);
    sessionStorage.setItem("sketchui-react-name", name);
  } catch (err) {
    console.warn("[SketchUI] sessionStorage unavailable", err);
  }

  const previewPath = `${window.location.origin}/preview/react`;
  const win = window.open(previewPath, "_blank");
  if (win) return;

  // Popup blocked — try about:blank write
  const html = buildReactPreviewHtml(reactCode, name);
  const blank = window.open("about:blank", "_blank");
  if (blank) {
    try {
      blank.document.open();
      blank.document.write(html);
      blank.document.close();
      return;
    } catch (_) {
      try {
        blank.close();
      } catch (_) {}
    }
  }

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sketchui-react-preview.html";
  document.body.appendChild(a);
  a.click();
  a.remove();
  alert("Popup blocked. Allow popups, or open the downloaded sketchui-react-preview.html file.");
  setTimeout(() => URL.revokeObjectURL(url), 180000);
}

/**
 * Write preview HTML into an existing iframe (in-panel preview).
 */
export function mountReactPreviewInIframe(
  iframe: HTMLIFrameElement,
  reactCode: string,
  componentNameHint?: string,
): void {
  const html = buildReactPreviewHtml(reactCode, componentNameHint);

  const write = () => {
    const doc = iframe.contentDocument;
    if (!doc) {
      iframe.srcdoc = html;
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
  };

  if (iframe.contentDocument?.location?.href === "about:blank" || iframe.src === "about:blank") {
    write();
    return;
  }

  iframe.onload = () => {
    iframe.onload = null;
    write();
  };
  iframe.src = "about:blank";
}
