"use client";

import { useState, useEffect } from "react";
import DrawingBoard from "../../components/DrawingBoard";
import { Pen, ArrowLeft } from "lucide-react";

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
            <span>SketchUI</span>
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
    <div className="draw-page">
      <DrawingBoard roomId={roomParam} token={token} />
    </div>
  );
}

export default function DrawPage() {
  return <DrawContent />;
}
