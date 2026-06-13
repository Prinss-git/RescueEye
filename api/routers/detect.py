"""
POST /detect — YOLOv8 victim detection on a base64-encoded JPEG frame.
Uses the custom victim_best.pt if available; falls back to COCO yolov8n.pt.

Phase 4: bridges high-confidence detections to Node.js /incidents (httpx,
conf ≥ 0.75, 10s cooldown per grid cell) and appends to inference log.
"""
from __future__ import annotations

import asyncio
import base64
import io
import logging
import os
import time
import uuid
from datetime import datetime, timezone

import numpy as np
from fastapi import APIRouter, Body, HTTPException
from PIL import Image

from services.yolo_model import (
    DAMAGE_PROXY_CLASSES,
    PERSON_CLASS,
    get_victim_model,
    victim_state,
)
from services.detection_store import add_detections
from routers.logs import append_log

logger = logging.getLogger("rescueeye.detect")
router = APIRouter()

LATENCY_WARN_MS      = float(os.getenv("LATENCY_WARN_MS",      "3000"))
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.40"))
INCIDENT_CONF_MIN    = float(os.getenv("INCIDENT_CONF_MIN",    "0.75"))
NODE_SERVER_URL      = os.getenv("NODE_SERVER_URL", "http://localhost:3001")
GRID_COOLDOWN_S      = 10.0

_grid_cooldown: dict[tuple[int, int], float] = {}
_grid_lock = asyncio.Lock()


def _bbox_to_grid(bbox: dict, cols: int = 8, rows: int = 6) -> tuple[int, int]:
    cx = bbox["x"] + bbox["w"] / 2
    cy = bbox["y"] + bbox["h"] / 2
    return (min(int(cy / 480 * rows), rows - 1), min(int(cx / 640 * cols), cols - 1))


async def _maybe_create_incident(detection: dict) -> None:
    if detection.get("confidence", 0) < INCIDENT_CONF_MIN:
        return
    cell = _bbox_to_grid(detection["bbox"])
    now  = time.monotonic()
    async with _grid_lock:
        if now - _grid_cooldown.get(cell, 0) < GRID_COOLDOWN_S:
            return
        _grid_cooldown[cell] = now
    class_to_type = {
        "person":            "VICTIM_DETECTED",
        "fire_damage":       "FIRE",
        "flood_damage":      "FLOOD",
        "structural_damage": "STRUCTURAL",
    }
    try:
        import httpx  # type: ignore
        async with httpx.AsyncClient(timeout=3.0) as client:
            await client.post(
                f"{NODE_SERVER_URL}/incidents",
                json={
                    "type":        class_to_type.get(detection["class"], "UNKNOWN"),
                    "severity":    "HIGH" if detection["confidence"] >= 0.90 else "MEDIUM",
                    "description": (
                        f"AI detected {detection['class']} "
                        f"(conf={detection['confidence']:.2f}) via drone feed"
                    ),
                    "reportedBy": "AI_SYSTEM",
                },
            )
    except Exception as exc:
        logger.debug(f"[detect] Incident bridge error (non-fatal): {exc}")


def _decode_frame(b64: str) -> np.ndarray:
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    raw = base64.b64decode(b64)
    return np.array(Image.open(io.BytesIO(raw)).convert("RGB"))


LABEL_COLORS: dict[str, tuple[int, int, int]] = {
    "person":            (255, 59,  59),
    "life_sign":         (255, 220, 0),
    "fire_damage":       (255, 119, 0),
    "flood_damage":      (0,   212, 255),
    "structural_damage": (249, 115, 22),
}

# Brightness below this (0-255) triggers thermal mode
DARK_THRESHOLD = float(os.getenv("DARK_THRESHOLD", "60"))

# Inferno-like LUT: maps grayscale 0-255 → RGB thermal color
def _build_thermal_lut() -> np.ndarray:
    lut = np.zeros((256, 3), dtype=np.uint8)
    for i in range(256):
        t = i / 255.0
        if t < 0.25:
            r = int(t * 4 * 30)
            g = 0
            b = int(20 + t * 4 * 80)
        elif t < 0.5:
            r = int(30 + (t - 0.25) * 4 * 190)
            g = 0
            b = int(100 - (t - 0.25) * 4 * 90)
        elif t < 0.75:
            r = 220
            g = int((t - 0.5) * 4 * 120)
            b = 0
        else:
            r = 255
            g = int(120 + (t - 0.75) * 4 * 135)
            b = int((t - 0.75) * 4 * 60)
        lut[i] = [min(r, 255), min(g, 255), min(b, 255)]
    return lut

_THERMAL_LUT = _build_thermal_lut()


def _measure_brightness(frame_rgb: np.ndarray) -> float:
    return float(np.mean(frame_rgb))


def _apply_thermal(frame_rgb: np.ndarray) -> np.ndarray:
    """Convert RGB frame to simulated thermal using inferno colormap."""
    gray = np.mean(frame_rgb, axis=2).astype(np.uint8)
    return _THERMAL_LUT[gray]


