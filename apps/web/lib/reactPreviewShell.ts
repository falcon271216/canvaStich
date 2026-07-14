/**
 * Reliable React+Tailwind preview for generated SketchUI code.
 *
 * Critical HTML rule: never embed raw JSON.stringify() into <script> without
 * escaping "</script>" — the browser closes the tag early and dumps the rest
 * of the bootstrap as visible page text (the bug in production screenshots).
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
const TAILWIND_CDNS = ["https://cdn.tailwindcss.com"];

/** Safe for embedding inside HTML <script>…</script> tags. */
function jsonForHtmlScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Base64 UTF-8 — maximally safe payload for script tags. */
function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  if (typeof btoa === "function") {
    return btoa(binary);
  }
  // Node SSR fallback without assuming Buffer types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Buf = (globalThis as any).Buffer;
  if (Buf) return Buf.from(text, "utf8").toString("base64");
  throw new Error("No base64 encoder available");
}

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

export function buildReactPreviewHtml(reactCode: string, componentNameHint?: string): string {
  const cleanCode = cleanReactCodeForPreview(reactCode);
  const componentName = detectReactComponentName(
    cleanCode,
    componentNameHint?.replace(/[^a-zA-Z0-9]/g, "") || "GeneratedComponent",
  );

  // Embed payloads as base64 so "</script>" inside generated JSX can never
  // break out of the HTML <script> tag and dump bootstrap JS onto the page.
  const sourceB64 = toBase64Utf8(reactCode);
  const cleanB64 = toBase64Utf8(cleanCode);
  const nameJson = jsonForHtmlScript(componentName);
  const reactUrls = jsonForHtmlScript(REACT_CDNS);
  const reactDomUrls = jsonForHtmlScript(REACT_DOM_CDNS);
  const babelUrls = jsonForHtmlScript(BABEL_CDNS);
  const twUrls = jsonForHtmlScript(TAILWIND_CDNS);

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
    <span style="color:#94a3b8">SketchUI React Preview</span>
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
    function b64ToUtf8(b64) {
      try {
        return decodeURIComponent(escape(atob(b64)));
      } catch (e1) {
        try { return atob(b64); } catch (e2) { return ""; }
      }
    }

    var SOURCE_CODE = b64ToUtf8(${jsonForHtmlScript(sourceB64)});
    var USER_JSX = b64ToUtf8(${jsonForHtmlScript(cleanB64)});
    var COMPONENT_NAME = ${nameJson};
    var REACT_URLS = ${reactUrls};
    var REACT_DOM_URLS = ${reactDomUrls};
    var BABEL_URLS = ${babelUrls};
    var TAILWIND_URLS = ${twUrls};

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
        if (!USER_JSX || !USER_JSX.trim()) {
          throw new Error("Empty React source — regenerate the UI.");
        }

        await loadFirst(REACT_URLS);
        await loadFirst(REACT_DOM_URLS);
        await loadFirst(BABEL_URLS);
        try { await loadFirst(TAILWIND_URLS); } catch (twErr) {
          console.warn("Tailwind CDN unavailable:", twErr);
        }

        if (typeof React === "undefined") throw new Error("React failed to load from CDN.");
        if (typeof ReactDOM === "undefined") throw new Error("ReactDOM failed to load from CDN.");
        if (typeof Babel === "undefined") throw new Error("Babel failed to load from CDN.");

        var wrapped =
          USER_JSX +
          ";\\nwindow[" + JSON.stringify(COMPONENT_NAME) + "] = " + COMPONENT_NAME + ";" +
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

        try {
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
            "Define: function " + COMPONENT_NAME + "() { ... }"
          );
        }

        var rootEl = document.getElementById("root");
        rootEl.innerHTML = "";
        if (!ReactDOM.createRoot) throw new Error("ReactDOM.createRoot missing — need React 18.");
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
 * Prefer same-origin /preview/react. Avoid blob URLs (they break CDNs and
 * previously dumped script text when JSON contained </script>).
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

  // Popup blocked — write into about:blank (same-origin inheritance)
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

  alert("Please allow popups for SketchUI, then click Open Full Preview again.");
}

export function mountReactPreviewInIframe(
  iframe: HTMLIFrameElement,
  reactCode: string,
  componentNameHint?: string,
): void {
  const html = buildReactPreviewHtml(reactCode, componentNameHint);

  const write = () => {
    const doc = iframe.contentDocument;
    if (!doc) {
      // srcdoc with base64 payloads is now safe (no raw </script> in source)
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
