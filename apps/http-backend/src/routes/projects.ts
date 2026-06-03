import { Router, Request, Response } from "express";
import type { Router as RouterType } from "express";
import { prismaClient } from "@repo/db/client";
import { middleware } from "../middleware";
import {
  CreateWorkspaceSchema,
  CreateProjectSchema,
  UpdateProjectSchema,
} from "@repo/common/types";

const router: RouterType = Router();

/* ────────────────────── Plan limits ────────────────────── */

const PLAN_LIMITS: Record<string, { projects: number; codeExports: number; collaborators: number }> = {
  free:  { projects: 3,  codeExports: 10,  collaborators: 1 },
  pro:   { projects: 50, codeExports: 500, collaborators: 5 },
  team:  { projects: -1, codeExports: -1,  collaborators: -1 }, // unlimited
};

function getLimit(plan: string) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS["free"]!;
}

/* ────────────────────── Workspace routes ────────────────────── */

// POST /api/workspaces — Create workspace (auto-creates on first use)
router.post("/workspaces", middleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = CreateWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    const userId = (req as any).userId as string;
    const workspace = await prismaClient.workspace.create({
      data: {
        name: parsed.data.name,
        ownerId: userId,
        plan: parsed.data.plan ?? "free",
      },
    });

    res.status(201).json({ workspace });
  } catch (err) {
    console.error("Create workspace error:", err);
    res.status(500).json({ error: "Failed to create workspace" });
  }
});

// GET /api/workspaces — List user's workspaces
router.get("/workspaces", middleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId as string;
    const workspaces = await prismaClient.workspace.findMany({
      where: { ownerId: userId },
      include: { _count: { select: { projects: true } } },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ workspaces });
  } catch (err) {
    console.error("List workspaces error:", err);
    res.status(500).json({ error: "Failed to list workspaces" });
  }
});

/* ────────────────────── Project routes ────────────────────── */

// POST /api/projects — Create project
router.post("/projects", middleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = CreateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    const userId = (req as any).userId as string;

    // Verify workspace ownership
    const workspace = await prismaClient.workspace.findFirst({
      where: { id: parsed.data.workspaceId, ownerId: userId },
      include: { _count: { select: { projects: true } } },
    });

    if (!workspace) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    // Check plan limit
    const limits = getLimit(workspace.plan);
    if (limits.projects !== -1 && workspace._count.projects >= limits.projects) {
      res.status(403).json({
        error: `Plan limit reached. ${workspace.plan} plan allows ${limits.projects} projects. Upgrade to create more.`,
        currentPlan: workspace.plan,
        limit: limits.projects,
      });
      return;
    }

    const project = await prismaClient.project.create({
      data: {
        workspaceId: parsed.data.workspaceId,
        name: parsed.data.name,
        roomId: parsed.data.roomId,
      },
    });

    // Track usage event
    await prismaClient.usageEvent.create({
      data: {
        workspaceId: parsed.data.workspaceId,
        eventType: "project_create",
        metadata: { projectId: project.id, name: project.name },
      },
    });

    res.status(201).json({ project });
  } catch (err) {
    console.error("Create project error:", err);
    res.status(500).json({ error: "Failed to create project" });
  }
});

// GET /api/projects — List projects (optionally filter by workspace)
router.get("/projects", middleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId as string;
    const workspaceId = req.query.workspaceId as string | undefined;

    const where: Record<string, unknown> = {
      workspace: { ownerId: userId },
    };
    if (workspaceId) {
      where.workspaceId = workspaceId;
    }

    const projects = await prismaClient.project.findMany({
      where,
      include: {
        workspace: { select: { name: true, plan: true } },
        room: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ projects });
  } catch (err) {
    console.error("List projects error:", err);
    res.status(500).json({ error: "Failed to list projects" });
  }
});

// GET /api/projects/:id — Get project details
router.get("/projects/:id", middleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId as string;
    const project = await prismaClient.project.findFirst({
      where: {
        id: req.params.id,
        workspace: { ownerId: userId },
      },
      include: {
        workspace: { select: { name: true, plan: true } },
        room: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    res.json({ project });
  } catch (err) {
    console.error("Get project error:", err);
    res.status(500).json({ error: "Failed to get project" });
  }
});

// PATCH /api/projects/:id — Update project (save layout tree, generated code)
router.patch("/projects/:id", middleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = UpdateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    const userId = (req as any).userId as string;

    // Verify ownership
    const existing = await prismaClient.project.findFirst({
      where: {
        id: req.params.id,
        workspace: { ownerId: userId },
      },
    });

    if (!existing) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const project = await prismaClient.project.update({
      where: { id: req.params.id },
      data: parsed.data,
    });

    res.json({ project });
  } catch (err) {
    console.error("Update project error:", err);
    res.status(500).json({ error: "Failed to update project" });
  }
});

// DELETE /api/projects/:id — Delete project
router.delete("/projects/:id", middleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId as string;

    const existing = await prismaClient.project.findFirst({
      where: {
        id: req.params.id,
        workspace: { ownerId: userId },
      },
    });

    if (!existing) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    await prismaClient.project.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (err) {
    console.error("Delete project error:", err);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// POST /api/projects/:id/export — Track code export usage event
router.post("/projects/:id/export", middleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId as string;

    const project = await prismaClient.project.findFirst({
      where: {
        id: req.params.id,
        workspace: { ownerId: userId },
      },
      include: { workspace: true },
    });

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // Check export limit
    const limits = getLimit(project.workspace.plan);
    if (limits.codeExports !== -1) {
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);

      const exportCount = await prismaClient.usageEvent.count({
        where: {
          workspaceId: project.workspaceId,
          eventType: "code_export",
          createdAt: { gte: thisMonth },
        },
      });

      if (exportCount >= limits.codeExports) {
        res.status(403).json({
          error: `Monthly export limit reached. ${project.workspace.plan} plan allows ${limits.codeExports} exports/month.`,
          currentPlan: project.workspace.plan,
          used: exportCount,
          limit: limits.codeExports,
        });
        return;
      }
    }

    await prismaClient.usageEvent.create({
      data: {
        workspaceId: project.workspaceId,
        eventType: "code_export",
        metadata: {
          projectId: project.id,
          framework: req.body.framework || "react",
        },
      },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Export tracking error:", err);
    res.status(500).json({ error: "Failed to track export" });
  }
});

// GET /api/usage — Get workspace usage stats
router.get("/usage", middleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId as string;
    const workspaceId = req.query.workspaceId as string;

    if (!workspaceId) {
      res.status(400).json({ error: "workspaceId is required" });
      return;
    }

    const workspace = await prismaClient.workspace.findFirst({
      where: { id: workspaceId, ownerId: userId },
      include: { _count: { select: { projects: true } } },
    });

    if (!workspace) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const exportsThisMonth = await prismaClient.usageEvent.count({
      where: {
        workspaceId,
        eventType: "code_export",
        createdAt: { gte: thisMonth },
      },
    });

    const limits = getLimit(workspace.plan);

    res.json({
      plan: workspace.plan,
      usage: {
        projects: { used: workspace._count.projects, limit: limits.projects },
        codeExports: { used: exportsThisMonth, limit: limits.codeExports },
        collaborators: { limit: limits.collaborators },
      },
    });
  } catch (err) {
    console.error("Usage stats error:", err);
    res.status(500).json({ error: "Failed to get usage stats" });
  }
});

export default router;
