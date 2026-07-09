# RescueEye — Evaluation Methodology

This document covers how to conduct the 20-participant drill evaluation (Capstone Objective 5) and interpret the results.

---

## Objective 5 Overview

**Goal:** Demonstrate that RescueEye improves coordination speed and situational awareness compared to manual methods during a simulated disaster drill.

**Participants:** 20 (minimum), representing roles in a real DRRM response:
- 4 × Incident Commanders
- 6 × Coordinators
- 6 × Drone Operators
- 4 × Observers (evaluators, do not interact with the system)

---

## Step 1 — Participant Accounts

Create accounts for all participants in Firebase Auth (or use demo mode).

**Demo accounts (seeded automatically on server startup):**
| Email | Password | Role |
|-------|----------|------|
| `sysadmin@rescueeye.ph`     | `admin12345` | system_admin |
| `agencyadmin@rescueeye.ph`  | `password123` | agency_admin |
| `commander@rescueeye.ph`    | `password123` | command_staff |
| `responder@rescueeye.ph`    | `password123` | field_responder (mobile app) |

For a full 20-participant evaluation, create accounts in Firebase Auth and set custom claims for each role. Then update `server/routes/auth.js` with participant emails.

---

## Step 2 — Drill Scenario Script

The incident commander runs the drill from the Coordination Panel.

**Pre-drill setup:**
```bash
node server/scripts/seed.js   # reset to clean state
```

**Drill scenario — Typhoon Odette Simulation:**

| Time | Event | Expected Action |
|------|-------|----------------|
| T+0:00 | Start drill (click START DRILL) | System begins auto-generating incidents |
| T+0:30 | Incident 1: VICTIM_DETECTED (CRITICAL) auto-generated | Commander assigns a team |
| T+1:00 | Incident 2: FLOOD (HIGH) auto-generated | Coordinator sends situation report |
| T+1:30 | AI detection: 0.89 confidence → auto-incident | Verify incident appears in panel |
| T+2:00 | Incident 3: FIRE (CRITICAL) auto-generated | Commander sends ALERT message |
| T+3:00 | Team 1 status → ON_SITE | Coordinator updates team status |
| T+4:00 | Resolve Incident 1 | Commander clicks RESOLVE |
| T+5:00 | End drill (click STOP DRILL) | |

---

## Step 3 — Metrics Being Measured

The evaluation report captures:

| Metric | Definition | Why It Matters |
|--------|-----------|----------------|
| `incidentCount` | Incidents generated/acknowledged during drill | Volume of simulated load |
| `teamActions` | Team assignments + status updates | Coordination responsiveness |
| `messageCount` | Inter-org messages sent | Communication throughput |
| `detectionCount` | AI-triggered incidents (conf ≥ 0.75) | AI pipeline integration |
| `avgResponseMs` | Mean time from incident creation to first team action | Speed of response |
| Victim mAP@0.5 | Object detection accuracy | Objective 2 |
| Damage Top-1 acc | Classification accuracy | Objective 3 |
| Combined inference | Total AI latency per frame | Objective 6 |

---

## Step 4 — Conducting the Evaluation

1. Divide participants into groups of ~5 per role
2. Brief all participants on the scenario (5 minutes)
3. Start all three services and verify the system is healthy (`/health` endpoints)
4. Have the incident commander run `node server/scripts/seed.js`
5. Begin drill — incident commander clicks **START DRILL**
6. Participants perform their roles using the system
7. Observers record qualitative notes (confusion points, navigation issues)
8. After 5 minutes, click **STOP DRILL**
9. Navigate to **Evaluation Report** — review metrics with participants

**Post-drill survey (qualitative):**
- "Was the incident list easy to understand?" (1–5)
- "Did you know which team was assigned to your incident?" (1–5)
- "Would you use this system in a real disaster response?" (Y/N + comment)

---

## Step 5 — Exporting the Report

1. Navigate to `/evaluation`
2. Click **EXPORT PDF** — browser print dialog opens
3. Select "Save as PDF"
4. Save to `docs/eval_report_[date].pdf`

The report includes all metrics from the drill session plus the AI model evaluation from `api/models/evaluation_report.json`.

---

## Step 6 — Interpreting Results

**Passing thresholds (from capstone objectives):**

| Metric | Target | Source |
|--------|--------|--------|
| Victim mAP@0.5 | ≥ 0.70 | Objective 2 |
| Damage Top-1 accuracy | ≥ 0.75 | Objective 3 |
| Combined AI latency | < 3000ms | Objective 6 |
| Drill response time | < 120s | Objective 5 (target) |

**Interpreting avgResponseMs:**
- < 30,000ms (30s): Excellent — team assigned within half a minute
- 30,000–120,000ms: Acceptable — within 2 minutes
- > 120,000ms: Needs improvement — UI friction or unclear workflow

If targets are not met, the evaluation report includes recommendations (see `api/scripts/evaluate_models.py`).
