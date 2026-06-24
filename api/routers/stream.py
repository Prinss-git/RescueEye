"""
Drone feed — MJPEG multipart stream (Feed 3 only).
FFmpeg stores native-resolution frames; the MJPEG generator
downscales to 640×480 for the browser. The WebSocket detection
pipeline reads the full-res buffer directly.
"""
import io
import logging
import math
import os
import shutil
import subprocess
import time
from pathlib import Path
from threading import Event, Lock, Thread

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from fastapi import APIRouter, Body, File, HTTPException, UploadFile
from fastapi.responses import Response, StreamingResponse

logger = logging.getLogger("rescueeye.stream")
router = APIRouter()

UPLOAD_DIR = Path(__file__).parent.parent / "data" / "uploads"
ALLOWED_VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".ts", ".webm", ".m4v"}

# ── Frame buffer ──────────────────────────────────────────────────────────────
_lock3           = Lock()
_current_frame3: bytes | None = None
_stream_active3  = False
_stream_source3  = "none"
_active_source3  = ""          # current URL/path being played
_ffmpeg_proc3: subprocess.Popen | None = None
_stop_event3     = Event()


def _encode_pil(img: Image.Image, quality: int = 75) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    return buf.getvalue()


def _downscale_jpeg(jpeg: bytes, w: int = 1280, h: int = 720) -> bytes:
    buf = io.BytesIO()
    Image.open(io.BytesIO(jpeg)).resize((w, h), Image.BILINEAR).save(buf, format="JPEG", quality=78)
    return buf.getvalue()


# ── Synthetic fallback frame ──────────────────────────────────────────────────
def _synthetic_frame(tick: int, width: int = 1280, height: int = 720) -> bytes:
    img_array = np.zeros((height, width, 3), dtype=np.uint8)
    for x in range(0, width, 40):
        img_array[:, x] = [0, 25, 35]
    for y in range(0, height, 40):
        img_array[y, :] = [0, 25, 35]
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
    ts = time.strftime("%H:%M:%S")
    draw.text((8, 8),              f"SIM FEED  {ts}",                    fill=(0, 212, 255))
    draw.text((8, height - 20),    "NO SOURCE FILE — SYNTHETIC MODE",    fill=(255, 80, 80))
    draw.text((width - 120, 8),    "640x480",                            fill=(100, 130, 150))
    scan_y = int((tick * 3) % height)
    draw.line([(0, scan_y), (width, scan_y)], fill=(0, 212, 255, 40), width=1)
    return _encode_pil(img, quality=70)


# ── FFmpeg producer ───────────────────────────────────────────────────────────
def _is_network_source(source: str) -> bool:
    return source.startswith(("rtsp://", "rtsps://", "rtmp://", "udp://", "http://", "https://"))


def _build_ffmpeg_cmd(source: str, fps: float) -> list[str]:
    """Build FFmpeg command with source-appropriate flags."""
    cmd = ["ffmpeg", "-loglevel", "error"]
    if source.startswith(("rtsp://", "rtsps://")):
        cmd += ["-rtsp_transport", "tcp", "-timeout", "5000000"]
    if not _is_network_source(source):
        cmd += ["-re"]          # pace file playback; omit for live network sources
    cmd += ["-i", source, "-vf", f"fps={fps}", "-f", "image2pipe",
            "-vcodec", "mjpeg", "-q:v", "3", "pipe:1"]
    return cmd


def _ffmpeg_reader3(path: str, fps: float):
    global _current_frame3, _stream_active3, _stream_source3, _ffmpeg_proc3
    cmd = _build_ffmpeg_cmd(path, fps)
    logger.info(f"[stream3] FFmpeg cmd: {' '.join(cmd)}")
    _stream_source3 = "ffmpeg"
    _stream_active3 = True
    try:
        while not _stop_event3.is_set():
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=0)
            _ffmpeg_proc3 = proc
            buf = b""
            while not _stop_event3.is_set():
                chunk = proc.stdout.read(65536)
                if not chunk:
                    break
                buf += chunk
                while True:
                    s = buf.find(b"\xff\xd8"); e = buf.find(b"\xff\xd9", s + 2)
                    if s == -1 or e == -1:
                        break
                    with _lock3:
                        _current_frame3 = buf[s:e + 2]
                    buf = buf[e + 2:]
            proc.wait()
            if _stop_event3.is_set():
                break
            logger.info("[stream3] FFmpeg finished — restarting for loop")
            time.sleep(0.5)
    except FileNotFoundError:
        logger.warning("[stream3] FFmpeg not found — falling back to synthetic")
    except Exception as exc:
        logger.error(f"[stream3] error: {exc}")
    finally:
        _stream_active3 = False
        _stream_source3 = "synthetic"
        _ffmpeg_proc3 = None


