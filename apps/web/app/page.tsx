"use client";

import { useState, useEffect } from "react";
import {
  Pen,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Code2,
  Layers,
  Zap,
  Check,
  GitBranch,
  Scan,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_HTTP_API ?? "http://localhost:4000";

export default function HomePage() {
  const [showAuth, setShowAuth] = useState(false);
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpMessage, setOtpMessage] = useState("");

  // If already authenticated, redirect to projects
  useEffect(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (t) window.location.replace("/projects");
  }, []);

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
        window.location.href = "/projects";
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
    setOtpMessage("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          name: name || username,
          otp: otpSent ? otp.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sign up failed");
      
      if (data.otpRequired) {
        setOtpSent(true);
        setOtpMessage(data.message || "OTP code sent to your email.");
        setLoading(false);
        return;
      }

      // If OTP verified successfully and user was created, auto sign-in
      const signInRes = await fetch(`${API}/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const signInData = await signInRes.json();
      if (signInRes.ok && signInData.token && typeof window !== "undefined") {
        localStorage.setItem("token", signInData.token);
        window.location.href = "/projects";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  /* ═══════════ AUTH MODAL ═══════════ */
  const authModal = showAuth && (
    <div className="landing-auth-overlay" onClick={() => setShowAuth(false)}>
      <div className="auth-card fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="auth-header">
          <div className="auth-logo">
            <Pen size={26} />
          </div>
          <h1 className="auth-title">SketchUI</h1>
          <p className="auth-subtitle">Sign in to start sketching</p>
        </div>

        <div className="card">
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${tab === "signin" ? "active" : ""}`}
              onClick={() => { setTab("signin"); setError(""); setOtpSent(false); setOtp(""); setOtpMessage(""); }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`auth-tab ${tab === "signup" ? "active" : ""}`}
              onClick={() => { setTab("signup"); setError(""); setOtpSent(false); setOtp(""); setOtpMessage(""); }}
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
                  disabled={otpSent}
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
                  disabled={otpSent}
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
                  disabled={otpSent}
                  autoComplete="name"
                />
              </div>

              {otpSent && (
                <div className="form-group" style={{ marginTop: "1rem" }}>
                  <label style={{ color: "#818cf8", fontWeight: "bold" }}>Verification Code (OTP)</label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter 6-digit code"
                    required
                    maxLength={6}
                    autoComplete="one-time-code"
                    style={{ border: "1px solid #818cf8", background: "rgba(99,102,241,0.03)" }}
                  />
                  {otpMessage && (
                    <span style={{ fontSize: "0.75rem", color: "#34d399", display: "block", marginTop: "0.25rem" }}>
                      {otpMessage}
                    </span>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="primary"
                disabled={loading}
                style={{ width: "100%", marginTop: "1rem" }}
              >
                {loading ? (otpSent ? "Verifying code…" : "Sending code…") : (otpSent ? "Verify & Register" : "Send Verification Code")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  /* ═══════════ LANDING PAGE ═══════════ */
  return (
    <>
      {authModal}

      {/* Nav */}
      <nav className="nav">
        <div className="nav-brand">
          <Pen size={18} />
          <span>SketchUI</span>
        </div>
        <div className="nav-actions">
          <button type="button" onClick={() => { setTab("signin"); setShowAuth(true); }}>
            Sign in
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => { setTab("signup"); setShowAuth(true); }}
          >
            Get Started Free
          </button>
        </div>
      </nav>

      {/* ═══════ Hero ═══════ */}
      <section className="landing-hero">
        <div className="landing-hero-glow" />
        <div className="landing-hero-content fade-in">
          <div className="landing-badge">
            <Sparkles size={12} />
            AI-Powered Sketch Recognition
          </div>
          <h1 className="landing-title">
            Sketch your UI.<br />
            <span className="landing-title-gradient">Get production code.</span>
          </h1>
          <p className="landing-subtitle">
            Draw rough wireframes on our collaborative canvas. Our ML pipeline detects
            UI components in real-time, builds a layout tree, and exports clean
            React + Tailwind or HTML code instantly.
          </p>
          <div className="landing-cta">
            <button
              className="primary landing-cta-btn"
              onClick={() => { setTab("signup"); setShowAuth(true); }}
            >
              <Sparkles size={16} />
              Start Sketching Free
              <ArrowRight size={16} />
            </button>
            <span className="landing-cta-sub">No credit card required</span>
          </div>
        </div>
      </section>

      {/* ═══════ How It Works ═══════ */}
      <section className="landing-steps">
        <h2 className="landing-section-title">How It Works</h2>
        <p className="landing-section-sub">Three steps from sketch to production code</p>
        <div className="landing-steps-grid">
          <div className="landing-step-card">
            <div className="landing-step-number">1</div>
            <div className="landing-step-icon">
              <Pen size={24} />
            </div>
            <h3>Draw</h3>
            <p>Sketch rough UI components on the collaborative canvas — buttons, inputs, cards, navbars, and more.</p>
          </div>
          <div className="landing-step-card">
            <div className="landing-step-number">2</div>
            <div className="landing-step-icon">
              <Scan size={24} />
            </div>
            <h3>Detect</h3>
            <p>Our ML pipeline classifies 14 UI component types in real-time using DTW + heuristic ensemble scoring.</p>
          </div>
          <div className="landing-step-card">
            <div className="landing-step-number">3</div>
            <div className="landing-step-icon">
              <Code2 size={24} />
            </div>
            <h3>Export</h3>
            <p>Generate production React + Tailwind JSX or clean HTML code from your detected layout tree.</p>
          </div>
        </div>
      </section>

      {/* ═══════ Features ═══════ */}
      <section className="landing-features">
        <h2 className="landing-section-title">Built for Speed</h2>
        <p className="landing-section-sub">Every feature designed for rapid prototyping</p>
        <div className="landing-features-grid">
          {[
            { icon: <Zap size={20} />, title: "Real-time Detection", desc: "See UI components detected as you draw with live bounding box overlays." },
            { icon: <GitBranch size={20} />, title: "Layout Tree", desc: "Automatic containment hierarchy detection with row/column gap inference." },
            { icon: <Code2 size={20} />, title: "Code Export", desc: "One-click React/Tailwind or HTML export with copy and download." },
            { icon: <Layers size={20} />, title: "14 Component Types", desc: "Buttons, inputs, cards, navbars, modals, tables, dropdowns, and more." },
          ].map((feature, i) => (
            <div key={i} className="landing-feature-card">
              <div className="landing-feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ Pricing ═══════ */}
      <section className="landing-pricing" id="pricing">
        <h2 className="landing-section-title">Simple Pricing</h2>
        <p className="landing-section-sub">Start free, upgrade when you need more</p>
        <div className="landing-pricing-grid">
          {/* Free */}
          <div className="landing-price-card">
            <h3>Free</h3>
            <div className="landing-price">$0<span>/mo</span></div>
            <ul>
              <li><Check size={14} /> 3 projects</li>
              <li><Check size={14} /> 10 code exports/mo</li>
              <li><Check size={14} /> 1 collaborator</li>
              <li><Check size={14} /> Real-time detection</li>
              <li><Check size={14} /> React + HTML export</li>
            </ul>
            <button onClick={() => { setTab("signup"); setShowAuth(true); }}>
              Get Started
            </button>
          </div>
          {/* Pro */}
          <div className="landing-price-card featured">
            <div className="landing-price-badge">MOST POPULAR</div>
            <h3>Pro</h3>
            <div className="landing-price">$12<span>/mo</span></div>
            <ul>
              <li><Check size={14} /> 50 projects</li>
              <li><Check size={14} /> 500 code exports/mo</li>
              <li><Check size={14} /> 5 collaborators</li>
              <li><Check size={14} /> Priority detection</li>
              <li><Check size={14} /> All export formats</li>
            </ul>
            <button className="primary" onClick={() => { setTab("signup"); setShowAuth(true); }}>
              Start Pro Trial
            </button>
          </div>
          {/* Team */}
          <div className="landing-price-card">
            <h3>Team</h3>
            <div className="landing-price">$49<span>/mo</span></div>
            <ul>
              <li><Check size={14} /> Unlimited projects</li>
              <li><Check size={14} /> Unlimited exports</li>
              <li><Check size={14} /> Unlimited collaborators</li>
              <li><Check size={14} /> Custom templates</li>
              <li><Check size={14} /> SSO & admin controls</li>
            </ul>
            <button onClick={() => { setTab("signup"); setShowAuth(true); }}>
              Contact Sales
            </button>
          </div>
        </div>
      </section>

      {/* ═══════ Footer ═══════ */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="nav-brand">
            <Pen size={16} />
            <span>SketchUI</span>
          </div>
          <p>Sketch-to-code intelligence. Built with DTW, DBSCAN, and love.</p>
        </div>
      </footer>
    </>
  );
}
