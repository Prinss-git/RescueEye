# RescueEye — AI-Assisted Command Center

University of Cebu – Banilad Campus · Capstone Project 2025

RescueEye integrates live drone feeds, YOLOv8 victim detection, disaster damage
classification, and inter-organization messaging into a single web-based command center
for Philippine disaster response personnel.

---

## Monorepo Structure

```
rescueeye/
├── frontend/   React + Vite + TypeScript + Tailwind CSS
├── api/        Python FastAPI — YOLOv8 detection + damage classification
└── server/     Node.js + Express — auth, teams, messaging (Firebase)
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| Python | 3.11+ |
| npm | 10+ |
| pip | 24+ |

---

## 1 — Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

**Available routes:**

| Path | Screen |
|------|--------|
| `/login` | Login |
| `/dashboard` | Live Command Dashboard |
| `/map` | Damage Map |
| `/coordination` | Coordination Panel |

---

## 2 — Detection API (FastAPI)

```bash
cd api

# Create and activate a virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
copy .env.example .env   # Windows
# cp .env.example .env   # macOS/Linux

# Start the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
# Runs on http://localhost:8000
```

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service health check |
| `POST` | `/detect` | Upload image → detection JSON (stub) |
| `POST` | `/classify` | Upload image → damage label (stub) |

Interactive docs: http://localhost:8000/docs

---

## 3 — Auth + Messaging Server (Node.js)

```bash
cd server
npm install

# Copy and configure environment
copy .env.example .env   # Windows
# cp .env.example .env   # macOS/Linux

# (Optional) Place your Firebase service account JSON at the path
# set in FIREBASE_CREDENTIAL_PATH inside .env

npm run dev   # uses nodemon for hot reload
# or: npm start
# Runs on http://localhost:3001
```

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service health check |
| `POST` | `/auth/login` | Login (stub) |
| `POST` | `/auth/logout` | Logout |
| `GET` | `/teams` | List all response teams |
| `GET` | `/teams/:id` | Get single team |
| `PATCH` | `/teams/:id/status` | Update team status |
| `GET` | `/messages?incidentId=` | Get messages (optionally filtered) |
| `POST` | `/messages` | Post a new message |

---

## Environment Variables

### `api/.env`

```
HOST=0.0.0.0
PORT=8000
MODEL_PATH=models/yolov8n.pt
CONFIDENCE_THRESHOLD=0.5
ALLOWED_ORIGINS=http://localhost:5173
```

### `server/.env`

```
PORT=3001
ALLOWED_ORIGINS=http://localhost:5173
FIREBASE_CREDENTIAL_PATH=./firebase-service-account.json
```

> **Never commit `.env` files or `firebase-service-account.json`.**
> Both are listed in `.gitignore`.

---

## Running All Three Services

Open three terminal windows:

```bash
# Terminal 1 — Frontend
cd frontend && npm run dev

# Terminal 2 — Detection API
cd api && .venv\Scripts\activate && uvicorn main:app --reload --port 8000

# Terminal 3 — Auth/Messaging Server
cd server && npm run dev
```

---

## Phase Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ **Done** | Scaffold — all 3 services, 4 UI screens, stub endpoints |
| 2 | Pending | FFmpeg drone feed loop + real YOLOv8 inference wired to canvas |
| 3 | Pending | Damage classifier training + integration |
| 4 | Pending | Firebase Auth + Firestore messaging |
| 5 | Pending | Simulated drill evaluation with 20 personnel |

---

## Tech Stack

- **Frontend:** React 18, Vite 5, TypeScript (strict), Tailwind CSS 3, React Router v6, Leaflet / OpenStreetMap
- **Detection API:** Python 3.11, FastAPI, Uvicorn, Ultralytics YOLOv8 (Phase 2)
- **Auth/Messaging:** Node.js 20, Express 4, Firebase Admin SDK
- **Video simulation:** FFmpeg (Phase 2)
