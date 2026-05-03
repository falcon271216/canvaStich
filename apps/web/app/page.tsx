"use client";

import { useState } from "react";
import { Pen, AlertCircle, Sparkles } from "lucide-react";

const API = process.env.NEXT_PUBLIC_HTTP_API ?? "http://localhost:4000";

export default function HomePage() {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sign in failed");
      if (typeof window !== "undefined" && data.token) {
        localStorage.setItem("token", data.token);
        window.location.href = "/rooms";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, name: name || username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sign up failed");
      const signInRes = await fetch(`${API}/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const signInData = await signInRes.json();
      if (signInRes.ok && signInData.token && typeof window !== "undefined") {
        localStorage.setItem("token", signInData.token);
        window.location.href = "/rooms";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card fade-in">
        <div className="auth-header">
          <div className="auth-logo">
            <Pen size={26} />
          </div>
          <h1 className="auth-title">Excalidraw</h1>
          <p className="auth-subtitle">
            Real-time collaborative drawing with pattern detection
          </p>
        </div>

        <div className="card">
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${tab === "signin" ? "active" : ""}`}
              onClick={() => { setTab("signin"); setError(""); }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`auth-tab ${tab === "signup" ? "active" : ""}`}
              onClick={() => { setTab("signup"); setError(""); }}
            >
              Create account
            </button>
          </div>

          {error && (
            <div className="auth-error">
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          {tab === "signin" ? (
            <form onSubmit={handleSignIn}>
              <div className="form-group">
                <label>Email address</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
              <button
                type="submit"
                className="primary"
                disabled={loading}
                style={{ width: "100%", marginTop: "0.5rem" }}
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUp}>
              <div className="form-group">
                <label>Email address</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label>Display name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>
              <button
                type="submit"
                className="primary"
                disabled={loading}
                style={{ width: "100%", marginTop: "0.5rem" }}
              >
                {loading ? "Creating account…" : "Create account"}
              </button>
            </form>
          )}
        </div>

        <div className="auth-footer">
          <Sparkles size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
          Powered by DTW pattern detection
        </div>
      </div>
    </div>
  );
}
