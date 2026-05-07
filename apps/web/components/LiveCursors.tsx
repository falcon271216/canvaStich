"use client";

import { useEffect, useState } from "react";

export interface CursorData {
  userId: string;
  userName: string;
  x: number;
  y: number;
  color: string;
  lastUpdate: number;
}

interface LiveCursorsProps {
  cursors: Map<string, CursorData>;
}

const CURSOR_TIMEOUT = 5000;

export default function LiveCursors({ cursors }: LiveCursorsProps) {
  const [, setTick] = useState(0);

  // Force re-render every second to handle cursor fading
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const now = Date.now();

  return (
    <div className="live-cursors-overlay">
      {Array.from(cursors.entries()).map(([userId, cursor]) => {
        const age = now - cursor.lastUpdate;
        if (age > CURSOR_TIMEOUT) return null;
        const opacity = age > 3000 ? Math.max(0, 1 - (age - 3000) / 2000) : 1;

        return (
          <div
            key={userId}
            className="live-cursor"
            style={{
              left: cursor.x,
              top: cursor.y,
              opacity,
            }}
          >
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
              <path
                d="M0.5 0.5L15.5 12.5H6.5L3.5 19.5L0.5 0.5Z"
                fill={cursor.color}
                stroke="rgba(0,0,0,0.3)"
                strokeWidth="1"
              />
            </svg>
            <span
              className="live-cursor-label"
              style={{ background: cursor.color }}
            >
              {cursor.userName}
            </span>
          </div>
        );
      })}
    </div>
  );
}
