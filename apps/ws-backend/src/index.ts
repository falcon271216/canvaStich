import path from "path";
import { config } from "dotenv";
import http from "http";
import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import jwt, { JwtPayload } from "jsonwebtoken";
import type { PrismaClient } from "@prisma/client";
import { getMetrics, getContentType, wsConnectionsActive, drawEventsTotal, activeRoomsGauge } from "./metrics";

const JWT_SECRET = process.env.JWT_SECRET || "123123";

const repoRoot = path.resolve(__dirname, "../../..");

if (!process.env.RAILWAY_ENVIRONMENT && !process.env.VERCEL) {
  config({ path: path.join(repoRoot, ".env.ws-backend") });
  config({ path: path.join(repoRoot, ".env") });
}

process.on("uncaughtException", (err) => {
  console.error("uncaughtException:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection:", reason);
  process.exit(1);
});

let prismaClient: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!prismaClient) {
    // Lazy-load so /health can respond even if Prisma init is slow or fails.
    prismaClient = require("@repo/db/client").prismaClient as PrismaClient;
  }
  return prismaClient;
}

interface AuthPayload extends JwtPayload {
  userId: string;
}

interface Client {
  ws: WebSocket;
  userId: string;
  userName: string;
  rooms: string[];
}

const clients: Client[] = [];
const port = Number(process.env.PORT ?? 4003);
const host = process.env.HOST ?? "0.0.0.0";

function updateActiveRooms(): void {
  const roomIds = new Set<string>();
  clients.forEach((c) => c.rooms.forEach((r) => roomIds.add(String(r))));
  activeRoomsGauge.set(roomIds.size);
}

function broadcastToRoom(roomId: string, senderWs: WebSocket | null, data: object): void {
  const msg = JSON.stringify(data);
  clients.forEach((c) => {
    if (c.rooms.includes(roomId) && c.ws !== senderWs && c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(msg);
    }
  });
}

const app = express();
app.use(cors());
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "ws-backend" });
});
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", getContentType());
  res.end(await getMetrics());
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

server.listen(port, host, () => {
  console.log(`[ws-backend] listening on ${host}:${port} (PORT=${process.env.PORT ?? "unset"})`);
  console.log(`[ws-backend] health: http://${host}:${port}/health`);
});

server.on("error", (err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});

