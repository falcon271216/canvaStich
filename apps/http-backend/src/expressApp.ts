import express, { type Express, Request, Response } from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { JWT_SECRET } from "@repo/backend-common/config";
import { getPrisma } from "./db";
import { middleware, metricsMiddleware } from "./middleware";
import { getMetrics, getContentType } from "./metrics";
import {
  createUserSchema,
  signinSchema,
  CreateRoomSchema,
} from "@repo/common/types";
import generateRoutes from "./routes/generate";
import projectRoutes from "./routes/projects";

export function createApp(): Express {
  const app = express();

  const allowedOrigins = [
    process.env.WEB_APP_URL,
    process.env.DASHBOARD_URL,
    ...(process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) ?? []),
  ]
    .filter(Boolean)
    .map((o) => o!.replace(/\/$/, "")) as string[];

  app.use(
    cors({
      origin:
        allowedOrigins.length > 0
          ? (origin, callback) => {
              const normalized = origin?.replace(/\/$/, "");
              if (!origin || allowedOrigins.includes(normalized!)) {
                callback(null, true);
              } else {
                console.warn("[cors] blocked origin:", origin, "allowed:", allowedOrigins);
                callback(null, false);
              }
            }
          : true,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(metricsMiddleware);

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true, service: "http-backend" });
  });

  app.use("/api", generateRoutes);
  app.use("/api", projectRoutes);

  // Helper function to check if a user has access to a room
  async function hasRoomAccess(userId: string, roomId: number): Promise<boolean> {
    const room = await getPrisma().room.findUnique({
      where: { id: roomId },
      include: {
        members: {
          where: { userId }
        }
      }
    });

    if (!room) return false;

    // 1. Is admin (created the room)
    if (room.adminId === userId) return true;

    // 2. Is explicit room member
    if (room.members.length > 0) return true;

    // 3. Room is linked to a project in a workspace owned by the user
    const projects = await getPrisma().project.findMany({
      where: {
        roomId,
        workspace: { ownerId: userId }
      }
    });
    if (projects.length > 0) return true;

    return false;
  }

  app.post("/signup", async (req: Request, res: Response): Promise<void> => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid signup data" });
      return;
    }

    const { username, password, name } = parsed.data;
    const { otp } = req.body;

    const existingUser = await getPrisma().user.findUnique({
      where: { email: username },
    });

    if (existingUser) {
      res.status(409).json({ error: "User already exists" });
      return;
    }

    // ── Case 1: Send / resend OTP ──
    // Must await email on Vercel — fire-and-forget is killed when the function returns.
    if (!otp) {
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

      try {
        await getPrisma().otpVerification.upsert({
          where: { email: username },
          update: { otp: generatedOtp, expiresAt },
          create: { email: username, otp: generatedOtp, expiresAt },
        });

        const { sendOtpEmail } = await import("./utils/email");
        await sendOtpEmail(username, name, generatedOtp);

        res.status(200).json({
          otpRequired: true,
          message: "Verification code sent to your email. Please enter it to complete signup.",
        });
        return;
      } catch (err) {
        console.error("OTP send error:", err);
        res.status(500).json({
          error: "Failed to send verification code. Please try again in a moment.",
        });
        return;
      }
    }

    // ── Case 2: Verify OTP and create user ──
    try {
      const verification = await getPrisma().otpVerification.findUnique({
        where: { email: username },
      });

      if (!verification || verification.otp !== otp || verification.expiresAt < new Date()) {
        res.status(400).json({ error: "Invalid or expired verification code" });
        return;
      }

      // Valid OTP: remove verification record
      await getPrisma().otpVerification.delete({
        where: { email: username },
      });

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await getPrisma().user.create({
        data: {
          email: username,
          password: hashedPassword,
          name,
        },
      });

      // Send Welcome Email asynchronously
      import("./utils/email").then(({ sendWelcomeEmail }) => {
        sendWelcomeEmail(username, name).catch((err) => {
          console.error("Welcome email send error:", err);
        });
      });

      res.status(201).json({ userId: user.id });
    } catch (err) {
      console.error("Signup validation error:", err);
      res.status(500).json({ error: "Signup failed. Please try again." });
    }
  });

  app.post("/signin", async (req: Request, res: Response): Promise<void> => {
    const parsed = signinSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid signin data" });
      return;
    }

    const { username, password } = parsed.data;

    const user = await getPrisma().user.findUnique({
      where: { email: username },
    });

    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

    res.status(200).json({ token });
  });

  app.post("/room", middleware, async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid room data" });
      return;
    }

    // @ts-expect-error Added by middleware
    const userId: string = req.userId;

    const baseName = parsed.data.name;
    let slug = baseName;
    let attempts = 0;

    while (attempts < 5) {
      const existing = await getPrisma().room.findUnique({
        where: { slug },
      });
      if (!existing) break;
      slug = `${baseName}-${Math.random().toString(36).substring(2, 7)}`;
      attempts++;
    }

    try {
      const room = await getPrisma().room.create({
        data: {
          name: baseName,
          slug,
          adminId: userId,
        },
      });

      res.status(201).json({ roomId: room.id });
    } catch (err: unknown) {
      const prismaErr = err as { code?: string };
      if (prismaErr?.code === "P2002") {
        res.status(409).json({ error: "Room slug conflict, please try again" });
        return;
      }
      console.error("Create room error:", err);
      res.status(500).json({ error: "Failed to create room" });
    }
  });

  // Invite/add collaborator endpoint
  app.post("/rooms/:roomId/members", middleware, async (req: Request, res: Response): Promise<void> => {
    const roomId = Number(req.params.roomId);
    if (isNaN(roomId)) {
      res.status(400).json({ error: "Invalid room ID" });
      return;
    }

    // @ts-expect-error Added by middleware
    const userId: string = req.userId;
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: "Collaborator email is required" });
      return;
    }

    const room = await getPrisma().room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    if (room.adminId !== userId) {
      res.status(403).json({ error: "Only the room creator can invite collaborators" });
      return;
    }

    const collaborator = await getPrisma().user.findUnique({
      where: { email },
    });

    if (!collaborator) {
      res.status(404).json({ error: "User not found. They must register on SketchUI first." });
      return;
    }

    try {
      await getPrisma().roomMember.create({
        data: {
          roomId,
          userId: collaborator.id,
        },
      });

      // Send email invite asynchronously
      const webUrl = process.env.WEB_APP_URL || "http://localhost:4001";
      const roomUrl = `${webUrl}/draw?room=${roomId}`;
      const inviter = await getPrisma().user.findUnique({ where: { id: userId } });

      import("./utils/email").then(({ sendRoomInvitation }) => {
        sendRoomInvitation({
          toEmail: email,
          roomName: room.name,
          roomUrl,
          inviterName: inviter?.name || "Someone",
        }).catch((err) => {
          console.error("Failed to send room invitation email:", err);
        });
      });

      res.status(200).json({ success: true, message: "Collaborator added successfully" });
    } catch (err: any) {
      if (err?.code === "P2002") {
        res.status(409).json({ error: "User is already a collaborator in this room" });
        return;
      }
      res.status(500).json({ error: "Failed to add collaborator" });
    }
  });

  app.get("/drawings/:roomId", middleware, async (req: Request, res: Response): Promise<void> => {
    const roomId = Number(req.params.roomId);
    if (isNaN(roomId)) {
      res.status(400).json({ error: "Invalid room ID" });
      return;
    }

    // @ts-expect-error Added by middleware
    const userId: string = req.userId;
    const access = await hasRoomAccess(userId, roomId);
    if (!access) {
      res.status(403).json({ error: "You do not have access to this room" });
      return;
    }

    const drawings = await getPrisma().drawEvent.findMany({
      where: { roomId },
      orderBy: { createdAt: "asc" },
    });

    res.status(200).json({ drawings });
  });

  app.get("/pattern-stats", async (_req: Request, res: Response): Promise<void> => {
    const completions = await getPrisma().drawEvent.findMany({
      where: { type: "completion" },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    const byLabel: Record<string, number> = {};
    const byMethod: Record<string, number> = {};
    const byVelocityProfile: Record<string, number> = {};
    const recent: {
      id: number;
      roomId: number;
      detectedLabel: string;
      confidence: number;
      method: string;
      dtwDistance: number | null;
      velocityProfile: string | null;
      strokeDuration: number | null;
      createdAt: string;
    }[] = [];
    for (const e of completions) {
      const data = e.data as {
        detectedLabel?: string;
        confidence?: number;
        method?: string;
        dtwDistance?: number | null;
        velocityProfile?: string | null;
        strokeDuration?: number | null;
      } | null;
      const label = (data?.detectedLabel as string) ?? "unknown";
      const method = (data?.method as string) ?? "geometric";
      const vp = (data?.velocityProfile as string) ?? "unknown";
      byLabel[label] = (byLabel[label] ?? 0) + 1;
      byMethod[method] = (byMethod[method] ?? 0) + 1;
      byVelocityProfile[vp] = (byVelocityProfile[vp] ?? 0) + 1;
      if (recent.length < 30) {
        recent.push({
          id: e.id,
          roomId: e.roomId,
          detectedLabel: label,
          confidence: typeof data?.confidence === "number" ? data.confidence : 0,
          method,
          dtwDistance: typeof data?.dtwDistance === "number" ? data.dtwDistance : null,
          velocityProfile: vp,
          strokeDuration: typeof data?.strokeDuration === "number" ? data.strokeDuration : null,
          createdAt: e.createdAt.toISOString(),
        });
      }
    }
    res.status(200).json({ byLabel, byMethod, byVelocityProfile, recent });
  });

  app.get("/session-analysis/:roomId", middleware, async (req: Request, res: Response): Promise<void> => {
    const roomId = Number(req.params.roomId);
    if (isNaN(roomId)) {
      res.status(400).json({ error: "Invalid room ID" });
      return;
    }

    // @ts-expect-error Added by middleware
    const userId: string = req.userId;
    const access = await hasRoomAccess(userId, roomId);
    if (!access) {
      res.status(403).json({ error: "You do not have access to this room" });
      return;
    }

    const events = await getPrisma().drawEvent.findMany({
      where: { roomId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, type: true },
    });

    if (events.length === 0) {
      res.status(200).json({ roomId, message: "No events found", session: null });
      return;
    }

    try {
      const { analyseSession, eventTimesToActivitySeries } = await import("@repo/pattern-detection");
      const timestamps = events.map((e) => e.createdAt.getTime());
      const session = analyseSession(timestamps);
      const activitySeries = eventTimesToActivitySeries(timestamps);
      res.status(200).json({ roomId, session, activitySeries });
    } catch {
      const timestamps = events.map((e) => e.createdAt.getTime());
      const duration = timestamps.length >= 2
        ? timestamps[timestamps.length - 1]! - timestamps[0]!
        : 0;
      res.status(200).json({
        roomId,
        session: { label: "unknown", duration, eventCount: timestamps.length },
        activitySeries: [],
      });
    }
  });

  app.get("/messages/:roomId", middleware, async (req: Request, res: Response): Promise<void> => {
    const roomId = Number(req.params.roomId);
    if (isNaN(roomId)) {
      res.status(400).json({ error: "Invalid room ID" });
      return;
    }

    // @ts-expect-error Added by middleware
    const userId: string = req.userId;
    const access = await hasRoomAccess(userId, roomId);
    if (!access) {
      res.status(403).json({ error: "You do not have access to this room" });
      return;
    }

    const messages = await getPrisma().message.findMany({
      where: { roomId },
      orderBy: { createdAt: "asc" },
      take: 100,
      include: { user: { select: { name: true } } },
    });

    res.status(200).json({
      messages: messages.map((m) => ({
        id: m.id,
        userId: m.userId,
        userName: m.user.name,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  });

  app.get("/metrics", async (_req: Request, res: Response): Promise<void> => {
    res.set("Content-Type", getContentType());
    res.end(await getMetrics());
  });

  app.use((err: unknown, _req: Request, res: Response, _next: () => void) => {
    console.error("[http-backend] unhandled route error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return app;
}
