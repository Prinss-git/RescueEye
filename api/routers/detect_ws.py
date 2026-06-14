"""
WebSocket /detect/ws/3

Server reads frames directly from the FFmpeg buffer (native resolution),
runs YOLO in a thread pool, and pushes detection JSON to the browser.
"""
from __future__ import annotations

import asyncio
import io
import json
import logging
import time
import uuid
from datetime import datetime, timezone

import numpy as np
from fastapi import APIRouter
from fastapi.websockets import WebSocket, WebSocketDisconnect
from PIL import Image

from routers.detect import (
    _annotate_frame,
    _apply_thermal,
    _measure_brightness,
    _maybe_create_incident,
    _run_victim,
    DARK_THRESHOLD,
    LATENCY_WARN_MS,
)
from routers.logs import append_log
from services.detection_store import add_detections
from services.yolo_model import victim_state

logger = logging.getLogger("rescueeye.detect_ws")
router = APIRouter()

INFERENCE_INTERVAL = 2.0  # seconds between inference calls


def _get_frame() -> bytes | None:
    from routers.stream import _current_frame3, _lock3
    with _lock3:
        return _current_frame3


def _jpeg_to_array(jpeg: bytes) -> np.ndarray:
    return np.array(Image.open(io.BytesIO(jpeg)).convert("RGB"))


@router.websocket("/ws/3")
async def detect_ws(websocket: WebSocket):
    await websocket.accept()
    logger.info("[detect_ws] client connected — feed3")
    loop = asyncio.get_event_loop()
    last_hash: int | None = None

    try:
        while True:
            await asyncio.sleep(INFERENCE_INTERVAL)

            jpeg = _get_frame()
            if jpeg is None:
                continue

            frame_hash = hash(jpeg[:512])
            if frame_hash == last_hash:
                continue
            last_hash = frame_hash

            try:
                frame = await loop.run_in_executor(None, _jpeg_to_array, jpeg)
            except Exception:
                continue

            frame_h, frame_w = frame.shape[:2]
            brightness = _measure_brightness(frame)
            mode = "thermal" if brightness < DARK_THRESHOLD else "visual"
            display_frame = _apply_thermal(frame) if mode == "thermal" else frame

            try:
                detections, inference_ms = await loop.run_in_executor(None, _run_victim, frame)
            except Exception as exc:
                logger.error(f"[detect_ws] inference error: {exc}")
                continue

            if mode == "thermal":
                for d in detections:
                    if d["class"] == "person":
                        d["class"] = "life_sign"

            frame_id  = str(uuid.uuid4())
            timestamp = datetime.now(timezone.utc).isoformat()

            if inference_ms > LATENCY_WARN_MS:
                logger.warning(f"[detect_ws] latency {inference_ms:.0f}ms")

            annotated = [
                {**d, "id": f"{frame_id[:8]}-{i}", "timestamp": timestamp, "feed": "FEED 3"}
                for i, d in enumerate(detections)
            ]
            add_detections(annotated, inference_ms)

            annotated_frame = None
            if annotated:
                annotated_frame = await loop.run_in_executor(
                    None, _annotate_frame, display_frame, annotated
                )
            elif mode == "thermal":
                import base64
                buf = io.BytesIO()
                Image.fromarray(display_frame).save(buf, format="JPEG", quality=55)
                annotated_frame = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

            append_log({
                "frame_id":        frame_id,
                "detection_count": len(detections),
                "inference_ms":    inference_ms,
                "model_version":   victim_state().version,
                "mode":            mode,
                "feed":            3,
            })

            for det in annotated:
                asyncio.create_task(_maybe_create_incident(det))

            payload = {
                "detections":        annotated,
                "inference_time_ms": inference_ms,
                "frame_id":          frame_id,
                "model_version":     victim_state().version,
                "annotated_frame":   annotated_frame,
                "mode":              mode,
                "brightness":        round(brightness, 1),
                "feed_id":           3,
                "frame_w":           frame_w,
                "frame_h":           frame_h,
            }

            await websocket.send_text(json.dumps(payload))

    except WebSocketDisconnect:
        logger.info("[detect_ws] client disconnected — feed3")
    except Exception as exc:
        logger.error(f"[detect_ws] error: {exc}")