wss.on("connection", async (ws, request) => {
  const url = request.url;
  if (!url) return ws.close();

  const queryParams = new URLSearchParams(url.split("?")[1]);
  const token = queryParams.get("token");

  if (!token) return ws.close();

  let decoded: AuthPayload;
  try {
    decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return ws.close();
  }

  const userId = decoded?.userId;
  if (!userId) return ws.close();

  // Look up user name from DB
  let userName = "Anonymous";
  try {
    const user = await getPrisma().user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    if (user) userName = user.name;
  } catch {}

  const client: Client = { ws, userId, userName, rooms: [] };
  clients.push(client);
  wsConnectionsActive.set(clients.length);
  updateActiveRooms();

  // Send identity back to the connecting client
  ws.send(JSON.stringify({ type: "identity", userId, userName }));

  ws.on("message", async (message) => {
    try {
      const msg = JSON.parse(message.toString());

      /* ── Room join/leave ── */
      if (msg.type === "join_room") {
        const roomId = String(msg.roomId);
        const rId = Number(roomId);
        if (isNaN(rId)) return ws.close();

        // Security check: Validate room permission
        let hasAccess = false;
        try {
          const room = await getPrisma().room.findUnique({
            where: { id: rId },
            include: {
              members: {
                where: { userId }
              }
            }
          });

          if (room) {
            if (room.adminId === userId) {
              hasAccess = true;
            } else if (room.members.length > 0) {
              hasAccess = true;
            } else {
              const projects = await getPrisma().project.findMany({
                where: {
                  roomId: rId,
                  workspace: { ownerId: userId }
                }
              });
              if (projects.length > 0) {
                hasAccess = true;
              }
            }
          }
        } catch (err) {
          console.error("[ws-backend] error checking room access:", err);
        }

        if (!hasAccess) {
          console.warn(`[ws-backend] User ${userId} unauthorized to join room ${rId}`);
          ws.send(JSON.stringify({ type: "error", error: "Unauthorized access to this room" }));
          return ws.close();
        }

        if (!client.rooms.includes(roomId)) {
          client.rooms.push(roomId);
        }
        updateActiveRooms();
        // Notify others in the room
        broadcastToRoom(roomId, ws, {
          type: "user_joined",
          userId,
          userName: client.userName,
        });
        // Send list of current users in room to the new joiner
        const roomUsers = clients
          .filter((c) => c.rooms.includes(roomId) && c.ws.readyState === WebSocket.OPEN)
          .map((c) => ({ userId: c.userId, userName: c.userName }));
        ws.send(JSON.stringify({ type: "room_users", users: roomUsers }));
      }

      if (msg.type === "leave_room") {
        const roomId = String(msg.roomId);
        client.rooms = client.rooms.filter((id) => id !== roomId);
        updateActiveRooms();
        broadcastToRoom(roomId, ws, {
          type: "user_left",
          userId,
        });
      }

      /* ── Draw events ── */
      if (msg.type === "draw_event") {
        const roomId = String(msg.roomId);
        const { shapeType, shapeData } = msg;
        drawEventsTotal.inc({ shape_type: shapeType ?? "unknown" });

        // Save to DB (only if roomId is a valid integer)
        if (!isNaN(Number(roomId))) {
          try {
            await getPrisma().drawEvent.create({
              data: {
                roomId: Number(roomId),
                userId,
                type: shapeType,
                data: shapeData,
              },
            });
          } catch (e) {
            console.error("Failed to save draw event to DB:", e);
          }
        }

        // Broadcast to all in same room EXCEPT the sender (who already
        // added the shape to local state optimistically in the client).
        broadcastToRoom(roomId, ws, {
          type: "draw_event",
          roomId,
          shapeType,
          shapeData,
          fromUserId: userId,
        });
      }

      /* ── Cursor movement ── */
      if (msg.type === "cursor_move") {
        const roomId = String(msg.roomId);
        const { x, y, color } = msg;
        broadcastToRoom(roomId, ws, {
          type: "cursor_move",
          userId,
          userName: client.userName,
          x,
          y,
          color: color || "#6366f1",
        });
      }

      /* ── Chat messages ── */
      if (msg.type === "chat_message") {
        const roomId = String(msg.roomId);
        const content = msg.content;
        if (!isNaN(Number(roomId)) && content) {
          try {
            const saved = await getPrisma().message.create({
              data: {
                roomId: Number(roomId),
                userId,
                content: String(content),
              },
            });
            // Broadcast to ALL in room (including sender) for confirmation + live sync
            const chatMsg = JSON.stringify({
              type: "chat_message",
              id: saved.id,
              roomId,
              userId,
              userName: client.userName,
              content: String(content),
              createdAt: saved.createdAt.toISOString(),
            });
            clients.forEach((c) => {
              if (c.rooms.includes(roomId) && c.ws.readyState === WebSocket.OPEN) {
                c.ws.send(chatMsg);
              }
            });
          } catch (e) {
            console.error("Failed to save chat message:", e);
          }
        }
      }
    } catch (err) {
      console.error("WS message error:", err);
    }
  });

  ws.on("close", () => {
    // Notify all rooms the user was in
    client.rooms.forEach((roomId) => {
      broadcastToRoom(roomId, ws, { type: "user_left", userId });
    });
    const index = clients.findIndex((c) => c.ws === ws);
    if (index !== -1) clients.splice(index, 1);
    wsConnectionsActive.set(clients.length);
    updateActiveRooms();
  });
});