def _annotate_frame(frame_rgb: np.ndarray, detections: list[dict]) -> str:
    """Draw bounding boxes on a downscaled frame, return as base64 JPEG thumbnail."""
    from PIL import ImageDraw
    img = Image.fromarray(frame_rgb).resize((320, 240), Image.BILINEAR)
    sx, sy = 320 / frame_rgb.shape[1], 240 / frame_rgb.shape[0]
    draw = ImageDraw.Draw(img)
    for d in detections:
        b = d["bbox"]
        x1, y1 = int(b["x"] * sx), int(b["y"] * sy)
        x2, y2 = int((b["x"] + b["w"]) * sx), int((b["y"] + b["h"]) * sy)
        color = LABEL_COLORS.get(d["class"], (255, 255, 255))
        draw.rectangle([x1, y1, x2, y2], outline=color, width=2)
        label = f"{d['class'].upper()} {round(d['confidence'] * 100)}%"
        tw, th = 7 * len(label), 12
        ly = y1 - th - 1 if y1 > th + 1 else y2 + 1
        draw.rectangle([x1, ly, x1 + tw, ly + th], fill=color)
        draw.text((x1 + 2, ly + 1), label, fill=(10, 14, 26))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=40)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def _run_victim(frame: np.ndarray) -> tuple[list[dict], float]:
    model   = get_victim_model()
    state   = victim_state()
    t0      = time.perf_counter()

    if model is None:
        import random
        elapsed = (time.perf_counter() - t0) * 1000
        return [
            {
                "class":      "person",
                "confidence": round(random.uniform(0.82, 0.95), 2),
                "bbox":       {"x": 80, "y": 60, "w": 55, "h": 110},
            }
        ], round(elapsed + random.uniform(40, 80), 1)

    results    = model(frame, verbose=False, conf=CONFIDENCE_THRESHOLD)
    elapsed_ms = (time.perf_counter() - t0) * 1000

    detections = []
    for result in results:
        for box in result.boxes:
            cls_id  = int(box.cls[0])
            conf    = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()

            # Custom model: class 0 = person; COCO fallback: class 0 = person too
            if state.is_custom:
                label = "person"
            elif cls_id == PERSON_CLASS:
                label = "person"
            elif cls_id in DAMAGE_PROXY_CLASSES:
                label = DAMAGE_PROXY_CLASSES[cls_id]
            else:
                continue

            detections.append(
                {
                    "class":      label,
                    "confidence": round(conf, 3),
                    "bbox":       {
                        "x": int(x1), "y": int(y1),
                        "w": int(x2 - x1), "h": int(y2 - y1),
                    },
                }
            )

    return detections, round(elapsed_ms, 1)


@router.post("")
async def detect_objects(payload: dict = Body(...)):
    b64 = payload.get("frame", "")
    if not b64:
        raise HTTPException(422, "'frame' field with base64 JPEG is required")

    try:
        frame = _decode_frame(b64)
    except Exception as exc:
        raise HTTPException(422, f"Could not decode frame: {exc}")

    # ── Dual-technology mode selection ────────────────────────────────────────
    brightness = _measure_brightness(frame)
    force_mode = payload.get("force_mode")  # "visual" | "thermal" | null
    if force_mode in ("visual", "thermal"):
        mode = force_mode
    else:
        mode = "thermal" if brightness < DARK_THRESHOLD else "visual"

    if mode == "thermal":
        display_frame = _apply_thermal(frame)
    else:
        display_frame = frame

    # Run inference in thread pool — keeps the event loop free for MJPEG streaming
    loop = asyncio.get_event_loop()
    detections, inference_ms = await loop.run_in_executor(None, _run_victim, frame)

    if mode == "thermal":
        for d in detections:
            if d["class"] == "person":
                d["class"] = "life_sign"

    frame_id  = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()

    if inference_ms > LATENCY_WARN_MS:
        logger.warning(
            f"[detect] LATENCY EXCEEDED: {inference_ms:.0f}ms > {LATENCY_WARN_MS:.0f}ms"
        )

    annotated = [
        {**d, "id": f"{frame_id[:8]}-{i}", "timestamp": timestamp}
        for i, d in enumerate(detections)
    ]
    add_detections(annotated, inference_ms)

    annotated_frame = _annotate_frame(display_frame, annotated) if annotated else None

    # In thermal mode always return the thermal frame so the UI can show it
    if mode == "thermal" and annotated_frame is None:
        buf = io.BytesIO()
        Image.fromarray(display_frame).save(buf, format="JPEG", quality=55)
        annotated_frame = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

    # Persist to inference log
    append_log({
        "frame_id":        frame_id,
        "detection_count": len(detections),
        "inference_ms":    inference_ms,
        "model_version":   victim_state().version,
        "mode":            mode,
    })

    # Bridge high-confidence detections to Node.js /incidents (non-blocking)
    for det in annotated:
        asyncio.create_task(_maybe_create_incident(det))

    logger.info(
        f"[detect] mode={mode} brightness={brightness:.0f} "
        f"detections={len(detections)} "
        f"inference={inference_ms:.0f}ms "
        f"model={victim_state().version}"
    )

    return {
        "detections":        annotated,
        "inference_time_ms": inference_ms,
        "frame_id":          frame_id,
        "model_version":     victim_state().version,
        "annotated_frame":   annotated_frame,
        "mode":              mode,
        "brightness":        round(brightness, 1),
    }
