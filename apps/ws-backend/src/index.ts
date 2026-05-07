import path from "path";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, "../../../.env") });

import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { prismaClient } from "@repo/db/client";
import { getMetrics, getContentType, wsConnectionsActive, drawEventsTotal, activeRoomsGauge } from "./metrics";

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
const wss = new WebSocketServer({ port: 4003 });

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

const metricsApp = express();
metricsApp.use(cors());
metricsApp.get("/metrics", async (_req, res) => {
  res.set("Content-Type", getContentType());
  res.end(await getMetrics());
});
metricsApp.listen(4004, () => {
  console.log("📊 Metrics on http://localhost:4004/metrics");
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
    const user = await prismaClient.user.findUnique({
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
        client.rooms.push(msg.roomId);
        updateActiveRooms();
        // Notify others in the room
        broadcastToRoom(msg.roomId, ws, {
          type: "user_joined",
          userId,
          userName: client.userName,
        });
        // Send list of current users in room to the new joiner
        const roomUsers = clients
          .filter((c) => c.rooms.includes(msg.roomId) && c.ws.readyState === WebSocket.OPEN)
          .map((c) => ({ userId: c.userId, userName: c.userName }));
        ws.send(JSON.stringify({ type: "room_users", users: roomUsers }));
      }

      if (msg.type === "leave_room") {
        client.rooms = client.rooms.filter((id) => id !== msg.roomId);
        updateActiveRooms();
        broadcastToRoom(msg.roomId, ws, {
          type: "user_left",
          userId,
        });
      }

      /* ── Draw events ── */
      if (msg.type === "draw_event") {
        const { roomId, shapeType, shapeData } = msg;
        drawEventsTotal.inc({ shape_type: shapeType ?? "unknown" });

        // Save to DB (only if roomId is a valid integer)
        if (!isNaN(Number(roomId))) {
          try {
            await prismaClient.drawEvent.create({
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

        // Broadcast to all in same room
        clients.forEach((c) => {
          if (c.rooms.includes(roomId) && c.ws.readyState === WebSocket.OPEN) {
            c.ws.send(
              JSON.stringify({
                type: "draw_event",
                roomId,
                shapeType,
                shapeData,
                fromUserId: userId,
              })
            );
          }
        });
      }

      /* ── Cursor movement ── */
      if (msg.type === "cursor_move") {
        const { roomId, x, y, color } = msg;
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
        const { roomId, content } = msg;
        if (!isNaN(Number(roomId)) && content) {
          try {
            const saved = await prismaClient.message.create({
              data: {
                roomId: Number(roomId),
                userId,
                content: String(content),
              },
            });
            // Broadcast to ALL in room (including sender)
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
