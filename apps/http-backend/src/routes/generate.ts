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

export default router;
