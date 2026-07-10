# SketchUI — Full deployment guide

**One GitHub repo → 3 Vercel projects + 1 Railway service**

Replace placeholders like `YOUR-API`, `YOUR-WEB`, etc. with your real URLs.

---

## Overview

| # | Service | Platform | Root path in repo | Production URL (example) |
|---|---------|----------|-------------------|--------------------------|
| 1 | REST API + AI | **Vercel** | `apps/http-backend` | `https://sketchui-api.vercel.app` |
| 2 | Drawing app | **Vercel** | `apps/web` | `https://sketchui-web.vercel.app` |
| 3 | Analytics dashboard | **Vercel** | `apps/dashboard` | `https://sketchui-dashboard.vercel.app` |
| 4 | WebSocket (live sync) | **Railway** | `apps/ws-backend` | `https://sketchui-ws.up.railway.app` |

**Deploy in this order:** API → Web → Dashboard → Railway → then update env URLs and redeploy.

---

## Step 0 — Prerequisites (once)

### 0.1 Push code to GitHub

```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### 0.2 Create PostgreSQL database

Use **[Neon](https://neon.tech)** (recommended), Supabase, or Vercel Postgres.

- Copy the **pooled** connection string (Neon: use the “Pooled” URL).
- Format: `postgresql://user:pass@host/dbname?sslmode=require`

### 0.3 Run database migrations (on your machine)

Create `.env` at the **repo root**:

```env
DATABASE_URL="postgresql://..."
```

Then:

```bash
pnpm install
pnpm --filter @repo/db exec prisma migrate deploy
```

### 0.4 Generate secrets

```bash
# Example — use any long random string for JWT_SECRET
openssl rand -base64 32
```

