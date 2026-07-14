"use client";

import { useState, useEffect } from "react";
import DrawingBoard from "../../components/DrawingBoard";
import { Pen, ArrowLeft, AlertCircle } from "lucide-react";

const API = process.env.NEXT_PUBLIC_HTTP_API ?? "http://localhost:4000";

function DrawContent() {
  const [roomParam, setRoomParam] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [roomError, setRoomError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRoomParam(params.get("room"));
    setToken(params.get("token") || localStorage.getItem("token"));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;

    if (!roomParam || !token) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    const roomId = Number(roomParam);
    if (!Number.isFinite(roomId) || roomId <= 0) {
      setRoomError("Invalid room ID.");
      setChecking(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API}/rooms/${roomId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (res.status === 404 || data.code === "ROOM_NOT_FOUND") {
          setRoomError("This room does not exist. You cannot join it.");
        } else if (res.status === 403 || data.code === "ROOM_FORBIDDEN") {
          setRoomError(data.error || "You do not have access to this room.");
        } else if (!res.ok) {
          setRoomError(data.error || "Unable to verify this room.");
        } else {
          setRoomError(null);
        }
      } catch {
        if (!cancelled) setRoomError("Unable to verify this room. Please try again.");
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, roomParam, token]);

  if (!ready || checking) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--text-muted)" }}>
        {checking ? "Checking room…" : "Loading…"}
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

  if (roomError) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card fade-in" style={{ textAlign: "center" }}>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.75rem", color: "#f87171" }}>
              <AlertCircle size={28} />
            </div>
            <p style={{ color: "var(--text)", fontWeight: 600, marginBottom: "0.5rem" }}>Cannot join room</p>
            <p style={{ color: "var(--text-muted)", marginBottom: "1.25rem", fontSize: "0.9rem" }}>{roomError}</p>
            <a href="/projects" className="primary" style={{ display: "inline-block", padding: "0.5rem 1.5rem", borderRadius: "var(--radius-md)", background: "var(--accent)", color: "white", textDecoration: "none" }}>
              Back to projects
            </a>
          </div>
        </div>
      </div>
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
