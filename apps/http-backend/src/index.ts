import path from "path";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, "../../../.env") });

import express, { Request, Response } from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { JWT_SECRET } from "@repo/backend-common/config";
import { prismaClient } from "@repo/db/client";
import { middleware, metricsMiddleware } from "./middleware";
import { getMetrics, getContentType } from "./metrics";
import {
  createUserSchema,
  signinSchema,
  CreateRoomSchema,
} from "@repo/common/types";

const app = express();
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware);


app.post("/signup", async (req: Request, res: Response): Promise<void> => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid signup data" });
    return;
  }

  const { username, password, name } = parsed.data;

  const existingUser = await prismaClient.user.findUnique({
    where: { email: username },
  });

  if (existingUser) {
    res.status(409).json({ error: "User already exists" });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prismaClient.user.create({
    data: {
      email: username,
      password: hashedPassword,
      name,
    },
  });

  res.status(201).json({ userId: user.id });
});

// Signin route
app.post("/signin", async (req: Request, res: Response): Promise<void> => {
  const parsed = signinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid signin data" });
    return;
  }

  const { username, password } = parsed.data;

  const user = await prismaClient.user.findUnique({
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

// Create Room
app.post("/room", middleware, async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateRoomSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid room data" });
    return;
  }

  // @ts-ignore: Added by middleware
  const userId: string = req.userId;

  const existing = await prismaClient.room.findUnique({
    where: { slug: parsed.data.name },
  });

  if (existing) {
    res.status(409).json({ error: "Room already exists" });
    return;
  }

  const room = await prismaClient.room.create({
    data: {
      name: parsed.data.name,
      slug: parsed.data.name,
      adminId: userId,
    },
  });

  res.status(201).json({ roomId: room.id });
});

// Get drawings by room
app.get("/drawings/:roomId", async (req: Request, res: Response): Promise<void> => {
  const roomId = Number(req.params.roomId);
  if (isNaN(roomId)) {
    res.status(400).json({ error: "Invalid room ID" });
    return;
  }

  const drawings = await prismaClient.drawEvent.findMany({
    where: { roomId },
    orderBy: { createdAt: "asc" },
  });

  res.status(200).json({ drawings });
});

app.get("/pattern-stats", async (_req: Request, res: Response): Promise<void> => {
  const completions = await prismaClient.drawEvent.findMany({
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

// Session analysis endpoint — runs CUSUM / Z-score anomaly detection on
// draw-event timestamps for a given room, demonstrating pattern detection
// on operational time-series data.
app.get("/session-analysis/:roomId", async (req: Request, res: Response): Promise<void> => {
  const roomId = Number(req.params.roomId);
  if (isNaN(roomId)) {
    res.status(400).json({ error: "Invalid room ID" });
    return;
  }

  const events = await prismaClient.drawEvent.findMany({
    where: { roomId },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, type: true },
  });

  if (events.length === 0) {
    res.status(200).json({ roomId, message: "No events found", session: null });
    return;
  }

  // Dynamic import to avoid issues if pattern-detection not built yet
  try {
    const { analyseSession, eventTimesToActivitySeries } = await import("@repo/pattern-detection");
    const timestamps = events.map((e) => e.createdAt.getTime());
    const session = analyseSession(timestamps);
    const activitySeries = eventTimesToActivitySeries(timestamps);
    res.status(200).json({ roomId, session, activitySeries });
  } catch {
    // Fallback if pattern-detection is not available
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

app.get("/metrics", async (_req: Request, res: Response): Promise<void> => {
  res.set("Content-Type", getContentType());
  res.end(await getMetrics());
});

app.listen(4000, () => {
  console.log("🚀 Server running on http://localhost:4000");
});
