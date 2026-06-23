"""
Evaluate a trained casualty detection model and generate a visual report.

Usage:
    python evaluate_model.py --model api/models/victim_best.pt --data data.yaml
    python evaluate_model.py --model api/models/victim_best.pt --data data.yaml --conf 0.25

Outputs:
    - eval_report/confusion_matrix.png
    - eval_report/PR_curve.png
    - eval_report/val_predictions/  ← visual boxes on every val image
    - eval_report/summary.txt
"""
import argparse
from pathlib import Path


def evaluate(model_path: str, data_yaml: str, conf: float = 0.25, iou: float = 0.50):
    from ultralytics import YOLO
    model   = YOLO(model_path)
    metrics = model.val(
        data    = data_yaml,
        conf    = conf,
        iou     = iou,
        imgsz   = 1280,
        batch   = 4,
        save    = True,
        save_txt= True,
        save_conf=True,
        plots   = True,
        name    = "eval_report",
        project = ".",
        verbose = True,
    )

    m = metrics.results_dict
    summary = (
        f"Model:        {model_path}\n"
        f"Data:         {data_yaml}\n"
        f"Conf thresh:  {conf}\n"
        f"IoU thresh:   {iou}\n"
        f"\n"
        f"Precision:    {m.get('metrics/precision(B)', 0):.4f}\n"
        f"Recall:       {m.get('metrics/recall(B)', 0):.4f}\n"
        f"F1:           {2 * m.get('metrics/precision(B)', 0) * m.get('metrics/recall(B)', 0) / max(m.get('metrics/precision(B)', 0) + m.get('metrics/recall(B)', 0), 1e-6):.4f}\n"
        f"mAP@0.5:      {m.get('metrics/mAP50(B)', 0):.4f}\n"
        f"mAP@0.5:0.95: {m.get('metrics/mAP50-95(B)', 0):.4f}\n"
    )
    print(summary)
    Path("eval_report/summary.txt").write_text(summary)
    print("[DONE] Report saved to eval_report/")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--data",  required=True)
    ap.add_argument("--conf",  type=float, default=0.25)
    ap.add_argument("--iou",   type=float, default=0.50)
    args = ap.parse_args()
    evaluate(args.model, args.data, args.conf, args.iou)
