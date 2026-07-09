# RescueEye — Defense Demo Script

**Estimated duration:** 8–10 minutes  
**Presenter:** Capstone Team  
**System:** RescueEye v1.0 — UC Banilad Campus AI-Assisted Disaster Command Center

---

## Setup (Before Panel Enters)

- [ ] Open RescueEye on laptop — full screen, 1920×1080
- [ ] Login as `command_staff` (`commander@rescueeye.ph` / `password123`)
- [ ] Pre-load demo MP4 feed — verify stream is running (green LIVE ON badge)
- [ ] Run seed script to reset to clean demo state: `node server/scripts/seed.js`
- [ ] Have Evaluation Report open in a second browser tab (`/evaluation`)
- [ ] Verify model pills on Dashboard show green `custom_v1` (or yellow `COCO` is acceptable)
- [ ] Set laptop to never sleep, disable all notifications

---

## Demo Flow

### Step 1 — Login (30 seconds)

**What to say:**
> "RescueEye begins at the command center login. Access is role-based —
> Command Staff use this web dashboard for the live feed, damage map,
> coordination, drill controls, and evaluation reports. Field Responders
> use a separate mobile app to accept and update missions."

**Actions:**
- Show the login screen (animated grid background, RescueEye logo)
- Log in as `commander@rescueeye.ph`
- Point out the instant navigation to Dashboard

---

### Step 2 — Live Dashboard (2 minutes)

**What to say:**
> "This is the main command dashboard. On the left is the simulated drone feed —
> in a real deployment this would be a live RTSP stream from a UAV over the
> disaster area. Our custom YOLOv8 victim detection model runs inference at
> [X]ms per frame, well within our 3-second latency target from the requirements."

**Actions:**
- Point to DRONE FEED ACTIVE status with pulsing green dot
- Click **▶ START DETECTION**
- Point to bounding boxes appearing on the canvas overlay
- Point to the DetectionLog entries animating in from the top
- Point to inference time indicator — highlight green/yellow/red coding
- Point to model status pills showing `VICTIM: custom_v1 | mAP 0.XX`
- Show the detection counter badge updating in real time
- Demonstrate inference color coding: "Under 1000ms is green — we're achieving that"

---

### Step 3 — Damage Map (1.5 minutes)

**What to say:**
> "Every detection above 75% confidence is automatically pinned to the geographic
> damage map. Red markers are victim detections — notice they pulse to indicate
> urgency. Orange markers are flood damage, yellow are fire. Command staff see
> the full spread of the disaster in real time without manually logging anything.
> This directly feeds the coordination layer."

**Actions:**
- Click **DAMAGE MAP** in navigation — observe fade transition
- Point to the legend with incident counts per type
- Click a victim marker → show popup with coordinates and confidence
- Show the **LIVE ON** badge confirming real-time polling
- Click **⌖ RECENTER** to reset the map view

---

### Step 4 — Coordination Panel (2.5 minutes)

**What to say:**
> "The coordination panel is where command decisions happen. Open incidents
> flow in from the AI detection pipeline automatically. The incident commander
> assigns response teams here — no radio calls, no whiteboards. All actions
> are synchronized to Firebase Firestore in real time so every device in the
> command center sees the same state."

**Actions:**
- Click **COORDINATION** — observe fade transition
- Show the three-column layout: Incidents | Teams | Messages
- Click an OPEN incident in the left column to select it
- Click **ASSIGN →** on Alpha Team in the center column
- Show the confirm modal → click **CONFIRM**
- Show team status change to DISPATCHED
- Type a message in the right column (type: SITUATION_REPORT)
- Click **SEND** — show message appearing in thread
- Point to message timestamp and type badge

---

### Step 5 — Drill Mode (30 seconds, if time permits)

**What to say:**
> "As incident commander I can activate a drill session. The system automatically
> generates simulated incidents every 30 seconds — labeled SIMULATED so real and
> drill data are never mixed. All actions during a drill are captured for
> post-drill evaluation."

