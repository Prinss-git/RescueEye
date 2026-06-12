# RescueEye — Pre-Defense Checklist

---

## 48 Hours Before Defense

### System Verification
- [ ] Run full seed script on clean state: `node server/scripts/seed.js`
- [ ] Verify both model weights load: `curl http://localhost:8000/models/status`
      (expect `"loaded": true` for both victim and damage models)
- [ ] Start all three services and navigate through all 5 screens — confirm no errors
- [ ] Verify drone feed stream is active (green LIVE ON badge on Dashboard)
- [ ] Verify model pills show correct version (green `custom_v1` or yellow `COCO`)
- [ ] Run a full drill cycle (start → wait 60s → stop → check evaluation report)
- [ ] Export evaluation report as PDF and save locally to `docs/eval_report_backup.pdf`

### Backup Preparation
- [ ] Record a screen recording of the full demo flow (5–8 minutes)
      Save as `docs/demo_backup.mp4`
- [ ] Save backup screenshots of all 5 screens to `docs/screenshots/`
- [ ] Print a copy of `docs/DEFENSE_DEMO.md` as physical backup

### Hardware
- [ ] Test on the **actual laptop** being used for defense
- [ ] Check projector resolution — verify UI looks correct at 1280×720 minimum
- [ ] Verify HDMI/USB-C adapter is working
- [ ] Charge laptop to 100% and bring power adapter

---

## Day of Defense

### Arrival (30 minutes early)
- [ ] Arrive and set up at the defense venue
- [ ] Connect laptop to projector — verify display
- [ ] Set laptop to **never sleep** (Power Settings)
- [ ] Disable all notifications (Focus Assist / Do Not Disturb)
- [ ] Close all non-essential applications and browser tabs

### System Startup
- [ ] Start Node.js server: `cd d:\RescueEye && node server/index.js`
- [ ] Start FastAPI: `cd d:\RescueEye\api && uvicorn main:app`
- [ ] Start frontend: `cd d:\RescueEye\frontend && npm run dev`
- [ ] Open browser to `http://localhost:5173`

### Pre-Demo Reset
- [ ] Run seed script to reset demo data: `node server/scripts/seed.js`
- [ ] Log in as `commander@rescueeye.ph` / `password123`
- [ ] Verify video stream is running (green LIVE ON badge)
- [ ] Click START DETECTION — confirm bounding boxes appear within 5 seconds
- [ ] Stop detection (clean state for demo start)
- [ ] Open second browser tab at `/evaluation` (for Step 5 of demo)
- [ ] Return first tab to `/login` — ready for demo

### Final Checks
- [ ] Have printed DEFENSE_DEMO.md on the table (physical backup)
- [ ] Have `docs/demo_backup.mp4` queued and ready in a media player
- [ ] Have `docs/eval_report_backup.pdf` open in a PDF viewer (minimized)
- [ ] Confirm all 3 terminals are visible or accessible quickly

---

## If Something Breaks During Defense

### Video stream fails
> "We anticipated this scenario. We have a screen recording of the live system
> running that we can show while we address the connection issue."

Action: Switch to `docs/demo_backup.mp4` in the media player.

---

### Firebase goes offline
> "Firebase occasionally has cold-start delays in the free tier. The core AI
> detection pipeline is fully independent of the database layer and continues
> to function. Coordination data is persisted in-memory and syncs when
> Firebase reconnects."

Action: Continue demo — all features work in in-memory mode.

---

### Model inference errors / models show OFFLINE
> "The system falls back to the pretrained COCO model automatically. Detection
> continues with general object classes rather than our fine-tuned model."

Action: Refresh the page — models reload on FastAPI startup.

---

### Browser crashes
Action: Re-open `http://localhost:5173` — session is stored in `sessionStorage` and restores automatically.

---

### Projector resolution issue (UI too large)
Action: Switch browser zoom to 80% (`Ctrl + -`). The Tailwind breakpoints support down to 1024px.

---

### Node.js server not responding
Action: Check terminal for error. Re-run `node server/index.js`. If port 3001 in use: `npx kill-port 3001 && node server/index.js`

---

## Post-Defense

- [ ] Export final evaluation report as PDF
- [ ] Archive all demo materials to `docs/`
- [ ] Commit final version to git: `git add . && git commit -m "Phase 5 complete — defense ready"`
- [ ] Tag the release: `git tag v1.0-capstone`