def _synthetic_producer3(fps: float):
    global _current_frame3, _stream_active3, _stream_source3
    _stream_active3 = True
    _stream_source3 = "synthetic"
    tick = 0
    interval = 1.0 / fps
    while not _stop_event3.is_set():
        frame = _synthetic_frame(tick)
        with _lock3:
            _current_frame3 = frame
        tick += 1
        time.sleep(interval)
    _stream_active3 = False


def _start_producer3(source: str = ""):
    global _stream_active3, _active_source3
    if _stream_active3:
        return
    _stop_event3.clear()
    if not source:
        source = os.getenv("DRONE_FEED_PATH_3", "")
    fps = float(os.getenv("FRAME_RATE", "8"))
    _active_source3 = source
    if source and (_is_network_source(source) or os.path.isfile(source)):
        logger.info(f"[stream3] Starting FFmpeg producer — {source} @ {fps} fps")
        Thread(target=_ffmpeg_reader3, args=(source, fps), daemon=True).start()
    else:
        if source:
            logger.warning(f"[stream3] Source '{source}' not found — synthetic mode")
        Thread(target=_synthetic_producer3, args=(fps,), daemon=True).start()


def switch_source(source: str) -> None:
    """Stop the current producer and start a new one with the given source."""
    global _stream_active3, _active_source3
    logger.info(f"[stream3] Switching source → {source or '(synthetic)'}")
    _stop_event3.set()
    proc = _ffmpeg_proc3
    if proc:
        proc.terminate()
    _stream_active3 = False
    time.sleep(0.8)
    _start_producer3(source)


# ── Lifecycle ─────────────────────────────────────────────────────────────────
def startup():
    _start_producer3()


def shutdown():
    _stop_event3.set()
    if _ffmpeg_proc3:
        _ffmpeg_proc3.terminate()


# ── MJPEG generator (downscales to 640×480 for browser) ──────────────────────
def _mjpeg_generator3():
    boundary = b"--rescueeye_frame3\r\n"
    while True:
        with _lock3:
            frame = _current_frame3
        if frame is None:
            time.sleep(0.05)
            continue
        try:
            display = _downscale_jpeg(frame)
        except Exception:
            display = frame
        yield (boundary
               + b"Content-Type: image/jpeg\r\n"
               + b"Content-Length: " + str(len(display)).encode() + b"\r\n\r\n"
               + display + b"\r\n")
        time.sleep(1.0 / max(float(os.getenv("FRAME_RATE", "5")), 0.1))


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.get("/feed3")
async def stream_feed3():
    return StreamingResponse(_mjpeg_generator3(),
        media_type="multipart/x-mixed-replace; boundary=rescueeye_frame3",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/source")
async def set_stream_source(payload: dict = Body(...)):
    source = (payload.get("source") or "").strip()
    switch_source(source)
    return {"ok": True, "source": source or "synthetic"}


@router.post("/upload")
async def upload_drone_feed(file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_VIDEO_EXTS:
        raise HTTPException(422, f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_VIDEO_EXTS)}")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = Path(file.filename).name
    dest = UPLOAD_DIR / safe_name
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    logger.info(f"[stream3] Uploaded feed: {dest} ({dest.stat().st_size // 1024} KB)")
    switch_source(str(dest))
    return {"ok": True, "filename": safe_name, "path": str(dest)}


@router.get("/status")
async def stream_status():
    return {
        "active":        _stream_active3,
        "fps":           float(os.getenv("FRAME_RATE", "8")),
        "source":        _stream_source3,
        "active_source": _active_source3,
        "has_frame":     _current_frame3 is not None,
    }


@router.get("/snapshot")
async def stream_snapshot():
    with _lock3:
        frame = _current_frame3
    if frame is None:
        return Response(status_code=503, content="No frame available yet")
    try:
        return Response(content=_downscale_jpeg(frame), media_type="image/jpeg")
    except Exception:
        return Response(content=frame, media_type="image/jpeg")

