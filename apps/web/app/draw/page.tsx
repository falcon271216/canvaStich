"use client";

import { useState, useEffect } from "react";
import DrawingBoard from "../../components/DrawingBoard";
import {
  Pen,
  ArrowLeft,
  BarChart3,
  Radio,
  Users,
} from "lucide-react";

function DrawContent() {
  const [roomParam, setRoomParam] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRoomParam(params.get("room"));
    setToken(params.get("token") || localStorage.getItem("token"));
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--text-muted)" }}>
        Loading…
      </div>
    );
  }

  if (!roomParam) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card fade-in" style={{ textAlign: "center" }}>
          <div className="card">
            <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>Missing room ID.</p>
            <a href="/rooms" style={{ color: "var(--accent)" }}>
              <ArrowLeft size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
              Back to rooms
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <>
        <nav className="nav">
          <div className="nav-brand">
            <Pen size={18} />
            <span>Excalidraw</span>
          </div>
          <a href="/">Sign in</a>
        </nav>
        <div className="auth-wrapper">
          <div className="auth-card fade-in" style={{ textAlign: "center" }}>
            <div className="card">
              <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>Sign in to draw in this room.</p>
              <a href="/" className="primary" style={{ display: "inline-block", padding: "0.5rem 1.5rem", borderRadius: "var(--radius-md)", background: "var(--accent)", color: "white", textDecoration: "none" }}>
                Sign in
              </a>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <nav className="nav">
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <a
            href="/rooms"
            style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
          >
            <ArrowLeft size={15} />
            Rooms
          </a>
          <div
            style={{
              width: 1,
              height: 20,
              background: "var(--border)",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.85rem",
              color: "var(--text-muted)",
            }}
          >
            <Radio size={13} style={{ color: "var(--success)" }} />
            Room {roomParam}
          </div>
        </div>
        <div className="nav-actions">
          <span className="badge badge-accent">
            <Users size={11} />
            Live
          </span>
          <a
            href={process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:4002"}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
          >
            <BarChart3 size={14} />
            Dashboard
          </a>
        </div>
      </nav>
      <div className="draw-page">
        <DrawingBoard roomId={roomParam} token={token} />
        <div className="draw-status">
          <div className="draw-status-item">
            <span className="draw-status-dot" />
            Connected
          </div>
          <div className="draw-status-item">
            Room #{roomParam}
          </div>
          <div className="draw-status-item">
            DTW + Geometric Heuristics
          </div>
        </div>
      </div>
    </>
  );
}

export default function DrawPage() {
  return <DrawContent />;
}
