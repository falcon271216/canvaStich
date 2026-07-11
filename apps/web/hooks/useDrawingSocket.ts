"use client";

import { useEffect, useRef, useCallback } from "react";

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

interface CursorMoveEvent {
  userId: string;
  userName: string;
  x: number;
  y: number;
  color: string;
}

interface ChatMessageEvent {
  id?: number;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

interface RoomUser {
  userId: string;
  userName: string;
}

export function useDrawingSocket({
  token,
  roomId,
  onDrawEventAction,
  onCursorMoveAction,
  onChatMessageAction,
  onUserJoinedAction,
  onUserLeftAction,
  onRoomUsersAction,
  onIdentityAction,
}: {
  token: string;
  roomId: string;
  onDrawEventAction: (event: DrawEvent) => void;
  onCursorMoveAction?: (event: CursorMoveEvent) => void;
  onChatMessageAction?: (event: ChatMessageEvent) => void;
  onUserJoinedAction?: (user: RoomUser) => void;
  onUserLeftAction?: (data: { userId: string }) => void;
  onRoomUsersAction?: (users: RoomUser[]) => void;
  onIdentityAction?: (data: { userId: string; userName: string }) => void;
}) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const callbacksRef = useRef({
    onDrawEventAction,
    onCursorMoveAction,
    onChatMessageAction,
    onUserJoinedAction,
    onUserLeftAction,
    onRoomUsersAction,
    onIdentityAction,
  });
  callbacksRef.current = {
    onDrawEventAction,
    onCursorMoveAction,
    onChatMessageAction,
    onUserJoinedAction,
    onUserLeftAction,
    onRoomUsersAction,
    onIdentityAction,
  };

  const connect = useCallback(() => {
    if (!token || !roomId) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4003";
    const ws = new WebSocket(`${wsUrl}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      retryCountRef.current = 0;
      ws.send(JSON.stringify({ type: "join_room", roomId: String(roomId) }));
    };

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      const cb = callbacksRef.current;

      switch (data.type) {
        case "draw_event":
          cb.onDrawEventAction(data);
          break;
        case "cursor_move":
          cb.onCursorMoveAction?.(data);
          break;
        case "chat_message":
          cb.onChatMessageAction?.(data);
          break;
        case "user_joined":
          cb.onUserJoinedAction?.(data);
          break;
        case "user_left":
          cb.onUserLeftAction?.(data);
          break;
        case "room_users":
          cb.onRoomUsersAction?.(data.users);
          break;
        case "identity":
          cb.onIdentityAction?.(data);
          break;
      }
    };

    ws.onclose = () => {
      const timeout = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
      reconnectTimeoutRef.current = setTimeout(() => {
        retryCountRef.current++;
        connect();
      }, timeout);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [token, roomId]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "leave_room", roomId: String(roomId) }));
        }
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect, roomId]);

  const sendDrawEvent = useCallback((type: string, data: any) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(
      JSON.stringify({
        type: "draw_event",
        roomId: String(roomId),
        shapeType: type,
        shapeData: data,
      })
    );
  }, [roomId]);

  const sendCursorMove = useCallback((x: number, y: number, color?: string) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(
      JSON.stringify({
        type: "cursor_move",
        roomId: String(roomId),
        x,
        y,
        color: color || "#6366f1",
      })
    );
  }, [roomId]);

  const sendChatMessage = useCallback((content: string) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(
      JSON.stringify({
        type: "chat_message",
        roomId: String(roomId),
        content,
      })
    );
  }, [roomId]);

  return { sendDrawEvent, sendCursorMove, sendChatMessage };
}
