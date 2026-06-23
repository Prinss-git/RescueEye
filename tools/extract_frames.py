"""
Extract frames from drone footage for casualty detection dataset building.

Usage:
    python extract_frames.py --video path/to/video.mp4 --out data/raw_frames --every 15
    python extract_frames.py --video path/to/video.mp4 --out data/raw_frames --every 8 --start 30 --end 120

Arguments:
    --video   : input video file
    --out     : output directory for extracted frames
    --every   : extract 1 frame every N frames (default 15 = ~2 frames/sec at 30fps)
    --start   : start time in seconds (optional)
    --end     : end time in seconds (optional)
    --prefix  : filename prefix (default: frame)
"""
import argparse
import os
import cv2
from pathlib import Path


def extract(video_path: str, out_dir: str, every: int = 15,
            start_sec: float = 0, end_sec: float = None, prefix: str = "frame"):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[ERROR] Cannot open: {video_path}")
        return

    fps        = cap.get(cv2.CAP_PROP_FPS) or 30
    total      = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    start_f    = int(start_sec * fps)
    end_f      = int(end_sec * fps) if end_sec else total

    Path(out_dir).mkdir(parents=True, exist_ok=True)

    cap.set(cv2.CAP_PROP_POS_FRAMES, start_f)
    frame_idx  = start_f
    saved      = 0

    print(f"[INFO] {video_path}  fps={fps:.1f}  frames={total}  "
          f"range=[{start_f}:{end_f}]  every={every}")

    while frame_idx < end_f:
        ret, frame = cap.read()
        if not ret:
            break
        if (frame_idx - start_f) % every == 0:
            name = f"{prefix}_{frame_idx:06d}.jpg"
            cv2.imwrite(str(Path(out_dir) / name), frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
            saved += 1
        frame_idx += 1

    cap.release()
    print(f"[DONE] Saved {saved} frames → {out_dir}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--video",  required=True)
    ap.add_argument("--out",    default="raw_frames")
    ap.add_argument("--every",  type=int,   default=15)
    ap.add_argument("--start",  type=float, default=0)
    ap.add_argument("--end",    type=float, default=None)
    ap.add_argument("--prefix", default="frame")
    args = ap.parse_args()

    extract(args.video, args.out, args.every, args.start, args.end, args.prefix)