**Actions:**
- Click **START DRILL** button in Incidents panel header
- Show pulsing **● DRILL ACTIVE** badge in the Navbar
- Show a [SIM] incident appearing in the list

---

### Step 6 — Evaluation Report (1.5 minutes)

**What to say:**
> "Finally — the evaluation dashboard. After a disaster drill, incident commanders
> get a full performance report: AI detection accuracy, combined inference latency
> versus our 3-second objective, and team response metrics. This directly supports
> post-disaster debriefs and DRRM compliance documentation."

**Actions:**
- Click **EVALUATION** in navigation
- Show the report — point to victim mAP@0.5 metric and target (≥ 0.70)
- Point to latency assertion: "Combined [X]ms — PASS under 3000ms target"
- Click **EXPORT PDF** — demonstrate window.print()

---

## Anticipated Panel Questions & Answers

**Q: "What happens if the drone feed drops?"**
> "The system detects stream loss and shows a FEED LOST — ATTEMPTING RECONNECT
> overlay. Previously detected incidents remain on the map and all coordination
> continues unaffected. In a real deployment, the system would attempt automatic
> reconnection to the RTSP source. We also saw this as an opportunity to
> demonstrate graceful degradation — the AI layer is decoupled from the
> coordination layer."

**Q: "How accurate is your victim detection model?"**
> "Our custom YOLOv8n model, trained on the SARD and WiSARD search-and-rescue
> datasets, achieved mAP@0.5 of [X] on the held-out test split. We applied
> transfer learning from pretrained ImageNet weights which significantly reduced
> training time on our free-tier Colab GPU while maintaining acceptable accuracy
> for our capstone scope."

**Q: "Is this a digital twin?"**
> "No. A digital twin requires continuous real-time bidirectional synchronization
> between a physical asset and a virtual model. RescueEye processes drone video
> frames for object detection and command coordination — it does not maintain a
> synchronized virtual representation of any physical system. We deliberately
> kept this distinction clear in our Chapter 1 scope."

**Q: "What are the system's limitations?"**
> "Our documented limitations are: we use a simulated MP4 feed rather than live
> RTSP, inference runs on CPU which caps throughput to about 1 frame per second,
> and victim coordinates are approximated from the drone's known GPS position
> rather than computed via photogrammetry. These are all addressed in our
> Chapter 5 scope and limitations section, along with concrete recommendations
> for future work."

**Q: "Can this scale to multiple drones?"**
> "The architecture supports it. FastAPI can handle multiple concurrent stream
> endpoints, each with its own detection loop. The Coordination Panel already
> manages multiple teams and incidents simultaneously. Multi-drone support —
> including automatic zone assignment — is the primary recommendation in our
> future work section."

**Q: "Why Node.js and FastAPI — why not just one backend?"**
> "We separated concerns deliberately. FastAPI is purpose-built for high-throughput
> ML inference — it handles the YOLOv8 model lifecycle, MJPEG streaming, and
> per-frame processing efficiently. Node.js handles the coordination logic,
> Firebase Admin SDK integration, and real-time messaging — things that benefit
> from its event-loop architecture. The separation also means either layer can
> be scaled or replaced independently."

---

## Emergency Fallbacks

| Problem | Response |
|---------|----------|
| Video stream fails | "We anticipated this — we have a screen recording of the live system." Play `/docs/demo_backup.mp4` |
| Firebase offline | "Firebase has occasional cold-start delays. Core AI detection is fully independent of the database layer and continues running." |
| Model inference errors | "The system falls back to pretrained COCO weights automatically. Detection continues with general object classes." |
| Browser crashes | Re-open `http://localhost:5173` — session is persisted in sessionStorage |
| Projector resolution issue | Switch to 1280×720 — Tailwind breakpoints are set at min-width 1280px |
