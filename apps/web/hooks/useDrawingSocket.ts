"use client";

import { useEffect, useRef } from "react";

type ShapeData = {
  [key: string]: any;
};

interface DrawEvent {
  type: "draw_event";
  roomId: string;
  shapeType: string;
  shapeData: ShapeData;
  fromUserId?: string;
}

export function useDrawingSocket({
  token,
  roomId,
  onDrawEventAction,
}: {
  token: string;
  roomId: string;
  onDrawEventAction: (event: DrawEvent) => void;
}) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token || !roomId) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4003";
    const ws = new WebSocket(`${wsUrl}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join_room", roomId }));
    };

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === "draw_event") {
        onDrawEventAction(data);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "leave_room", roomId }));
      }
      ws.close();
    };
  }, [token, roomId]);

  const sendDrawEvent = (type: string, data: any) => {
    const socket = wsRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn("⚠ WebSocket not ready. State:", socket?.readyState);
      return;
    }

    socket.send(
      JSON.stringify({
        type: "draw_event",
        roomId,
        shapeType: type, 
        shapeData: data,
      })
    );
  };

  return { sendDrawEvent };
}
