# RescueEye — AI-Assisted Disaster Response Command Center

University of Cebu – Banilad Campus · Capstone Project 2025–2026

RescueEye is a web-based command center that integrates **live drone feeds**, **YOLO11s AI victim detection**, **dual-technology sensor simulation** (visual + thermal/life-sign), and **inter-organization incident coordination** into a single interface for Philippine disaster response personnel.

---

## Key Features

- **4 simultaneous drone feeds** — live MJPEG streams via FFmpeg, displayed in a 2×2 grid
- **YOLO11s victim detection** — trained on VisDrone dataset, runs on every feed in rotation
- **Dual-technology mode** — auto-switches between visual YOLO and thermal/life-sign simulation based on scene brightness; manual override available
- **Annotated detection frames** — bounding boxes drawn on feed thumbnails shown in the detection log
- **Real-time incident panel** — high-confidence detections auto-create incidents in the Node.js backend
- **Damage map** — Leaflet/OpenStreetMap with incident markers and dispatch controls
- **Coordination panel** — team status board and inter-organization messaging
- **Inference log** — downloadable CSV of all detection events with timestamps and model metadata

---

## Monorepo Structure

```
rescueeye/
├── frontend/          React + Vite + TypeScript + Tailwind CSS
│   └── src/
│       ├── screens/   Dashboard, DamageMap, Coordination, Login
│       └── components/DetectionLog, Navbar, IncidentPanel
├── api/               Python FastAPI — YOLO11s detection + dual-tech streaming
│   ├── routers/       detect.py, stream.py, logs.py, incidents.py
│   ├── services/      yolo_model.py, detection_store.py
│   └── models/        victim_best.onnx (not committed — see Models section)
├── server/            Node.js + Express — incidents, teams, messaging (Firebase)
└── notebooks/         train_rescueeye.ipynb — YOLO11s training on VisDrone
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| Python | 3.11+ |
| FFmpeg | 6+ (must be on PATH) |
| npm | 10+ |
| pip | 24+ |

---

## Quick Start — All Three Services

Open three terminals:

```bash
# Terminal 1 — Frontend (http://localhost:5173)
cd frontend
npm install
npm run dev

# Terminal 2 — Detection API (http://localhost:8000)
cd api
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
copy .env.example .env        # then edit paths
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 3 — Coordination Server (http://localhost:3001)
cd server
npm install
copy .env.example .env
npm run dev
```

---

## Environment Variables

### `api/.env`

```env
# Drone feed video files (MP4)
DRONE_FEED_PATH=C:/path/to/feed1.mp4
DRONE_FEED_PATH_2=C:/path/to/feed2.mp4
DRONE_FEED_PATH_3=C:/path/to/feed3.mp4
DRONE_FEED_PATH_4=C:/path/to/feed4.mp4

FRAME_RATE=8
CONFIDENCE_THRESHOLD=0.10
DARK_THRESHOLD=60           # brightness below this triggers thermal mode
INCIDENT_CONF_MIN=0.75      # min confidence to auto-create an incident
```

See `api/.env.example` for all options.

### `frontend/.env` (production only)

```env
VITE_API_URL=https://your-api.onrender.com
VITE_SERVER_URL=https://your-server.onrender.com
```

In local dev, Vite proxies `/api → :8000` and `/server → :3001` — no env file needed.

> **Never commit `.env` files, model weights, or video files.** All are listed in `.gitignore`.

---

## Models

Model weights are **not committed** to the repository (large binaries).

| File | Description |
|------|-------------|
| `api/models/victim_best.onnx` | YOLO11s trained on VisDrone (~19 epochs, mAP50 ≈ 0.622) |
| `api/models/victim_best.pt` | PyTorch checkpoint (source for ONNX export) |

If weights are not present, the API falls back to COCO `yolov8n.pt` and returns synthetic detections for demo purposes.

To retrain: open `notebooks/train_rescueeye.ipynb` in Google Colab (T4 GPU recommended).

---

## API Reference

### Detection API (`localhost:8000`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check + model status |
| `POST` | `/detect` | Base64 JPEG frame → detections + annotated thumbnail |
| `GET` | `/stream/feed` | MJPEG stream — Feed 1 |
| `GET` | `/stream/feed2` | MJPEG stream — Feed 2 |
| `GET` | `/stream/feed3` | MJPEG stream — Feed 3 |
| `GET` | `/stream/feed4` | MJPEG stream — Feed 4 |
| `GET` | `/stream/status` | Feed producer status |
| `GET` | `/logs` | Inference log (JSON) |
| `GET` | `/logs/export` | Download inference log as CSV |

Interactive docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### Coordination Server (`localhost:3001`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/incidents` | List all incidents |
| `POST` | `/incidents` | Create incident (called by AI bridge) |
| `PATCH` | `/incidents/:id/status` | Update incident status |
| `GET` | `/teams` | List response teams |
| `PATCH` | `/teams/:id/status` | Update team status |
| `GET` | `/messages` | Get messages |
| `POST` | `/messages` | Post a message |

---

## Frontend Routes

| Path | Screen |
|------|--------|
| `/login` | Login |
| `/dashboard` | Live Command Dashboard (feeds + detection log + incidents) |
| `/map` | Damage Map with incident markers |
| `/coordination` | Team board + messaging |

---

## Dual-Technology Detection

RescueEye implements automatic sensor mode switching:

| Mode | Trigger | Behavior |
|------|---------|---------|
| **Visual** | Scene brightness ≥ 60 | YOLO11s detects persons and damage classes |
| **Thermal** | Scene brightness < 60 | Frame displayed as infrared colormap; detections labeled as `LIFE_SIGN` |
| **Manual** | UI toggle (AUTO / 👁 / 🌡) | Forces a specific mode regardless of brightness |

The thermal mode is a **software simulation** of an IR life-sign sensor — intended as a prototype of the dual-technology architecture described in the project brief. Integration with real hardware (e.g., FLIR Lepton, MAVLink telemetry) is documented as a future phase.

---

## Phase Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ Done | Scaffold — 3 services, 4 UI screens, stub endpoints |
| 2 | ✅ Done | FFmpeg MJPEG streams + real YOLO inference + canvas overlay |
| 3 | ✅ Done | YOLO11s training on VisDrone + ONNX export + dual-tech mode |
| 4 | ✅ Done | 4-feed grid, incident auto-creation, detection log, CSV export, damage map |
| 5 | Pending | Live hardware integration (drone + thermal sensor) + field evaluation |

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 18, Vite 5, TypeScript, Tailwind CSS 3, Framer Motion, Leaflet |
| Detection API | Python 3.11, FastAPI, Uvicorn, Ultralytics YOLO11s, ONNX Runtime, Pillow |
| Coord. Server | Node.js 20, Express 4, Firebase Admin SDK |
| Video pipeline | FFmpeg (subprocess), MJPEG over HTTP |
| AI training | Google Colab T4, VisDrone dataset, YOLO11s → ONNX export |
| Maps | OpenStreetMap via Leaflet |
