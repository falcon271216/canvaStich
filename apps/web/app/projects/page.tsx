"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Pen,
  Plus,
  FolderOpen,
  Code2,
  Trash2,
  LogOut,
  BarChart3,
  Clock,
  Sparkles,
  Loader2,
  User,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_HTTP_API ?? "http://localhost:4000";

interface Project {
  id: string;
  name: string;
  framework: string;
  createdAt: string;
  updatedAt: string;
  workspace: { name: string; plan: string };
  room: { id: number; name: string; slug: string } | null;
}

interface Workspace {
  id: string;
  name: string;
  plan: string;
  _count: { projects: number };
}

export default function ProjectsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    setToken(t);
    setMounted(true);
    if (!t) window.location.replace("/");
  }, []);

  const headers = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  const fetchOrCreateWorkspace = useCallback(async (): Promise<Workspace | null> => {
    try {
      const wsRes = await fetch(`${API}/api/workspaces`, { headers: headers() });
      const wsData = await wsRes.json();

      if (!wsRes.ok) {
        const msg =
          typeof wsData.error === "string"
            ? wsData.error
            : "Failed to load workspace. Try signing in again.";
        setLoadError(msg);
        return null;
      }

      let ws: Workspace[] = wsData.workspaces ?? [];

      if (ws.length === 0) {
        const createRes = await fetch(`${API}/api/workspaces`, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({ name: "My Workspace" }),
        });
        const createData = await createRes.json();
        if (!createRes.ok || !createData.workspace) {
          const msg =
            typeof createData.error === "string"
              ? createData.error
              : "Failed to create workspace.";
          setLoadError(msg);
          return null;
        }
        ws = [{ ...createData.workspace, _count: { projects: 0 } }];
      }

      setWorkspaces(ws);
      setLoadError("");
      return ws[0] ?? null;
    } catch (err) {
      console.error("fetchOrCreateWorkspace error:", err);
      setLoadError("Could not reach the server. Is the backend running on port 4000?");
      return null;
    }
  }, [headers]);

  // Load workspaces + projects
  useEffect(() => {
    if (!token) return;

    const load = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const workspace = await fetchOrCreateWorkspace();

        if (!workspace) {
          setProjects([]);
          return;
        }

        const projRes = await fetch(`${API}/api/projects`, { headers: headers() });
        const projData = await projRes.json();
        if (!projRes.ok) {
          setLoadError(
            typeof projData.error === "string"
              ? projData.error
              : "Failed to load projects.",
          );
          setProjects([]);
          return;
        }
        setProjects(projData.projects ?? []);
      } catch (err) {
        console.error("Failed to load data:", err);
        setLoadError("Failed to load projects. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token, headers, fetchOrCreateWorkspace]);

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;

    setCreating(true);
    setLoadError("");

    try {
      const workspace = workspaces[0] ?? (await fetchOrCreateWorkspace());
      if (!workspace) {
        alert("No workspace available. Check the error on this page or sign in again.");
        return;
      }

      const roomRes = await fetch(`${API}/room`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ name }),
      });
      const roomData = await roomRes.json();

      if (!roomRes.ok) {
        alert(roomData.error || "Failed to create room");
        return;
      }

      const roomId = roomData.roomId ?? roomData.room?.id;

      if (roomId == null) {
        alert("Room was created but no ID was returned. Please try again.");
        return;
      }

      const res = await fetch(`${API}/api/projects`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          workspaceId: workspace.id,
          name,
          roomId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        const errMsg =
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error ?? "Failed to create project");
        alert(errMsg);
        return;
      }

      window.location.href = `/draw?room=${roomId}&token=${encodeURIComponent(token!)}`;
    } catch (err) {
      console.error("Create project error:", err);
      alert("Something went wrong. Please check your connection and try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    try {
      await fetch(`${API}/api/projects/${id}`, {
        method: "DELETE",
        headers: headers(),
      });
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleOpenProject = (project: Project) => {
    if (project.room) {
      window.location.href = `/draw?room=${project.room.id}&token=${encodeURIComponent(token!)}`;
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("token");
    window.location.replace("/");
  };

  if (!mounted || token === null) return null;

  const plan = workspaces[0]?.plan ?? "free";

  return (
    <>
      <nav className="nav">
        <div className="nav-brand">
          <Pen size={18} />
          <span>SketchUI</span>
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
          <a href="/rooms" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <FolderOpen size={14} />
            Rooms
          </a>
          <a href="/profile" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <User size={14} />
            Profile
          </a>
          <button
            type="button"
            onClick={handleSignOut}
            style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </nav>

      <div className="projects-page fade-in">
        {loadError && (
          <div className="auth-error" style={{ marginBottom: "1rem" }}>
            {loadError}
          </div>
        )}

        <div className="projects-header">
          <div>
            <h1 className="page-title">Your Projects</h1>
            <p className="page-subtitle">
              Sketch wireframes and export production code.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span className={`badge ${plan === "free" ? "badge-accent" : "badge-success"}`}>
              {plan.toUpperCase()} PLAN
            </span>
            <button className="primary" onClick={() => setShowCreate(true)}>
              <Plus size={15} />
              New Project
            </button>
          </div>
        </div>

        {/* Create project modal */}
        {showCreate && (
          <div className="project-create-overlay" onClick={() => setShowCreate(false)}>
            <div className="project-create-modal" onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginBottom: "1rem", fontSize: "1.1rem", fontWeight: 600 }}>
                <Sparkles size={16} style={{ color: "var(--accent)" }} /> New Project
              </h3>
              <div className="form-group">
                <label>Project Name</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="My wireframe"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                />
              </div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={handleCreateProject}
                  disabled={creating || loading || !newProjectName.trim()}
                >
                  {creating ? (
                    <>
                      <Loader2 size={14} className="spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Create & Open
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
            <Loader2 size={24} className="spin" style={{ marginBottom: "0.5rem" }} />
            <p>Loading projects...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && projects.length === 0 && (
          <div className="projects-empty">
            <div className="projects-empty-icon">
              <Code2 size={32} />
            </div>
            <h3>No projects yet</h3>
            <p>Create your first project to start sketching wireframes and generating code.</p>
            <button className="primary" onClick={() => setShowCreate(true)}>
              <Plus size={15} />
              Create First Project
            </button>
          </div>
        )}

        {/* Projects grid */}
        {!loading && projects.length > 0 && (
          <div className="projects-grid">
            {projects.map((project) => (
              <div
                key={project.id}
                className="project-card"
                onClick={() => handleOpenProject(project)}
              >
                <div className="project-card-preview">
                  <Code2 size={28} style={{ color: "var(--text-dim)" }} />
                </div>
                <div className="project-card-body">
                  <h3 className="project-card-title">{project.name}</h3>
                  <div className="project-card-meta">
                    <span>
                      <Clock size={11} />
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                    <span className="badge badge-accent" style={{ fontSize: "0.6rem" }}>
                      {project.framework.toUpperCase()}
                    </span>
                  </div>
                </div>
                <button
                  className="project-card-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteProject(project.id);
                  }}
                  title="Delete project"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
