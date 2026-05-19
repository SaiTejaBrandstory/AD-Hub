# AdHub — local development

Multi-tenant ad agency dashboard: **React** frontend + **FastAPI** backend + **MongoDB**.

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Node.js](https://nodejs.org/) | 18+ | Frontend |
| [Python](https://www.python.org/) | **3.10+** recommended | Backend API |
| [MongoDB](https://www.mongodb.com/) | 6+ | Database (local or [Atlas](https://www.mongodb.com/atlas)) |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | optional | Easiest local MongoDB — **must be running** before `docker run` |

> **Note:** `backend/requirements.txt` was generated on Emergent’s cloud image (pinned versions may not install on every Mac). Use the install commands below, or Python 3.11+ with `pip install -r requirements.txt` if it resolves cleanly.

## 1. MongoDB

**Docker (recommended):**

```bash
docker run -d --name adhub-mongo -p 27017:27017 mongo:7
```

**Or** install MongoDB locally / use a free Atlas cluster and set `MONGO_URL` in `backend/.env`.

## 2. Environment files

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` if MongoDB is not on `localhost:27017`.

Optional keys (app works without them for most UI):

- `EMERGENT_LLM_KEY` — AI audit, dataset analysis, file uploads
- `RESEND_API_KEY` — email PDF reports

## 3. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install --upgrade pip
# If requirements.txt fails, install core packages:
pip install fastapi uvicorn motor python-dotenv bcrypt PyJWT httpx apscheduler \
  pymongo python-multipart email-validator passlib 'python-jose[cryptography]' \
  resend reportlab pandas openpyxl requests
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

`emergentintegrations` (AI audit / dataset features) ships on Emergent’s platform only. The rest of the app runs without it.

API docs: http://localhost:8000/docs

On first start, demo data is seeded automatically.

## 4. Frontend

In a **second terminal**:

```bash
cd frontend
npm install --legacy-peer-deps
npm start
```

If you see `Cannot find module 'ajv/dist/compile/codegen'`, run `npm install` again in `frontend/` (the repo pins `ajv@8` and adjusts webpack for this). If port 3000 is busy: `lsof -ti:3000 | xargs kill -9` then retry.

App UI: http://localhost:3000

## Demo logins

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@adhub.com | admin123 |
| Manager | manager@adhub.com | manager123 |
| Client | client@northwind.com | client123 |

## Project layout

- `frontend/src/` — React pages, components, API client
- `backend/server.py` — main API routes
- `backend/seed.py` — demo brands, campaigns, users
- `memory/PRD.md` — product notes and feature list

## Viewing the code

Open the `AD-Hub` folder in **Cursor** or **VS Code**. Start with:

- `frontend/src/App.js` — routes
- `frontend/src/pages/` — screens (Dashboard, Campaigns, …)
- `backend/server.py` — API
