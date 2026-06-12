"""
Simulated drone feed — MJPEG multipart stream.
Uses FFmpeg (subprocess) to loop a local MP4 at configurable FPS.
Falls back to a synthetic animated frame if FFmpeg or the source file
is unavailable, so the frontend always has something to display.
"""
import io
import logging
import math
import os
import subprocess
import time
from threading import Event, Lock, Thread

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from fastapi import APIRouter
from fastapi.responses import Response, StreamingResponse

logger = logging.getLogger("rescueeye.stream")
router = APIRouter()

# ──────────────────────────────────────────────────────────────────────────────
# Shared frame buffer — producer writes, MJPEG consumers read
# ──────────────────────────────────────────────────────────────────────────────
_lock = Lock()
_current_frame: bytes | None = None
_stream_active = False
_stream_source = "none"
_ffmpeg_proc: subprocess.Popen | None = None
_stop_event = Event()

# ── Second feed (feed2) ───────────────────────────────────────────────────────
_lock2 = Lock()
_current_frame2: bytes | None = None
_stream_active2 = False
_stream_source2 = "none"
_ffmpeg_proc2: subprocess.Popen | None = None
_stop_event2 = Event()

# ── Third feed (feed3) ────────────────────────────────────────────────────────
_lock3 = Lock()
_current_frame3: bytes | None = None
_stream_active3 = False
_ffmpeg_proc3: subprocess.Popen | None = None
_stop_event3 = Event()

# ── Fourth feed (feed4) ───────────────────────────────────────────────────────
_lock4 = Lock()
_current_frame4: bytes | None = None
_stream_active4 = False
_ffmpeg_proc4: subprocess.Popen | None = None
_stop_event4 = Event()


def _encode_pil(img: Image.Image, quality: int = 75) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    return buf.getvalue()


