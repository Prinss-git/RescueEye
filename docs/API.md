# RescueEye — API Reference

All endpoints are served locally at:
- **FastAPI:** `http://localhost:8000`
- **Node.js:** `http://localhost:3001`

Frontend accesses both via Vite proxy: `/api → :8000`, `/server → :3001`

---

## FastAPI — Detection API

### `GET /health`
System health check.

**Response:**
```json
{
  "status": "ok",
  "version": "0.3.0",
  "phase": "3-custom-models",
  "models": { "victim": "...", "damage": "..." },
  "stream_active": true
}
```

---

### `POST /detect`
Run YOLOv8 victim detection on a base64-encoded JPEG frame.

**Request:**
```json
{ "frame": "data:image/jpeg;base64,/9j/4AAQ..." }
```

**Response:**
```json
{
  "detections": [
    { "id": "abc12345-0", "class": "person", "confidence": 0.87,
      "bbox": { "x": 80, "y": 60, "w": 55, "h": 110 }, "timestamp": "..." }
  ],
  "inference_time_ms": 142.3,
  "frame_id": "uuid",
  "model_version": "custom_v1"
}
```

**Errors:** `422` — missing or invalid frame.

---

### `POST /classify`
Run YOLOv8 damage classification on a base64 image.

**Request:** Same as `/detect`

**Response:**
```json
{
  "damage_class": "flood_damage",
  "confidence": 0.79,
  "all_scores": { "flood_damage": 0.79, "fire_damage": 0.12, ... },
  "inference_time_ms": 88.1,
  "model_version": "pretrained_coco"
}
```

---

### `GET /stream/feed`
MJPEG video stream (`multipart/x-mixed-replace`). Use as `<img src="/api/stream/feed">`.

### `GET /stream/status`
```json
{ "active": true, "source": "synthetic", "fps": 1, "frame_count": 142 }
```

### `GET /stream/snapshot`
Returns a single JPEG frame.

---

### `GET /detections/recent?limit=20`
```json
{
  "detections": [
    { "id": "...", "class": "person", "confidence": 0.91,
      "lat": 10.3157, "lng": 123.8854, "timestamp": "..." }
  ],
  "count": 7
}
```

---

### `GET /models/status`
```json
{
  "victim_model": { "version": "custom_v1", "loaded": true, "is_custom": true, "map50": 0.72 },
  "damage_model": { "version": "pretrained_coco", "loaded": true, "is_custom": false }
}
```

### `POST /models/reload`
Hot-swap both models without restart. Body: `{}`.

### `POST /models/reload/victim` / `POST /models/reload/damage`
Hot-swap individual model.

---

### `GET /logs/summary`
```json
{
  "total_frames": 847,
  "total_detections": 234,
  "avg_inference_ms": 156.4,
  "log_file": "/app/logs/inference_log.jsonl"
}
```

---

## Node.js — App Server

### `POST /auth/login`
**Request:**
```json
{ "email": "commander@rescueeye.ph", "password": "password123" }
```
**Response:**
```json
{
  "token": "base64token",
  "user": { "uid": "...", "email": "...", "displayName": "Cdr. Reyes",
            "role": "incident_commander", "organization": "CDRRMO Cebu" }
}
```

---

### `GET /teams`
Returns all teams array.

### `GET /teams/:id`
Returns one team by ID.

### `PATCH /teams/:id/status`
**Request:** `{ "status": "DISPATCHED" }`  
Valid: `STANDBY | DISPATCHED | ON_SITE | COMPLETE`

### `PATCH /teams/:teamId/assign`
**Request:** `{ "incidentId": "INC-..." }`  
Updates team `assignedTo` and incident `assignedTeam`.

---

### `GET /incidents?status=OPEN&type=FLOOD`
Returns filtered incidents array (sorted newest-first).

### `GET /incidents/:id`

### `POST /incidents`
**Request:**
```json
{
  "type": "VICTIM_DETECTED",
  "severity": "HIGH",
  "lat": 10.3157, "lng": 123.8854,
  "description": "Victim on rooftop",
  "reportedBy": "AI_SYSTEM"
}
```

### `PATCH /incidents/:id/resolve`
Sets `status: RESOLVED`, frees assigned team.

---

### `GET /messages?incidentId=INC-...`
Returns messages array for an incident (sorted oldest-first).

### `POST /messages`
**Request:**
```json
{
  "incidentId": "INC-...",
  "senderId": "uid",
  "senderName": "Cdr. Reyes",
  "senderOrg": "CDRRMO Cebu",
  "content": "Alpha ETA 8 minutes",
  "type": "SITUATION_REPORT"
}
```
Valid types: `SITUATION_REPORT | RESOURCE_REQUEST | UPDATE | ALERT`

---

### `POST /drill/start`
**Request:** `{ "userId": "uid" }`  
Starts a drill session, auto-generates incidents every 30s.

### `POST /drill/stop`
Stops active drill, returns session summary.

### `GET /drill/active`
Returns current drill session or `{ "active": false }`.

### `GET /drill/:sessionId/status`

---

### `GET /evaluation/report`
Returns latest evaluation report (reads `api/models/evaluation_report.json`).

### `GET /evaluation/report/:sessionId`
Returns report for a specific drill session.

---

## HTTP Error Codes

| Code | Meaning |
|------|---------|
| 400 | Missing or invalid field in request body |
| 401 | Invalid Firebase ID token |
| 404 | Resource not found |
| 422 | FastAPI validation error (missing/invalid frame) |
| 500 | Internal server error |
