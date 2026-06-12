# RescueEye — Model Training Guide

RescueEye uses two custom YOLOv8 models:
1. **Victim Detection** — YOLOv8n (object detection) trained on search-and-rescue datasets
2. **Damage Classification** — YOLOv8n-cls (image classification) trained on disaster imagery

Training is designed to run on Google Colab (free T4 GPU). Local CPU training works but takes hours.

---

## Step 1 — Prepare the Dataset

From the repo root, run the dataset preparation script:

```powershell
cd api
$env:PYTHONIOENCODING="utf-8"
python scripts/prepare_dataset.py
```

This script:
- Downloads placeholder datasets (VisDrone, AIDER) or generates synthetic images if downloads fail
- Converts annotations to YOLO format
- Splits data into train/val/test (70/20/10)
- Writes `api/data/victim.yaml` and `api/data/damage.yaml`

**Expected output:**
```
[OK] Victim dataset: 500+ images
[OK] Damage dataset: 2400+ images (600+ per class)
[OK] Written: api/data/victim.yaml
[OK] Written: api/data/damage.yaml
```

---

## Step 2 — Train on Google Colab (Recommended)

1. Open `notebooks/train_rescueeye.ipynb` in Google Colab
2. Set runtime to **GPU (T4)**
3. Run all cells in order:
   - Cell 1: Mount Google Drive
   - Cell 2: Install Ultralytics
   - Cell 3: Download VisDrone dataset
   - Cell 4: Download AIDER / FloodNet
   - Cell 5: Prepare datasets (calls prepare_dataset.py)
   - Cell 6: Train victim detection (~15 min on T4)
   - Cell 7: Train damage classification (~10 min on T4)
   - Cell 8: Evaluate both models
   - Cell 9: Save weights to Google Drive

**Expected training time:**
| Hardware | Victim (50 epochs) | Damage (50 epochs) |
|----------|-------------------|-------------------|
| Colab T4 | ~15 min | ~10 min |
| CPU only | ~4–8 hours | ~2–4 hours |

---

## Step 3 — Train Locally (Optional)

```powershell
cd api
$env:PYTHONIOENCODING="utf-8"

# Train both models
python scripts/train_models.py --epochs 50 --batch 16

# Or individually
python scripts/train_models.py --victim-only --epochs 50
python scripts/train_models.py --damage-only --epochs 50

# CPU-optimized (smaller batch, no workers)
python scripts/train_models.py --batch 4 --workers 0
```

---

## Step 4 — Copy Weights

After training, copy the best weights to `api/models/`:

```bash
# From Colab: download from Google Drive, then:
cp victim_best.pt api/models/victim_best.pt
cp damage_best.pt api/models/damage_best.pt
```

Or set environment variables to point to custom paths:

```bash
VICTIM_MODEL_PATH=/path/to/victim_best.pt
DAMAGE_MODEL_PATH=/path/to/damage_best.pt
```

---

## Step 5 — Verify Model Loaded

Start FastAPI and check the models endpoint:

```bash
cd api && uvicorn main:app
curl http://localhost:8000/models/status
```

Expected response:
```json
{
  "victim_model": { "version": "custom_v1", "is_custom": true, "loaded": true },
  "damage_model": { "version": "custom_v1", "is_custom": true, "loaded": true }
}
```

The Dashboard model pills will show green `custom_v1` instead of yellow `COCO`.

---

## Step 6 — Run Evaluation

```powershell
cd api
$env:PYTHONIOENCODING="utf-8"
python scripts/evaluate_models.py
```

Output: `api/models/evaluation_report.json` — viewable on the Evaluation Report screen.

**Target metrics (Capstone Objectives 2 & 3):**
- Victim mAP@0.5 ≥ **0.70**
- Damage Top-1 accuracy ≥ **0.75**
- Combined inference latency < **3000ms** (Objective 6)

---

## Hot-Swapping Models

Models can be reloaded without restarting FastAPI:

```bash
# Reload both
curl -X POST http://localhost:8000/models/reload

# Reload individually
curl -X POST http://localhost:8000/models/reload/victim
curl -X POST http://localhost:8000/models/reload/damage
```

This is useful after copying new weights mid-session.