# ──────────────────────────────────────────────────────────────────────────────
# Synthetic frame generator (fallback when no MP4 / FFmpeg)
# ──────────────────────────────────────────────────────────────────────────────
def _synthetic_frame(tick: int, width: int = 640, height: int = 480) -> bytes:
    """Render an animated tactical-style placeholder frame."""
    img_array = np.zeros((height, width, 3), dtype=np.uint8)

    # Subtle grid
    for x in range(0, width, 40):
        img_array[:, x] = [0, 25, 35]
    for y in range(0, height, 40):
        img_array[y, :] = [0, 25, 35]

    # Pulsing center circle (simulates thermal blob)
    cx, cy = width // 2, height // 2
    radius = int(60 + 15 * math.sin(tick * 0.12))
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            if dx * dx + dy * dy <= radius * radius:
                px, py = cx + dx, cy + dy
                if 0 <= px < width and 0 <= py < height:
                    dist = math.sqrt(dx * dx + dy * dy)
                    intensity = int(180 * (1 - dist / radius))
                    img_array[py, px] = [0, intensity // 3, intensity]

    img = Image.fromarray(img_array, "RGB")
    draw = ImageDraw.Draw(img)

    # HUD overlay
    ts = time.strftime("%H:%M:%S")
    draw.text((8, 8), f"SIM FEED  {ts}", fill=(0, 212, 255))
    draw.text((8, height - 20), "NO SOURCE FILE — SYNTHETIC MODE", fill=(255, 80, 80))
    draw.text((width - 120, 8), "640x480", fill=(100, 130, 150))

    # Scan line
    scan_y = int((tick * 3) % height)
    draw.line([(0, scan_y), (width, scan_y)], fill=(0, 212, 255, 40), width=1)

    return _encode_pil(img, quality=70)


# ──────────────────────────────────────────────────────────────────────────────
# FFmpeg frame reader thread
# ──────────────────────────────────────────────────────────────────────────────
def _ffmpeg_reader(path: str, fps: float):
    global _current_frame, _stream_active, _stream_source, _ffmpeg_proc
    # Build command without -stream_loop (compatibility with older FFmpeg builds)
    cmd = [
        "ffmpeg",
        "-loglevel", "error",
        "-re",
        "-i", path,
        "-vf", f"fps={fps},scale=640:480",
        "-f", "image2pipe",
        "-vcodec", "mjpeg",
        "-q:v", "5",
        "pipe:1",
    ]
    logger.info(f"[stream] FFmpeg cmd: {' '.join(cmd)}")
    _stream_source = "ffmpeg"
    _stream_active = True
    try:
        while not _stop_event.is_set():
            proc = subprocess.Popen(
                cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=0
            )
            _ffmpeg_proc = proc
            buf = b""
            while not _stop_event.is_set():
                chunk = proc.stdout.read(65536)
                if not chunk:
                    break
                buf += chunk
                while True:
                    start = buf.find(b"\xff\xd8")
                    end   = buf.find(b"\xff\xd9", start + 2)
                    if start == -1 or end == -1:
                        break
                    frame_bytes = buf[start : end + 2]
                    with _lock:
                        _current_frame = frame_bytes
                    buf = buf[end + 2 :]
            proc.wait()
            if _stop_event.is_set():
                break
            # Video ended — brief pause then restart for loop behaviour
            logger.info("[stream] FFmpeg finished — restarting for loop")
            time.sleep(0.5)
    except FileNotFoundError:
        logger.warning("[stream] FFmpeg not found on PATH — falling back to synthetic frames")
    except Exception as exc:
        logger.error(f"[stream] FFmpeg error: {exc}")
    finally:
        _stream_active = False
        _stream_source = "synthetic"
        _ffmpeg_proc = None


def _synthetic_producer(fps: float):
    global _current_frame, _stream_active, _stream_source
    _stream_active = True
    _stream_source = "synthetic"
    tick = 0
    interval = 1.0 / fps
    while not _stop_event.is_set():
        frame = _synthetic_frame(tick)
        with _lock:
            _current_frame = frame
        tick += 1
        time.sleep(interval)
    _stream_active = False


def _start_producer():
    global _stream_active
    if _stream_active:
        return
    _stop_event.clear()
    path = os.getenv("DRONE_FEED_PATH", "")
    fps = float(os.getenv("FRAME_RATE", "1"))

    if path and os.path.isfile(path):
        logger.info(f"[stream] Starting FFmpeg producer — {path} @ {fps} fps")
        t = Thread(target=_ffmpeg_reader, args=(path, fps), daemon=True)
    else:
        if path:
            logger.warning(f"[stream] DRONE_FEED_PATH '{path}' not found — synthetic mode")
        else:
            logger.info("[stream] No DRONE_FEED_PATH set — synthetic mode")
        t = Thread(target=_synthetic_producer, args=(fps,), daemon=True)
    t.start()


# ──────────────────────────────────────────────────────────────────────────────
# Start producer on module import (called from main.py lifespan)
# ──────────────────────────────────────────────────────────────────────────────
def startup():
    _start_producer()
    _start_producer2()
    _start_producer3()
    _start_producer4()


def shutdown():
    for ev, proc in [
        (_stop_event,  _ffmpeg_proc),
        (_stop_event2, _ffmpeg_proc2),
        (_stop_event3, _ffmpeg_proc3),
        (_stop_event4, _ffmpeg_proc4),
    ]:
        ev.set()
        if proc:
            proc.terminate()


# ── Second feed producer ──────────────────────────────────────────────────────
def _ffmpeg_reader2(path: str, fps: float):
    global _current_frame2, _stream_active2, _stream_source2, _ffmpeg_proc2
    cmd = [
        "ffmpeg", "-loglevel", "error", "-re", "-i", path,
        "-vf", f"fps={fps},scale=640:480",
        "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "5", "pipe:1",
    ]
    logger.info(f"[stream2] FFmpeg cmd: {' '.join(cmd)}")
    _stream_source2 = "ffmpeg"
    _stream_active2 = True
    try:
        while not _stop_event2.is_set():
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=0)
            _ffmpeg_proc2 = proc
            buf = b""
            while not _stop_event2.is_set():
                chunk = proc.stdout.read(65536)
                if not chunk:
                    break
                buf += chunk
                while True:
                    start = buf.find(b"\xff\xd8")
                    end   = buf.find(b"\xff\xd9", start + 2)
                    if start == -1 or end == -1:
                        break
                    frame_bytes = buf[start:end + 2]
                    with _lock2:
                        _current_frame2 = frame_bytes
                    buf = buf[end + 2:]
            proc.wait()
            if _stop_event2.is_set():
                break
            logger.info("[stream2] FFmpeg finished — restarting for loop")
            time.sleep(0.5)
    except FileNotFoundError:
        logger.warning("[stream2] FFmpeg not found — no feed2")
    except Exception as exc:
        logger.error(f"[stream2] error: {exc}")
    finally:
        _stream_active2 = False
        _stream_source2 = "none"
        _ffmpeg_proc2 = None


