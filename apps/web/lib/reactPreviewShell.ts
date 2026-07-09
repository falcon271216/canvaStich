/**
 * Builds a self-contained HTML shell that runs generated React code in a new tab.
 * Uses Babel standalone + React UMD builds from jsDelivr.
 */

export function cleanReactCodeForPreview(reactCode: string): string {
  return reactCode
    .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, "")
    .replace(/^import\s+['"][^'"]+['"];?\s*$/gm, "")
    .replace(/^export\s+default\s+\w+;?\s*$/gm, "")
    .replace(/^export\s+default\s+function\s+/gm, "function ")
    .replace(/^export\s+function\s+/gm, "function ")
    .replace(/^export\s+const\s+/gm, "const ")
    .replace(/:\s*(?:React\.)?(?:FC|FunctionComponent|JSX\.Element|ReactNode|string|number|boolean|any)\b/g, "")
    .replace(/^(?:interface|type)\s+\w+\s*\{[^}]*\}\s*;?\s*$/gm, "")
    .replace(/\s+as\s+\w+/g, "")
    .trim();
}

export function detectReactComponentName(code: string, fallback = "GeneratedComponent"): string {
  const patterns = [
    /export\s+default\s+function\s+([A-Z][A-Za-z0-9]*)/,
    /function\s+([A-Z][A-Za-z0-9]*)\s*\(/,
    /const\s+([A-Z][A-Za-z0-9]*)\s*=\s*\([^)]*\)\s*=>/,
    /const\s+([A-Z][A-Za-z0-9]*)\s*=\s*function/,
  ];

  for (const pattern of patterns) {
    const match = code.match(pattern);
    if (match?.[1]) return match[1];
  }

  return fallback;
}

export function buildReactPreviewHtml(reactCode: string, componentNameHint?: string): string {
  const cleanCode = cleanReactCodeForPreview(reactCode);
  const componentName = detectReactComponentName(
    cleanCode,
    componentNameHint?.replace(/[^a-zA-Z0-9]/g, "") || "GeneratedComponent",
  );

  const mountSnippet = `
var __rootEl = document.getElementById("root");
var __loading = document.getElementById("loading-msg");
if (__loading) __loading.remove();
var __root = ReactDOM.createRoot(__rootEl);
var __Component = typeof ${componentName} !== "undefined" ? ${componentName} : null;
if (!__Component) {
  throw new Error("Component ${componentName} was not found in generated code.");
}
__root.render(React.createElement(__Component));
`.trim();

  const executableCode = `${cleanCode}\n\n${mountSnippet}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SketchUI Preview</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #fff; }
    #preview-bar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      height: 44px; background: #111; color: white;
      display: flex; align-items: center; padding: 0 16px; gap: 12px;
      font-family: sans-serif; font-size: 13px;
    }
    #preview-bar button {
      padding: 4px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px;
    }
    #app { margin-top: 44px; min-height: calc(100vh - 44px); }
    #viewport-container { transition: max-width 0.3s ease; margin: 0 auto; }
    #loading-msg {
      display: flex; align-items: center; justify-content: center;
      min-height: calc(100vh - 44px); color: #666; font-size: 14px;
    }
    #error-msg {
      display: none; padding: 24px; margin: 20px;
      background: #1a0000; border: 1px solid #dc2626; border-radius: 8px;
      color: #fca5a5; font-size: 13px; white-space: pre-wrap; font-family: monospace;
    }
  </style>
</head>
<body>
  <div id="preview-bar">
    <span style="color:#888">✨ SketchUI Preview</span>
    <div style="display:flex;gap:6px;margin-left:16px">
      <button type="button" onclick="setViewport('100%')" style="background:#333;color:white">🖥 Desktop</button>
      <button type="button" onclick="setViewport('768px')" style="background:#333;color:white">📱 Tablet</button>
      <button type="button" onclick="setViewport('375px')" style="background:#333;color:white">📲 Mobile</button>
    </div>
    <div style="margin-left:auto;display:flex;gap:6px">
      <button type="button" onclick="copyCode()" style="background:#333;color:white">Copy Code</button>
      <button type="button" onclick="downloadHTML()" style="background:#2563EB;color:white">⬇ Download .html</button>
    </div>
  </div>

  <div id="app">
    <div id="viewport-container">
      <div id="root"><div id="loading-msg">Loading preview...</div></div>
    </div>
  </div>
  <div id="error-msg"></div>

  <script>
    const SOURCE_CODE = ${JSON.stringify(reactCode)};

    function setViewport(width) {
      document.getElementById("viewport-container").style.maxWidth = width;
      document.getElementById("app").style.background = width === "100%" ? "" : "#e5e7eb";
      document.getElementById("app").style.padding = width === "100%" ? "" : "20px";
    }

    function copyCode() {
      navigator.clipboard.writeText(SOURCE_CODE).then(function() { alert("Copied!"); });
    }

    function downloadHTML() {
      var a = document.createElement("a");
      a.href = "data:text/html," + encodeURIComponent(document.documentElement.outerHTML);
      a.download = "sketchui-component.html";
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
        }, timeoutMs || 20000);

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
        await loadScript("https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.development.js");
        await loadScript("https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.development.js");
        await loadScript("https://cdn.jsdelivr.net/npm/@babel/standalone@7.26.0/babel.min.js");

        // Tailwind is optional — don't block preview on it
        loadScript("https://cdn.tailwindcss.com", 12000).catch(function(err) {
          console.warn("Tailwind CDN skipped:", err.message);
        });

        if (typeof Babel === "undefined") {
          throw new Error("Babel failed to initialize.");
        }

        var userCode = ${JSON.stringify(executableCode)};
        var transformed = Babel.transform(userCode, {
          presets: ["react"],
          filename: "component.jsx",
        }).code;

        var scriptEl = document.createElement("script");
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
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}
