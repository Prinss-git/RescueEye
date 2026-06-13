"""
GET /detect/stream/{feed_id} — Server-Sent Events detection pipeline.

The API reads frames directly from its own FFmpeg buffers (no browser
round-trip), runs YOLO inference, and pushes JSON detection events to
the frontend. One SSE connection per feed.
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
from fastapi.responses import StreamingResponse
from PIL import Image

from routers.detect import (
    _annotate_frame,
    _apply_thermal,
    _measure_brightness,
    _maybe_create_incident,
    _run_victim,
    CONFIDENCE_THRESHOLD,
    DARK_THRESHOLD,
    LATENCY_WARN_MS,
)
from routers.logs import append_log
from services.detection_store import add_detections
from services.yolo_model import victim_state

logger = logging.getLogger("rescueeye.detect_sse")
router = APIRouter()

# How long to wait between inference calls per feed (seconds)
INFERENCE_INTERVAL = 1.5


def _get_frame_buffer(feed_id: int) -> bytes | None:
    """Read the latest JPEG bytes from the in-memory FFmpeg buffer."""
    from routers.stream import (
        _current_frame,  _lock,
        _current_frame2, _lock2,
        _current_frame3, _lock3,
        _current_frame4, _lock4,
    )
    if feed_id == 1:
        with _lock:  return _current_frame
    if feed_id == 2:
        with _lock2: return _current_frame2
    if feed_id == 3:
        with _lock3: return _current_frame3
    if feed_id == 4:
        with _lock4: return _current_frame4
    return None


def _jpeg_to_array(jpeg_bytes: bytes) -> np.ndarray:
    return np.array(Image.open(io.BytesIO(jpeg_bytes)).convert("RGB"))


async def _detection_generator(feed_id: int):
    """Async generator that yields SSE-formatted detection events."""
    label = f"FEED {feed_id}"
    last_frame_hash = None

    while True:
        await asyncio.sleep(INFERENCE_INTERVAL)

        jpeg = _get_frame_buffer(feed_id)
        if jpeg is None:
            continue

        # Skip if frame hasn't changed (static/stalled feed)
        frame_hash = hash(jpeg[:512])
        if frame_hash == last_frame_hash:
            continue
        last_frame_hash = frame_hash

        try:
            frame = await asyncio.get_event_loop().run_in_executor(
                None, _jpeg_to_array, jpeg
            )
        except Exception:
            continue

        brightness = _measure_brightness(frame)
        mode = "thermal" if brightness < DARK_THRESHOLD else "visual"

        if mode == "thermal":
            display_frame = _apply_thermal(frame)
        else:
            display_frame = frame

        try:
            detections, inference_ms = await asyncio.get_event_loop().run_in_executor(
                None, _run_victim, frame
            )
        except Exception as exc:
            logger.error(f"[detect_sse] feed{feed_id} inference error: {exc}")
            continue

        if mode == "thermal":
            for d in detections:
                if d["class"] == "person":
                    d["class"] = "life_sign"

        frame_id  = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()

        if inference_ms > LATENCY_WARN_MS:
            logger.warning(f"[detect_sse] feed{feed_id} latency {inference_ms:.0f}ms")

        annotated = [
            {**d, "id": f"{frame_id[:8]}-{i}", "timestamp": timestamp, "feed": label}
            for i, d in enumerate(detections)
        ]
        add_detections(annotated, inference_ms)

        annotated_frame = None
        if annotated:
            annotated_frame = await asyncio.get_event_loop().run_in_executor(
                None, _annotate_frame, display_frame, annotated
            )
        elif mode == "thermal":
            buf = io.BytesIO()
            Image.fromarray(display_frame).save(buf, format="JPEG", quality=55)
            import base64
            annotated_frame = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

        append_log({
            "frame_id":        frame_id,
            "detection_count": len(detections),
            "inference_ms":    inference_ms,
            "model_version":   victim_state().version,
            "mode":            mode,
            "feed":            feed_id,
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
            "feed_id":           feed_id,
        }

        yield f"data: {json.dumps(payload)}\n\n"


@router.get("/stream/{feed_id}")
async def detect_stream(feed_id: int):
    """SSE endpoint — streams detection results for a single feed."""
    if feed_id not in (1, 2, 3, 4):
        from fastapi import HTTPException
        raise HTTPException(400, "feed_id must be 1–4")

    async def generator():
        # Send a heartbeat immediately so the browser knows the connection is alive
        yield "data: {\"type\":\"connected\"}\n\n"
        async for event in _detection_generator(feed_id):
            yield event

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":   "no-cache",
            "X-Accel-Buffering": "no",
            "Connection":      "keep-alive",
        },
    )
