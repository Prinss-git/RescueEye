# RescueEye

**AI-Assisted Disaster Command Center**  
University of Cebu – Banilad Campus · Capstone 2025

RescueEye integrates a simulated drone feed, real-time YOLOv8 victim and damage detection, a live geographic incident map, and a multi-organization coordination panel into a single tactical command interface.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Framer Motion |
| Detection API | FastAPI, YOLOv8 (Ultralytics), Python 3.11 |
| App Server | Node.js 18, Express 4 |
| Real-time sync | Firebase Firestore (optional) |
| Video stream | MJPEG via FFmpeg or synthetic PIL fallback |
| Map | Leaflet + react-leaflet, OpenStreetMap |
| Deployment | Vercel (frontend), Render (API + server) |

---

## System Requirements

- **Node.js** 18+
- **Python** 3.11+
- **FFmpeg** (optional — synthetic fallback used if absent)
- **npm** 9+
- **pip** 23+

---

## Installation

### 1. Clone and enter the repo

```bash
git clone <repo-url>
cd RescueEye
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env   # fill in VITE_FIREBASE_* if using Firebase
```

### 3. FastAPI Detection API

```bash
cd api
pip install -r requirements.txt
cp ../.env.example .env   # set DRONE_FEED_PATH, VICTIM_MODEL_PATH, etc.
```

### 4. Node.js App Server

```bash
cd server
npm install
cp ../.env.example .env   # set FIREBASE_CREDENTIAL_PATH if using Firebase
```

---

## Environment Variables

See `.env.example` at the root for a fully documented reference.

Key variables:

| Variable | Service | Purpose |
|----------|---------|---------|
| `DRONE_FEED_PATH` | API | Path to demo MP4 — omit for synthetic mode |
| `VICTIM_MODEL_PATH` | API | Custom victim detection weights |
| `DAMAGE_MODEL_PATH` | API | Custom damage classification weights |
| `FIREBASE_CREDENTIAL_PATH` | Server | Path to Firebase service account JSON |
| `VITE_FIREBASE_*` | Frontend | Firebase Web SDK config (6 vars) |

---

## Running in Development

Start all three services in separate terminals:

```bash
# Terminal 1 — Frontend (http://localhost:5173)
cd frontend && npm run dev

# Terminal 2 — FastAPI (http://localhost:8000)
cd api && uvicorn main:app --reload

# Terminal 3 — Node.js server (http://localhost:3001)
cd server && node index.js
```

Open `http://localhost:5173` and log in with:
- Email: `commander@rescueeye.ph`
- Password: `password123`

---

## Seed Demo Data

Reset the coordination panel to a clean demo state:

```bash
node server/scripts/seed.js
```

This creates 6 incidents, assigns 2 teams, and adds 10 seed messages.

---

## Starting a Drill Session

1. Log in as `command_staff`
2. Navigate to **Coordination**
3. Click **START DRILL** in the Incidents panel header
4. The system auto-generates simulated incidents every 30 seconds
5. All drill data is labeled `[SIM]` and tracked for evaluation
6. Click **STOP DRILL** when done
7. Navigate to **Evaluation** to view the session report

---

## Building for Production

```bash
cd frontend && npm run build   # outputs to frontend/dist/
```

Deploy `frontend/dist/` to Vercel with `frontend/vercel.json` for SPA routing.

---

## Known Limitations

- Drone feed is simulated (MP4 loop) — not a live RTSP stream
- Inference runs on CPU (~60–200ms/frame) — no GPU support in current deployment
- Victim GPS coordinates are approximated, not photogrammetrically computed
- Firebase is optional — the app runs fully in-memory without it
- Multi-drone support is not implemented in this version

---

## Future Work Recommendations

1. **Live RTSP integration** — replace MP4 with a real drone feed via `ffmpeg -i rtsp://...`
2. **GPU inference** — deploy FastAPI on a GPU-enabled Render instance or use TorchScript export
3. **Multi-drone support** — add a stream registry, per-drone detection threads
4. **GPS tagging** — use drone telemetry to compute real-world coordinates via inverse projection
5. **Firebase Authentication** — replace demo credentials with full Firebase Auth flow
6. **Mobile app** — React Native companion app for field team status updates