def _start_producer2():
    global _stream_active2
    if _stream_active2:
        return
    _stop_event2.clear()
    path = os.getenv("DRONE_FEED_PATH_2", "")
    fps  = float(os.getenv("FRAME_RATE", "1"))
    if path and os.path.isfile(path):
        logger.info(f"[stream2] Starting FFmpeg producer — {path} @ {fps} fps")
        Thread(target=_ffmpeg_reader2, args=(path, fps), daemon=True).start()
    else:
        logger.warning(f"[stream2] DRONE_FEED_PATH_2 '{path}' not found — feed2 inactive")


# ──────────────────────────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────────────────────────
def _mjpeg_generator():
    """Yield MJPEG multipart frames as they arrive from the producer."""
    boundary = b"--rescueeye_frame\r\n"
    while True:
        with _lock:
            frame = _current_frame
        if frame is None:
            time.sleep(0.05)
            continue
        yield (
            boundary
            + b"Content-Type: image/jpeg\r\n"
            + b"Content-Length: " + str(len(frame)).encode() + b"\r\n\r\n"
            + frame
            + b"\r\n"
        )
        fps = float(os.getenv("FRAME_RATE", "1"))
        time.sleep(1.0 / max(fps, 0.1))


@router.get("/feed")
async def stream_feed():
    """MJPEG multipart stream of drone feed frames."""
    return StreamingResponse(
        _mjpeg_generator(),
        media_type="multipart/x-mixed-replace; boundary=rescueeye_frame",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/status")
async def stream_status():
    fps = float(os.getenv("FRAME_RATE", "1"))
    return {
        "active": _stream_active,
        "fps": fps,
        "source": _stream_source,
        "has_frame": _current_frame is not None,
    }


@router.get("/snapshot")
async def stream_snapshot():
    """Return the latest frame as a plain JPEG (used for testing)."""
    with _lock:
        frame = _current_frame
    if frame is None:
        return Response(status_code=503, content="No frame available yet")
    return Response(content=frame, media_type="image/jpeg")


def _mjpeg_generator2():
    boundary = b"--rescueeye_frame2\r\n"
    while True:
        with _lock2:
            frame = _current_frame2
        if frame is None:
            time.sleep(0.05)
            continue
        yield (
            boundary
            + b"Content-Type: image/jpeg\r\n"
            + b"Content-Length: " + str(len(frame)).encode() + b"\r\n\r\n"
            + frame
            + b"\r\n"
        )
        fps = float(os.getenv("FRAME_RATE", "1"))
        time.sleep(1.0 / max(fps, 0.1))


@router.get("/feed2")
async def stream_feed2():
    """MJPEG stream of secondary drone feed."""
    return StreamingResponse(
        _mjpeg_generator2(),
        media_type="multipart/x-mixed-replace; boundary=rescueeye_frame2",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/status2")
async def stream_status2():
    fps = float(os.getenv("FRAME_RATE", "1"))
    return {
        "active": _stream_active2,
        "fps":    fps,
        "source": _stream_source2,
        "has_frame": _current_frame2 is not None,
    }


# ── Feed 3 ────────────────────────────────────────────────────────────────────
def _ffmpeg_reader3(path: str, fps: float):
    global _current_frame3, _stream_active3, _ffmpeg_proc3
    cmd = ["ffmpeg", "-loglevel", "error", "-re", "-i", path,
           "-vf", f"fps={fps},scale=640:480", "-f", "image2pipe",
           "-vcodec", "mjpeg", "-q:v", "5", "pipe:1"]
    _stream_active3 = True
    try:
        while not _stop_event3.is_set():
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=0)
            _ffmpeg_proc3 = proc
            buf = b""
            while not _stop_event3.is_set():
                chunk = proc.stdout.read(65536)
                if not chunk: break
                buf += chunk
                while True:
                    s = buf.find(b"\xff\xd8"); e = buf.find(b"\xff\xd9", s + 2)
                    if s == -1 or e == -1: break
                    with _lock3: _current_frame3 = buf[s:e + 2]
                    buf = buf[e + 2:]
            proc.wait()
            if _stop_event3.is_set(): break
            time.sleep(0.5)
    finally:
        _stream_active3 = False; _ffmpeg_proc3 = None

def _start_producer3():
    global _stream_active3
    if _stream_active3: return
    _stop_event3.clear()
    path = os.getenv("DRONE_FEED_PATH_3", "")
    fps  = float(os.getenv("FRAME_RATE", "1"))
    if path and os.path.isfile(path):
        logger.info(f"[stream3] Starting — {path} @ {fps} fps")
        Thread(target=_ffmpeg_reader3, args=(path, fps), daemon=True).start()
    else:
        logger.warning(f"[stream3] DRONE_FEED_PATH_3 '{path}' not found")

def _mjpeg_generator3():
    boundary = b"--rescueeye_frame3\r\n"
    while True:
        with _lock3: frame = _current_frame3
        if frame is None: time.sleep(0.05); continue
        yield boundary + b"Content-Type: image/jpeg\r\nContent-Length: " + str(len(frame)).encode() + b"\r\n\r\n" + frame + b"\r\n"
        time.sleep(1.0 / max(float(os.getenv("FRAME_RATE", "1")), 0.1))

@router.get("/feed3")
async def stream_feed3():
    return StreamingResponse(_mjpeg_generator3(),
        media_type="multipart/x-mixed-replace; boundary=rescueeye_frame3",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ── Feed 4 ────────────────────────────────────────────────────────────────────
def _ffmpeg_reader4(path: str, fps: float):
    global _current_frame4, _stream_active4, _ffmpeg_proc4
    cmd = ["ffmpeg", "-loglevel", "error", "-re", "-i", path,
           "-vf", f"fps={fps},scale=640:480", "-f", "image2pipe",
           "-vcodec", "mjpeg", "-q:v", "5", "pipe:1"]
    _stream_active4 = True
    try:
        while not _stop_event4.is_set():
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=0)
            _ffmpeg_proc4 = proc
            buf = b""
            while not _stop_event4.is_set():
                chunk = proc.stdout.read(65536)
                if not chunk: break
                buf += chunk
                while True:
                    s = buf.find(b"\xff\xd8"); e = buf.find(b"\xff\xd9", s + 2)
                    if s == -1 or e == -1: break
                    with _lock4: _current_frame4 = buf[s:e + 2]
                    buf = buf[e + 2:]
            proc.wait()
            if _stop_event4.is_set(): break
            time.sleep(0.5)
    finally:
        _stream_active4 = False; _ffmpeg_proc4 = None

def _start_producer4():
    global _stream_active4
    if _stream_active4: return
    _stop_event4.clear()
    path = os.getenv("DRONE_FEED_PATH_4", "")
    fps  = float(os.getenv("FRAME_RATE", "1"))
    if path and os.path.isfile(path):
        logger.info(f"[stream4] Starting — {path} @ {fps} fps")
        Thread(target=_ffmpeg_reader4, args=(path, fps), daemon=True).start()
    else:
        logger.warning(f"[stream4] DRONE_FEED_PATH_4 '{path}' not found")

def _mjpeg_generator4():
    boundary = b"--rescueeye_frame4\r\n"
    while True:
        with _lock4: frame = _current_frame4
        if frame is None: time.sleep(0.05); continue
        yield boundary + b"Content-Type: image/jpeg\r\nContent-Length: " + str(len(frame)).encode() + b"\r\n\r\n" + frame + b"\r\n"
        time.sleep(1.0 / max(float(os.getenv("FRAME_RATE", "1")), 0.1))

@router.get("/feed4")
async def stream_feed4():
    return StreamingResponse(_mjpeg_generator4(),
        media_type="multipart/x-mixed-replace; boundary=rescueeye_frame4",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
