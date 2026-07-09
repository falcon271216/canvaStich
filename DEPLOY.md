# Deploy SketchUI (one repo → 4 services)

Push this repo to GitHub first, then follow the steps below in order.

---

## 0. Database (do this once)

Use **Neon**, **Supabase**, or **Vercel Postgres** for PostgreSQL.

1. Create a database and copy the connection string.
2. Locally, set `DATABASE_URL` in `.env` at the repo root.
3. Run migrations:

```bash
pnpm install
pnpm --filter @repo/db exec prisma migrate deploy
```

Use the **pooled** connection string for Vercel/Railway (Neon “pooler” URL recommended).

---

## 1. API — Vercel (`apps/http-backend`)

1. Go to [vercel.com/new](https://vercel.com/new) → Import your GitHub repo.
2. **Project name:** e.g. `sketchui-api`
3. **Root Directory:** `apps/http-backend`
4. Framework should auto-detect **Express** (or Other).
5. **Environment variables** (Production + Preview):

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Your PostgreSQL URL (pooled) |
| `JWT_SECRET` | Long random string (same for all services) |
| `GEMINI_API_KEY` | Google Gemini API key |
| `WEB_APP_URL` | `https://YOUR-WEB.vercel.app` (set after step 2) |
| `DASHBOARD_URL` | `https://YOUR-DASHBOARD.vercel.app` (optional) |

6. Deploy → copy the URL, e.g. `https://sketchui-api.vercel.app`
7. Test: open `https://sketchui-api.vercel.app/health` → should return `{"ok":true}`

---

## 2. Web app — Vercel (`apps/web`)

1. **New Project** → same repo.
2. **Root Directory:** `apps/web`
3. Framework: **Next.js** (auto).
4. **Environment variables:**

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_HTTP_API` | `https://sketchui-api.vercel.app` |
| `NEXT_PUBLIC_WS_URL` | `wss://YOUR-WS.up.railway.app` (set after step 4) |
| `NEXT_PUBLIC_DASHBOARD_URL` | `https://YOUR-DASHBOARD.vercel.app` (optional) |

5. Deploy → main URL e.g. `https://sketchui-web.vercel.app`
6. Go back to **API project** → set `WEB_APP_URL` to this URL → Redeploy API (for CORS).

---

## 3. Dashboard — Vercel (`apps/dashboard`) *(optional)*

1. **New Project** → same repo.
2. **Root Directory:** `apps/dashboard`
3. **Environment variables:**

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_HTTP_API` | `https://sketchui-api.vercel.app` |

4. Deploy.

---

## 4. WebSocket — Railway (`apps/ws-backend`)

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
2. Select the same repository.
3. **Settings → Root Directory:** `apps/ws-backend`
4. **Settings → Networking → Generate Domain** (e.g. `sketchui-ws.up.railway.app`)
5. **Variables:**

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Same as API |
| `JWT_SECRET` | Same as API |

6. Deploy. Railway uses `railway.toml` for build/start.
7. Test: `https://sketchui-ws.up.railway.app/health`
8. Update **web** Vercel project:

```
NEXT_PUBLIC_WS_URL=wss://sketchui-ws.up.railway.app
```

Redeploy the web app.

---

## 5. Final checklist

- [ ] `https://YOUR-API.vercel.app/health` → OK
- [ ] `https://YOUR-WS.up.railway.app/health` → OK
- [ ] Web app loads, sign up / sign in works
- [ ] Open a draw room — live cursors / drawing sync (WebSocket)
- [ ] Code generation works (needs `GEMINI_API_KEY` on API)

---

## Redeploy after code changes

| Service | What happens |
|---------|----------------|
| Vercel (3 projects) | Auto-deploy on `git push` to main |
| Railway | Auto-deploy on `git push` to main |

---

## Troubleshooting

**CORS errors on API**  
Set `WEB_APP_URL` on the API project to your exact web URL (no trailing slash).

**WebSocket won’t connect**  
Use `wss://` (not `ws://`) and the Railway public domain. Redeploy web after changing `NEXT_PUBLIC_WS_URL`.

**Database errors on Vercel**  
Use a pooled `DATABASE_URL`. Run `prisma migrate deploy` if tables are missing.

**Build fails on Vercel**  
Ensure Root Directory is set correctly (`apps/web`, not repo root). Install/build commands are in each `vercel.json`.
