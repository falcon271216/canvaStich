"use client";

import { useState, useEffect, useCallback } from "react";
import {
  User,
  Mail,
  ShieldAlert,
  ArrowLeft,
  LogOut,
  FolderOpen,
  Check,
  Camera,
  Loader2,
  Calendar,
  Lock,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_HTTP_API ?? "http://localhost:4000";

const AVATARS = [
  { id: "indigo", name: "Indigo Tech", gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)" },
  { id: "emerald", name: "Emerald Forest", gradient: "linear-gradient(135deg, #10b981, #059669)" },
  { id: "rose", name: "Rose Blush", gradient: "linear-gradient(135deg, #f43f5e, #e11d48)" },
  { id: "cyan", name: "Cyan Breeze", gradient: "linear-gradient(135deg, #06b6d4, #0891b2)" },
  { id: "amber", name: "Amber Flame", gradient: "linear-gradient(135deg, #f59e0b, #d97706)" },
  { id: "fuchsia", name: "Fuchsia Neon", gradient: "linear-gradient(135deg, #d946ef, #c026d3)" },
];

export default function ProfilePage() {
  const [token, setToken] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  
  // User profile state
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [currentAvatar, setCurrentAvatar] = useState("indigo");
  const [plan, setPlan] = useState("free");
  const [joinedDate, setJoinedDate] = useState("");
  
  // Password change state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // UI states
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    setToken(t);
    setMounted(true);
    if (!t) {
      window.location.replace("/");
    }
  }, []);

  const fetchProfile = useCallback(async (authToken: string) => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("token");
          window.location.replace("/");
          return;
        }
        throw new Error("Failed to load profile");
      }

      const { user } = await res.json();
      setUserId(user.id);
      setEmail(user.email);
      setName(user.name);
      setCurrentAvatar(user.photo || "indigo");
      setPlan(user.plan || "free");
      if (user.createdAt) {
        const date = new Date(user.createdAt);
        setJoinedDate(date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }));
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Could not load profile. Please refresh." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchProfile(token);
    }
  }, [token, fetchProfile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    setUpdating(true);
    setMessage(null);

    try {
      const res = await fetch(`${API}/api/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, photo: currentAvatar }),
      });

      if (!res.ok) throw new Error("Failed to update profile info");

      setMessage({ type: "success", text: "Profile details updated successfully!" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to update profile." });
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    if (password.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }

    setUpdating(true);
    setMessage(null);

    try {
      const res = await fetch(`${API}/api/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) throw new Error("Failed to update password");

      setMessage({ type: "success", text: "Password changed successfully!" });
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to change password." });
    } finally {
      setUpdating(false);
    }
  };

  const handleSelectAvatar = async (avatarId: string) => {
    setCurrentAvatar(avatarId);
    if (!token) return;
    try {
      await fetch(`${API}/api/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ photo: avatarId }),
      });
    } catch (err) {
      console.error("Auto avatar save failed:", err);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("token");
    window.location.replace("/");
  };

  if (!mounted || token === null) return null;

  const currentGrad = AVATARS.find(a => a.id === currentAvatar)?.gradient || AVATARS[0]!.gradient;

  return (
    <div style={{ minHeight: "100vh", background: "#0c0c0f", color: "#fafafa", fontFamily: "inherit" }}>
      {/* Navbar */}
      <nav className="nav" style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)", background: "rgba(12, 12, 15, 0.8)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div className="nav-brand" style={{ cursor: "pointer" }} onClick={() => window.location.href = "/projects"}>
          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", color: "white", marginRight: "0.5rem" }}>S</div>
          <span>SketchUI</span>
        </div>
        <div className="nav-actions">
          <a href="/projects" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <FolderOpen size={14} />
            Dashboard
          </a>
          <button type="button" onClick={handleSignOut} style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.08)", padding: "0.4rem 0.8rem", borderRadius: "6px", cursor: "pointer", color: "#fca5a5" }}>
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div style={{ maxWidth: "1050px", margin: "0 auto", padding: "3rem 1.5rem" }}>
        
        {/* Header Back Button */}
        <div style={{ marginBottom: "2rem" }}>
          <button 
            onClick={() => window.location.href = "/projects"}
            style={{ background: "none", border: "none", color: "#a1a1aa", display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.9rem", transition: "color 0.15s" }}
            onMouseEnter={(e) => e.currentTarget.style.color = "#fafafa"}
            onMouseLeave={(e) => e.currentTarget.style.color = "#a1a1aa"}
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "40vh", gap: "1rem" }}>
            <Loader2 size={36} className="animate-spin" style={{ color: "#6366f1" }} />
            <p style={{ color: "#a1a1aa", fontSize: "0.95rem" }}>Loading account settings...</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "2rem" }}>
            
            {/* Feedback Notifications */}
            {message && (
              <div 
                style={{ 
                  background: message.type === "success" ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)", 
                  border: message.type === "success" ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(239, 68, 68, 0.2)",
                  borderRadius: "10px", 
                  color: message.type === "success" ? "#a7f3d0" : "#fca5a5", 
                  padding: "1rem", 
                  fontSize: "0.9rem", 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "0.75rem" 
                }}
              >
                {message.type === "success" ? <Check size={18} /> : <ShieldAlert size={18} />}
                <span>{message.text}</span>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "2rem" }} className="profile-grid">
              
              {/* Profile Sidebar Info */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                
                {/* User Card */}
                <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "16px", padding: "2rem", textAlign: "center" }}>
                  <div style={{ position: "relative", width: "110px", height: "110px", margin: "0 auto 1.5rem", borderRadius: "50%", background: currentGrad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem", fontWeight: "bold", color: "white", boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)" }}>
                    {name ? name.substring(0, 2).toUpperCase() : email.substring(0, 2).toUpperCase()}
                    <div style={{ position: "absolute", bottom: 0, right: 0, width: "32px", height: "32px", background: "#18181b", borderRadius: "50%", border: "2px solid #0c0c0f", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} title="Select Avatar Theme">
                      <Camera size={14} style={{ color: "#a1a1aa" }} />
                    </div>
                  </div>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: "700", marginBottom: "0.25rem", color: "#fafafa" }}>{name || "User"}</h2>
                  <p style={{ fontSize: "0.85rem", color: "#a1a1aa", marginBottom: "1.25rem", wordBreak: "break-all" }}>{email}</p>
                  
                  <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem", textAlign: "left" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.82rem", color: "#a1a1aa" }}>
                      <Calendar size={14} />
                      Joined {joinedDate || "recently"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.82rem", color: "#a1a1aa" }}>
                      <span className={`badge ${plan === "free" ? "badge-accent" : "badge-success"}`} style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}>
                        {plan.toUpperCase()} PLAN
                      </span>
                    </div>
                  </div>
                </div>

                {/* Avatar Selection Picker */}
                <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "16px", padding: "1.5rem" }}>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: "700", marginBottom: "1rem", color: "#fafafa" }}>Avatar Theme</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
                    {AVATARS.map((avatar) => (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => handleSelectAvatar(avatar.id)}
                        style={{ 
                          height: "55px", 
                          borderRadius: "10px", 
                          background: avatar.gradient, 
                          border: currentAvatar === avatar.id ? "3px solid #6366f1" : "2px solid transparent",
                          cursor: "pointer", 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center", 
                          transition: "transform 0.15s, border-color 0.15s" 
                        }}
                        title={avatar.name}
                        onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
                        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                      >
                        {currentAvatar === avatar.id && <Check size={16} style={{ color: "white", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }} />}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Main settings panel */}
              <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                
                {/* Profile Edit Card */}
                <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "16px", padding: "2.5rem" }}>
                  <h3 style={{ fontSize: "1.15rem", fontWeight: "700", color: "#fafafa", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <User size={18} style={{ color: "#6366f1" }} />
                    Profile Details
                  </h3>

                  <form onSubmit={handleUpdateProfile} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <label style={{ fontSize: "0.82rem", color: "#a1a1aa", fontWeight: "600" }}>Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your name"
                        required
                        style={{ background: "#18181b", border: "1px solid rgba(255, 255, 255, 0.08)", padding: "0.75rem 1rem", borderRadius: "8px", color: "white", fontSize: "0.9rem", transition: "border-color 0.15s" }}
                        onFocus={(e) => e.target.style.borderColor = "#6366f1"}
                        onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.08)"}
                      />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <label style={{ fontSize: "0.82rem", color: "#a1a1aa", fontWeight: "600" }}>Email Address</label>
                      <input
                        type="email"
                        value={email}
                        disabled
                        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255, 255, 255, 0.03)", padding: "0.75rem 1rem", borderRadius: "8px", color: "#71717a", fontSize: "0.9rem", cursor: "not-allowed" }}
                      />
                      <span style={{ fontSize: "0.72rem", color: "#71717a" }}>Contact our support to change registered account email.</span>
                    </div>

                    <button
                      type="submit"
                      disabled={updating}
                      className="primary"
                      style={{ marginTop: "1rem", alignSelf: "flex-start", minWidth: "150px", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                    >
                      {updating && <Loader2 size={14} className="animate-spin" />}
                      Save Changes
                    </button>
                  </form>
                </div>

                {/* Password Change Card */}
                <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "16px", padding: "2.5rem" }}>
                  <h3 style={{ fontSize: "1.15rem", fontWeight: "700", color: "#fafafa", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <Lock size={18} style={{ color: "#e11d48" }} />
                    Update Password
                  </h3>

                  <form onSubmit={handleUpdatePassword} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <label style={{ fontSize: "0.82rem", color: "#a1a1aa", fontWeight: "600" }}>New Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter new password (min. 6 chars)"
                        required
                        style={{ background: "#18181b", border: "1px solid rgba(255, 255, 255, 0.08)", padding: "0.75rem 1rem", borderRadius: "8px", color: "white", fontSize: "0.9rem", transition: "border-color 0.15s" }}
                        onFocus={(e) => e.target.style.borderColor = "#6366f1"}
                        onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.08)"}
                      />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <label style={{ fontSize: "0.82rem", color: "#a1a1aa", fontWeight: "600" }}>Confirm Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                        style={{ background: "#18181b", border: "1px solid rgba(255, 255, 255, 0.08)", padding: "0.75rem 1rem", borderRadius: "8px", color: "white", fontSize: "0.9rem", transition: "border-color 0.15s" }}
                        onFocus={(e) => e.target.style.borderColor = "#6366f1"}
                        onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.08)"}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={updating}
                      className="primary"
                      style={{ marginTop: "1rem", alignSelf: "flex-start", minWidth: "150px", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", background: "linear-gradient(135deg, #e11d48, #be123c)" }}
                    >
                      {updating && <Loader2 size={14} className="animate-spin" />}
                      Update Password
                    </button>
                  </form>
                </div>

              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}