Save:
- `JWT_SECRET` — use the **same value** on API (Vercel) and WebSocket (Railway).
- `GEMINI_API_KEY` — from [Google AI Studio](https://aistudio.google.com/apikey) (for premium code generation).

---

## Step 1 — API (Vercel)

### Vercel project settings

| Setting | Value |
|---------|--------|
| **Import** | Your GitHub repo |
| **Project name** | `sketchui-api` (any name) |
| **Framework Preset** | Express (or Other) |
| **Root Directory** | `apps/http-backend` |
| **Node.js version** | 20.x (Project Settings → General) |

Build/install are defined in `apps/http-backend/vercel.json` (do not change unless needed):

| Setting | Command |
|---------|---------|
| Install Command | `cd ../.. && pnpm install` |
| Build Command | `cd ../.. && pnpm turbo build --filter=http-backend...` |
| Output Directory | *(leave default — Express serverless)* |

### Environment variables (Vercel → Settings → Environment Variables)

Add for **Production** and **Preview**:

| Variable | Required | Example / notes |
|----------|----------|-----------------|
| `DATABASE_URL` | ✅ Yes | `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` (pooled URL) |
| `JWT_SECRET` | ✅ Yes | `k8J2mN9pQ4rT7vX1zA5bC6dE8fG0hI3j` (min ~32 chars, random) |
| `GEMINI_API_KEY` | ✅ Yes | `AIza...` from Google AI Studio |
| `WEB_APP_URL` | ✅ Yes* | `https://sketchui-web.vercel.app` — set **after** Step 2, then redeploy API |
| `DASHBOARD_URL` | Optional | `https://sketchui-dashboard.vercel.app` — for CORS on dashboard |

\*Deploy API first without `WEB_APP_URL`, then add it after the web app URL is known.

`VERCEL_URL` is set automatically by Vercel (used for CORS fallback).

### Verify

Open: `https://YOUR-API.vercel.app/health`  
Expected: `{"ok":true,"service":"http-backend"}`

---

## Step 2 — Web app (Vercel)

### Vercel project settings

| Setting | Value |
|---------|--------|
| **Import** | Same GitHub repo (new project) |
| **Project name** | `sketchui-web` |
| **Framework Preset** | Next.js |
| **Root Directory** | `apps/web` |

From `apps/web/vercel.json`:

| Setting | Command |
|---------|---------|
| Install Command | `cd ../.. && pnpm install` |
| Build Command | `cd ../.. && pnpm turbo build --filter=web...` |
| Output Directory | `.next` (default) |

### Environment variables

Add for **Production** and **Preview**:

| Variable | Required | Example / notes |
|----------|----------|-----------------|
| `NEXT_PUBLIC_HTTP_API` | ✅ Yes | `https://sketchui-api.vercel.app` (no trailing slash) |
| `NEXT_PUBLIC_WS_URL` | ✅ Yes* | `wss://sketchui-ws.up.railway.app` — set **after** Step 4 |
| `NEXT_PUBLIC_DASHBOARD_URL` | Optional | `https://sketchui-dashboard.vercel.app` (link in nav) |

\*Use `wss://` in production (not `ws://`). Set after Railway is live, then **Redeploy** this project.

### After deploy

1. Copy production URL → e.g. `https://sketchui-web.vercel.app`
2. Go to **API project** (Step 1) → set `WEB_APP_URL` to that URL → **Redeploy API**

### Verify

- Open web URL → landing page loads
- Sign up / sign in works (hits API)

---

## Step 3 — Dashboard (Vercel)

### Vercel project settings

| Setting | Value |
|---------|--------|
| **Import** | Same GitHub repo (new project) |
| **Project name** | `sketchui-dashboard` |
| **Framework Preset** | Next.js |
| **Root Directory** | `apps/dashboard` |

From `apps/dashboard/vercel.json`:

| Setting | Command |
|---------|---------|
| Install Command | `cd ../.. && pnpm install` |
| Build Command | `cd ../.. && pnpm turbo build --filter=dashboard...` |

### Environment variables

| Variable | Required | Example / notes |
|----------|----------|-----------------|
| `NEXT_PUBLIC_HTTP_API` | ✅ Yes | `https://sketchui-api.vercel.app` |
| `NEXT_PUBLIC_WS_METRICS` | Optional | `https://sketchui-ws.up.railway.app/metrics` (Prometheus-style metrics from WS service) |
| `NEXT_PUBLIC_PROMETHEUS_URL` | Optional | Only if you run separate Prometheus |

### After deploy

On **API project**, set `DASHBOARD_URL` to dashboard URL → Redeploy API (CORS).

---

## Step 4 — WebSocket (Railway)

### Railway project settings

1. [railway.app](https://railway.app) → **New Project** → **GitHub Repo** → select same repo.
2. **Settings → Root Directory:** `/` (repo root) — **not** `apps/ws-backend`
3. **Settings → Build → Builder:** Dockerfile (auto from root `railway.toml`)
4. **Settings → Networking → Public Networking → Generate Domain** (port **8080**)

Build/deploy config is in **`railway.toml`** (repo root) and **`apps/ws-backend/Dockerfile`**:

| Setting | Value |
|---------|--------|
| Root Directory | **`/`** (repo root) |
| Builder | **Dockerfile** → `apps/ws-backend/Dockerfile` |
| Start | `node start.cjs` (inside container) |
| Health check | `/health` |

**If healthcheck still fails:** open **Deploy Logs** (not Build Logs). Look for:
- `[boot] missing bundle` → build output path issue
- `[boot] loading:` then crash → paste the error (often Prisma or missing env)
- No `[ws-backend] listening on 0.0.0.0:` → process exited before bind

**Enable public access:** Settings → Networking → **Generate Domain** (screenshot showing "Unexposed service" means no public URL yet — healthcheck can still fail if the process crashes).

**If build fails with `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING` and logs mention `apps/dashboard/next`:**  
Nixpacks ran the full monorepo `pnpm build` instead of the ws-backend filter. Fix:

1. Confirm **Root Directory** is `apps/ws-backend` (not repo root).
2. Redeploy — `nixpacks.toml` now overrides the default build.
3. Fallback: set Root Directory to **repo root**, Builder to **Dockerfile**, path `apps/ws-backend/Dockerfile`.

### Environment variables (Railway → Variables)

| Variable | Required | Example / notes |
|----------|----------|-----------------|
| `DATABASE_URL` | ✅ Yes | **Same** pooled URL as Vercel API |
| `JWT_SECRET` | ✅ Yes | **Same** value as Vercel API |
| `PORT` | ❌ **Never set** | Railway injects this. If you set `PORT=4003`, healthcheck will fail. |

### Verify

- `https://sketchui-ws.up.railway.app/health` → `{"ok":true,"service":"ws-backend"}`
- `https://sketchui-ws.up.railway.app/metrics` → Prometheus metrics (optional)

### Wire WebSocket to web app

On **Vercel web project** (Step 2):

```
NEXT_PUBLIC_WS_URL=wss://sketchui-ws.up.railway.app
```

**Redeploy** the web project (required for `NEXT_PUBLIC_*` changes).

---

## Step 5 — Final env wiring (checklist)

Fill in your real URLs:

```text
API_URL=https://________________.vercel.app
WEB_URL=https://________________.vercel.app
DASHBOARD_URL=https://________________.vercel.app
WS_URL=wss://________________.up.railway.app
```

| Project | Variable | Value |
|---------|----------|--------|
| **API (Vercel)** | `DATABASE_URL` | your Postgres pooled URL |
| **API (Vercel)** | `JWT_SECRET` | your secret |
| **API (Vercel)** | `GEMINI_API_KEY` | your Gemini key |
| **API (Vercel)** | `WEB_APP_URL` | `WEB_URL` |
| **API (Vercel)** | `DASHBOARD_URL` | `DASHBOARD_URL` |
| **Web (Vercel)** | `NEXT_PUBLIC_HTTP_API` | `API_URL` |
| **Web (Vercel)** | `NEXT_PUBLIC_WS_URL` | `WS_URL` |
| **Web (Vercel)** | `NEXT_PUBLIC_DASHBOARD_URL` | `DASHBOARD_URL` |
| **Dashboard (Vercel)** | `NEXT_PUBLIC_HTTP_API` | `API_URL` |
| **Dashboard (Vercel)** | `NEXT_PUBLIC_WS_METRICS` | `https://....up.railway.app/metrics` |
| **WS (Railway)** | `DATABASE_URL` | same as API |
| **WS (Railway)** | `JWT_SECRET` | same as API |

---

## Step 6 — Smoke tests

| Test | How |
|------|-----|
| API health | `GET API_URL/health` |
| WS health | `GET https://....railway.app/health` |
| Auth | Sign up + sign in on web app |
| Drawing room | Create/join room — canvas loads |
| Live sync | Two browser tabs — cursors/drawings sync |
| AI code gen | Code tab → Generate Premium UI |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| CORS error on API | Set `WEB_APP_URL` exactly to web URL (https, no trailing `/`). Redeploy API. |
| WebSocket fails | Use `wss://` + Railway domain. Redeploy **web** after changing `NEXT_PUBLIC_WS_URL`. |
| `GEMINI_API_KEY not configured` | Add key on **API** Vercel project only. |
| Prisma / DB errors | Use **pooled** `DATABASE_URL`. Run `prisma migrate deploy`. |
| Vercel build fails | Confirm **Root Directory** is `apps/web` (not repo root). |
| Railway healthcheck fails | 1) **Delete `PORT`** from Railway Variables. 2) Only set `DATABASE_URL` + `JWT_SECRET`. 3) Enable **Public Networking** → Generate Domain. 4) Check deploy logs for `[ws-backend] listening on 0.0.0.0:...` |
| Railway build fails | Root Directory must be `apps/ws-backend`. If logs show `dashboard/next`, Nixpacks built the whole monorepo — redeploy after `nixpacks.toml` fix, or use `apps/ws-backend/Dockerfile` with repo root. |
| JWT / auth works on web but not WS | `JWT_SECRET` must match on API and Railway. |

---

## Auto-deploy

All four services redeploy on `git push` to your connected branch (usually `main`).

---

## Local development (reference)

| Service | Port | Command |
|---------|------|---------|
| API | 4000 | `pnpm --filter http-backend dev` |
| Web | 4001 | `pnpm --filter web dev` |
| Dashboard | 4002 | `pnpm --filter dashboard dev` |
| WebSocket | 4003 | `pnpm --filter ws-backend dev` |

Local `.env` at repo root — see `.env.example`.
