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
  rooms: string[];
}

const clients: Client[] = [];
const wss = new WebSocketServer({ port: 4003 });

function updateActiveRooms(): void {
  const roomIds = new Set<string>();
  clients.forEach((c) => c.rooms.forEach((r) => roomIds.add(String(r))));
  activeRoomsGauge.set(roomIds.size);
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

wss.on("connection", (ws, request) => {
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

  const client: Client = { ws, userId, rooms: [] };
  clients.push(client);
  wsConnectionsActive.set(clients.length);
  updateActiveRooms();

  ws.on("message", async (message) => {
    try {
      const msg = JSON.parse(message.toString());

      if (msg.type === "join_room") {
        client.rooms.push(msg.roomId);
        updateActiveRooms();
      }

      if (msg.type === "leave_room") {
        client.rooms = client.rooms.filter((id) => id !== msg.roomId);
        updateActiveRooms();
      }

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
    } catch (err) {
      console.error("WS message error:", err);
    }
  });

  ws.on("close", () => {
    const index = clients.findIndex((c) => c.ws === ws);
    if (index !== -1) clients.splice(index, 1);
    wsConnectionsActive.set(clients.length);
    updateActiveRooms();
  });
});
