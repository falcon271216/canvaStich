import { Router, Request, Response } from "express";
import type { Router as RouterType } from "express";

const router: RouterType = Router();

/**
 * POST /api/generate-code
 *
 * Generates React/Tailwind or HTML code from a layout tree.
 * This runs server-side to enable caching and future Prettier integration.
 *
 * Body: { layoutTree: LayoutNode, framework: 'react' | 'html', componentName: string }
 * Returns: { code: string, framework: string }
 */
router.post("/generate-code", async (req: Request, res: Response): Promise<void> => {
  try {
    const { layoutTree, framework = "react", componentName = "GeneratedComponent" } = req.body;

    if (!layoutTree) {
      res.status(400).json({ error: "layoutTree is required" });
      return;
    }

    if (!["react", "html"].includes(framework)) {
      res.status(400).json({ error: "framework must be 'react' or 'html'" });
      return;
    }

    // Sanitize component name
    const safeName = (componentName as string).replace(/[^a-zA-Z0-9]/g, "") || "GeneratedComponent";

    // Dynamic import to avoid issues if pattern-detection not built yet
    const { generateFullComponent } = await import("@repo/pattern-detection");
    const code = generateFullComponent(layoutTree, safeName, framework);

    res.status(200).json({
      code,
      framework,
      componentName: safeName,
    });
  } catch (err) {
    console.error("Code generation error:", err);
    res.status(500).json({ error: "Code generation failed" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   PREMIUM AI CODE GENERATION
   ═══════════════════════════════════════════════════════════════ */

// In-memory LRU cache for generated code
const CACHE_MAX = 50;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const generationCache = new Map<string, { code: string; timestamp: number }>();

function cacheGet(key: string): string | null {
  const entry = generationCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    generationCache.delete(key);
    return null;
  }
  return entry.code;
}

function cacheSet(key: string, code: string): void {
  // Evict oldest entries if cache is full
  if (generationCache.size >= CACHE_MAX) {
    const oldest = generationCache.keys().next().value;
    if (oldest) generationCache.delete(oldest);
  }
  generationCache.set(key, { code, timestamp: Date.now() });
}

// Simple rate limiter: per-IP, 20 requests per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) {
    return false;
  }
  entry.count++;
  return true;
}

// Simple hash for cache key
function simpleHash(obj: unknown): string {
  const str = JSON.stringify(obj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString(36);
}

/**
 * POST /api/generate-premium-ui
 *
 * AI-powered premium UI generation via Claude API.
 * Converts a layout tree + design theme into a production-quality
 * styled component (HTML or React).
 *
 * Body: { layoutTree, theme, framework, componentName, canvasWidth?, canvasHeight? }
 * Returns: { code: string, framework: string, theme: string, cached: boolean }
 */
router.post("/generate-premium-ui", async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      layoutTree,
      theme = "modern-saas",
      framework = "html",
      componentName = "GeneratedComponent",
      canvasWidth,
      canvasHeight,
      annotations,
    } = req.body;

    // Validate required fields
    if (!layoutTree) {
      res.status(400).json({ error: "layoutTree is required" });
      return;
    }

    if (!["react", "html"].includes(framework)) {
      res.status(400).json({ error: "framework must be 'react' or 'html'" });
      return;
    }

    // Validate theme
    const { VALID_THEMES, buildPremiumPrompt, stripCodeFences } = await import("@repo/pattern-detection");
    if (!VALID_THEMES.includes(theme)) {
      res.status(400).json({ error: `Invalid theme. Must be one of: ${VALID_THEMES.join(", ")}` });
      return;
    }

    // Rate limit
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkRateLimit(clientIp)) {
      res.status(429).json({ error: "Rate limit exceeded. Please wait a moment and try again." });
      return;
    }

    // Sanitize component name
    const safeName = (componentName as string).replace(/[^a-zA-Z0-9]/g, "") || "GeneratedComponent";

    // Check cache
    const cacheKey = `premium:${simpleHash({ layoutTree, theme, framework })}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      res.status(200).json({ code: cached, framework, theme, cached: true });
      return;
    }

    // Check for API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "GEMINI_API_KEY not configured on server" });
      return;
    }

    const model = "gemini-3.5-flash";

    // Build prompts
    const { system, user } = buildPremiumPrompt({
      layoutTree,
      theme,
      framework,
      componentName: safeName,
      canvasWidth: canvasWidth ?? 900,
      canvasHeight: canvasHeight ?? 600,
    });

    // Append annotations to the user prompt if present
    let annotatedUser = user;
    if (annotations && typeof annotations === "object" && Object.keys(annotations).length > 0) {
      let annotationBlock = "\n\nUSER ANNOTATIONS (use these to customize the output):\n";
      for (const [compId, ann] of Object.entries(annotations) as [string, any][]) {
        annotationBlock += `\n- Component "${compId}":`;
        if (ann.semanticLabel) annotationBlock += `\n  Label: ${ann.semanticLabel}`;
        if (ann.contentHint) annotationBlock += `\n  Content: ${ann.contentHint}`;
        if (ann.styleOverride) annotationBlock += `\n  Style: ${ann.styleOverride}`;
      }
      annotatedUser += annotationBlock;
    }

    // Call Gemini generateContent API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: system }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: annotatedUser }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 16000,
          temperature: 0.4,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Gemini API error:", response.status, errorBody);

      // Parse the error message for user-friendly display
      let detail = `Gemini API status ${response.status}`;
      try {
        const errJson = JSON.parse(errorBody);
        if (errJson?.error?.message) {
          detail = errJson.error.message;
        }
      } catch {}

      res.status(502).json({
        error: detail,
        detail: `Status ${response.status}`,
      });
      return;
    }

    const data = await response.json() as {
      candidates: { content: { parts: { text: string }[] } }[];
    };

    const rawCode = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawCode) {
      res.status(502).json({ error: "AI returned empty response" });
      return;
    }

    // Check if response was truncated (finish_reason)
    const finishReason = (data as any).candidates?.[0]?.finishReason;
    const wasTruncated = finishReason === "MAX_TOKENS" || finishReason === "STOP" && !rawCode.trim().endsWith(">") && !rawCode.trim().endsWith("}") && !rawCode.trim().endsWith(";");

    // Clean up any markdown fences
    let code = stripCodeFences(rawCode);

    // Auto-repair truncated HTML: close any unclosed tags
    if (framework === "html" && !code.includes("</html>")) {
      // Find unclosed tags and close them
      const openTags: string[] = [];
      const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)(?:\s[^>]*)?\/?>/g;
      let m;
      while ((m = tagRegex.exec(code)) !== null) {
        const fullMatch = m[0]!;
        const tagName = m[1]!.toLowerCase();
        const selfClosing = ["meta", "link", "br", "hr", "img", "input", "area", "base", "col", "embed", "source", "track", "wbr"];
        if (selfClosing.includes(tagName) || fullMatch.endsWith("/>")) continue;
        if (fullMatch.startsWith("</")) {
          const idx = openTags.lastIndexOf(tagName);
          if (idx !== -1) openTags.splice(idx, 1);
        } else {
          openTags.push(tagName);
        }
      }
      // Close tags in reverse order
      for (let i = openTags.length - 1; i >= 0; i--) {
        code += `</${openTags[i]}>`;
      }
    }

    // Auto-repair truncated React: close unclosed JSX
    if (framework === "react") {
      // Strip any trailing incomplete JSX tag
      const lastOpenBracket = code.lastIndexOf("<");
      const lastCloseBracket = code.lastIndexOf(">");
      if (lastOpenBracket > lastCloseBracket) {
        // There's an unclosed tag at the end — remove it
        code = code.slice(0, lastOpenBracket).trimEnd();
      }

      // Ensure the component function is properly closed
      const openBraces = (code.match(/\{/g) || []).length;
      const closeBraces = (code.match(/\}/g) || []).length;
      const missing = openBraces - closeBraces;
      if (missing > 0) {
        // Add closing JSX fragments and braces
        code += "\n" + "}".repeat(missing);
      }
    }

    // Cache the result
    cacheSet(cacheKey, code);

    res.status(200).json({
      code,
      framework,
      theme,
      componentName: safeName,
      cached: false,
    });
  } catch (err: any) {
    console.error("Premium generation error:", err);
    res.status(500).json({
      error: "Premium UI generation failed",
      detail: err?.message || "Unknown error",
    });
  }
});

export default router;
