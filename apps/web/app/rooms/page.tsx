"use client";

import { useState, useEffect } from "react";
import {
  Pen,
  Plus,
  ArrowRight,
  LogOut,
  BarChart3,
  Hash,
  Sparkles,
  User,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_HTTP_API ?? "http://localhost:4000";

export default function RoomsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    setToken(t);
    setMounted(true);
    if (!t) window.location.replace("/");
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: roomName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create room");
      const roomId = data.roomId ?? data.room?.id;
      if (roomId != null) {
        window.location.href = `/draw?room=${roomId}&token=${encodeURIComponent(token)}`;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const id = joinRoomId.trim();
    if (!id) return;
    const t = token ?? localStorage.getItem("token");
    if (t) {
      window.location.href = `/draw?room=${id}&token=${encodeURIComponent(t)}`;
    } else {
      window.location.href = `/draw?room=${id}`;
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("token");
    window.location.replace("/");
  };

  if (!mounted || token === null) return null;

  return (
    <>
      <nav className="nav">
        <div className="nav-brand">
          <Pen size={18} />
          <span>Excalidraw</span>
        </div>
        <div className="nav-actions">
          <a
            href={process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:4002"}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}
          >
            <BarChart3 size={14} />
            Dashboard
          </a>
          <a href="/profile" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <User size={14} />
            Profile
          </a>
          <button type="button" onClick={handleSignOut} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </nav>

      <div className="container fade-in">
        <h1 className="page-title">Your Rooms</h1>
        <p className="page-subtitle">
          Create a new collaborative whiteboard or join an existing session.
        </p>

        {error && (
          <div className="auth-error" style={{ marginBottom: "1.5rem" }}>
            {error}
          </div>
        )}

        <div className="rooms-grid">
          <div className="room-card">
            <h2>
              <Plus size={18} />
              Create Room
            </h2>
            <form onSubmit={handleCreateRoom}>
              <div className="form-group">
                <label>Room name</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="My whiteboard"
                  required
                />
              </div>
              <button
                type="submit"
                className="primary"
                disabled={loading || !token}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}
              >
                {loading ? (
                  "Creating…"
                ) : (
                  <>
                    <Sparkles size={15} />
                    Create &amp; open
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="divider">or</div>

          <div className="room-card">
            <h2>
              <Hash size={18} />
              Join Room
            </h2>
            <form onSubmit={handleJoinRoom}>
              <div className="form-group">
                <label>Room ID</label>
                <input
                  type="text"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  placeholder="Enter room ID"
                  required
                />
              </div>
              <button
                type="submit"
                className="primary"
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}
              >
                <ArrowRight size={15} />
                Join room
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
