"""
Train YOLO11s for casualty detection — maximum accuracy configuration.

Requirements:
    pip install ultralytics

Usage:
    python train_casualty.py --data path/to/merged_casualty/data.yaml

After training completes:
    1. Best weights: runs/detect/casualty_v1/weights/best.pt
    2. Export to ONNX: python train_casualty.py --export runs/detect/casualty_v1/weights/best.pt
    3. Copy the .onnx file to api/models/victim_best.onnx and restart the API
"""
import argparse
from pathlib import Path


TRAIN_CFG = dict(
    # ── Base model ─────────────────────────────────────────────────────────────
    model   = "yolo11s.pt",      # start from pretrained COCO weights
    imgsz   = 1280,              # same as production inference size
    batch   = 8,                 # reduce to 4 if VRAM <6 GB

    # ── Schedule ───────────────────────────────────────────────────────────────
    epochs  = 150,
    patience= 30,                # early stop if no improvement for 30 epochs
    warmup_epochs = 5,

    # ── Optimiser ──────────────────────────────────────────────────────────────
    optimizer  = "AdamW",
    lr0        = 0.001,
    lrf        = 0.01,           # final LR = lr0 × lrf
    momentum   = 0.937,
    weight_decay = 0.0005,

    # ── Augmentation (heavy — drone footage is scarce) ─────────────────────────
    degrees    = 45.0,           # rotate ±45° — aerial cameras rotate freely
    translate  = 0.1,
    scale      = 0.5,            # zoom 50% — simulates altitude variation
    shear      = 5.0,
    perspective= 0.0005,
    flipud     = 0.5,            # 50% vertical flip — drones see all orientations
    fliplr     = 0.5,
    mosaic     = 1.0,            # paste 4 images together — more scene diversity
    mixup      = 0.15,           # blend two images — improves edge cases
    copy_paste = 0.3,            # paste casualties into new backgrounds
    hsv_h      = 0.02,           # hue jitter
    hsv_s      = 0.7,            # saturation jitter — dawn/dusk/overcast
    hsv_v      = 0.4,            # brightness jitter — shadows, exposure

    # ── Loss weights ──────────────────────────────────────────────────────────
    box  = 7.5,
    cls  = 0.5,
    dfl  = 1.5,

    # ── Output ────────────────────────────────────────────────────────────────
    name    = "casualty_v1",
    project = "runs/detect",
    save    = True,
    save_period = 10,            # checkpoint every 10 epochs
    plots   = True,
    verbose = True,
    workers = 4,
    seed    = 42,
    deterministic = True,
)


def train(data_yaml: str):
    from ultralytics import YOLO
    model = YOLO(TRAIN_CFG["model"])
    cfg = {k: v for k, v in TRAIN_CFG.items() if k != "model"}
    cfg["data"] = data_yaml
    results = model.train(**cfg)
    print("\n[DONE] Training complete.")
    print(f"  Best weights: {results.save_dir}/weights/best.pt")
    print(f"  mAP@0.5:      {results.results_dict.get('metrics/mAP50(B)', 'n/a'):.4f}")
    print(f"  mAP@0.5:0.95: {results.results_dict.get('metrics/mAP50-95(B)', 'n/a'):.4f}")
    best_pt = Path(results.save_dir) / "weights" / "best.pt"
    print(f"\nTo export: python train_casualty.py --export {best_pt}")
    return results


def export_onnx(weights: str):
    from ultralytics import YOLO
    model = YOLO(weights)
    path = model.export(format="onnx", imgsz=1280, opset=13, simplify=True, dynamic=False)
    print(f"\n[DONE] ONNX exported: {path}")
    print("  → Copy to api/models/victim_best.onnx and restart the API")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data",   help="Path to data.yaml for training")
    ap.add_argument("--export", help="Path to best.pt to export as ONNX")
    args = ap.parse_args()

    if args.export:
        export_onnx(args.export)
    elif args.data:
        train(args.data)
    else:
        ap.print_help()
