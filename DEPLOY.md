# Deploy AdHub to production

AdHub is two apps + MongoDB:

| Piece | Tech | Suggested host |
|-------|------|----------------|
| Frontend | React (CRA + Craco) | **Vercel** or **Netlify** |
| Backend | FastAPI + Uvicorn | **Railway** or **Render** |
| Database | MongoDB | **MongoDB Atlas** (you already have this) |

---

## Before you deploy

1. **Code on GitHub** — push `AD-Hub` to your repo (you already have `SaiTejaBrandstory/AD-Hub`).
2. **Production secrets** — generate a new long `JWT_SECRET` (never use the local dev one).
3. **Atlas** — keep `MONGO_URL` with your Atlas user/password; in **Network Access** allow `0.0.0.0/0` or your host’s outbound IPs.
4. **Optional later** — `EMERGENT_LLM_KEY`, `RESEND_API_KEY` for datasets AI and report emails.

---

## Step 1 — Deploy the backend (API)

### Option A: Railway (recommended, simple)

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub** → select `AD-Hub`.
2. Set **Root Directory** to `backend`.
3. **Start command:**

   ```bash
   uvicorn server:app --host 0.0.0.0 --port $PORT
   ```

4. **Variables** (Railway → Variables):

   | Variable | Value |
   |----------|--------|
   | `MONGO_URL` | Your Atlas `mongodb+srv://...` string |
   | `DB_NAME` | `adhub` |
   | `JWT_SECRET` | Long random string (32+ chars) |
   | `CORS_ORIGINS` | `https://YOUR-FRONTEND-DOMAIN.vercel.app` (add custom domain later) |
   | `EMERGENT_LLM_KEY` | (optional, later) |
   | `RESEND_API_KEY` | (optional) |

5. Deploy → copy the public URL, e.g. `https://adhub-api.up.railway.app`.

6. Test: open `https://YOUR-API-URL/docs` — Swagger should load.

### Option B: Render

1. [render.com](https://render.com) → **New Web Service** → connect repo.
2. **Root Directory:** `backend` ← **required** (otherwise build fails)
3. **Build command:** `chmod +x build.sh && ./build.sh`  
   (uses `requirements-prod.txt` — avoids broken pins in full `requirements.txt`)
4. **Environment:** add `PYTHON_VERSION` = `3.11.11`
4. **Start command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
5. Add the same environment variables as above.

Or use the repo’s **`render.yaml`**: **New → Blueprint** → select `AD-Hub` (creates API + static site).

**Build error `No such file or directory: requirements.txt`:** Either set **Root Directory** to `backend`, **or** keep root empty and use:

| Root Directory | Build Command | Start Command |
|----------------|---------------|---------------|
| *(empty)* | `pip install -r requirements.txt` | `cd backend && uvicorn server:app --host 0.0.0.0 --port $PORT` |
| `backend` | `chmod +x build.sh && ./build.sh` | `uvicorn server:app --host 0.0.0.0 --port $PORT` |

Also set env **`PYTHON_VERSION`** = `3.11.11` (stops Python 3.14).

---

## Step 2 — Deploy the frontend (UI)

### Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → import `AD-Hub` from GitHub.
2. **Root Directory:** `frontend`
3. **Build command:** `npm install --legacy-peer-deps && npm run build`
4. **Output directory:** `build`
5. **Environment variable:**

   | Name | Value |
   |------|--------|
   | `REACT_APP_BACKEND_URL` | `https://YOUR-API-URL` (no trailing slash) |

6. Deploy → you get `https://adhub-xxx.vercel.app`.

7. **Update backend `CORS_ORIGINS`** on Railway/Render to include that exact URL, then redeploy/restart the API.

### Netlify

Same idea: base directory `frontend`, build `npm install --legacy-peer-deps && npm run build`, publish `build`, env `REACT_APP_BACKEND_URL`.

---

## Step 3 — Wire frontend ↔ backend

1. Frontend env: `REACT_APP_BACKEND_URL=https://your-api-host`
2. Backend env: `CORS_ORIGINS=https://your-frontend-host`
3. Redeploy **both** after changing env vars (CRA bakes `REACT_APP_*` at build time).

Test login:

```bash
curl -X POST https://YOUR-API-URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@adhub.com","password":"admin123"}'
```

Then open the live site → **Super Admin** → **Sign in**.

---

## Step 4 — Custom domain (optional)

1. **Vercel** → Project → Domains → add `app.yourdomain.com`
2. **Railway/Render** → add `api.yourdomain.com`
3. Update `REACT_APP_BACKEND_URL` and `CORS_ORIGINS` to those URLs → redeploy both.

---

## What works without extra keys

| Feature | Live without `EMERGENT_LLM_KEY` |
|---------|----------------------------------|
| Login, dashboard, campaigns, analytics, alerts, reports | Yes |
| Mock ad accounts | Yes |
| Datasets upload + AI analyze | No (needs key + `emergentintegrations` on server) |
| AI Audit page | Limited / fallback |
| Email PDF reports | Needs `RESEND_API_KEY` |

---

## Production checklist

- [ ] New `JWT_SECRET` in production only
- [ ] Atlas user password not committed to git (`.env` is gitignored)
- [ ] `CORS_ORIGINS` is your real frontend URL only (not `*` in production)
- [ ] Change demo passwords or disable seed in production (see note below)
- [ ] HTTPS on both frontend and API (hosts provide this by default)
- [ ] MongoDB Atlas backups enabled (M0 has limited backup)

### Demo users on first startup

The backend **auto-seeds** `admin@adhub.com` / `admin123` on first run. For a real production launch, change those passwords or remove seed users after deploy.

---

## Troubleshooting live

| Problem | Fix |
|---------|-----|
| Login fails / “Cannot reach API” | Wrong `REACT_APP_BACKEND_URL` or CORS mismatch |
| `bad auth` on API start | Fix `MONGO_URL` password in host env vars |
| CORS error in browser | Add exact frontend URL to `CORS_ORIGINS`, restart API |
| Build fails on Vercel | Use `npm install --legacy-peer-deps` in build command |
| Backend build fails | Install core packages from `README.md` if pinned `requirements.txt` fails |

---

## Quick architecture

```
Browser → https://app.example.com (Vercel)
              ↓ REACT_APP_BACKEND_URL
         https://api.example.com (Railway)
              ↓ MONGO_URL
         MongoDB Atlas
```

Add `EMERGENT_LLM_KEY` on the API host when you’re ready for datasets + full AI features.
