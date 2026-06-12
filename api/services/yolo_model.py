"""
RescueEye — dual-model singleton service.

Manages two YOLOv8 models independently:
  _victim_model   — detection (person localisation)
  _damage_model   — classification (flood/fire/structural/no_damage)

Priority order for each:
  1. Custom-trained weights (VICTIM_MODEL_PATH / DAMAGE_MODEL_PATH env vars)
  2. Generic COCO pretrained fallback (MODEL_PATH / yolov8n.pt)

Hot-swap is supported: call reload_victim() / reload_damage() to swap weights
at runtime without restarting the server (used by /models/reload endpoint).
"""
from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger("rescueeye.yolo")

# ── COCO class constants (used by detect.py when victim model is COCO) ────────
PERSON_CLASS = 0
DAMAGE_PROXY_CLASSES: dict[int, str] = {
    72: "fire_damage",
    8:  "flood_damage",
    7:  "flood_damage",
    2:  "structural_damage",
    5:  "structural_damage",
    56: "structural_damage",
}

# ── Damage classification labels (custom model) ───────────────────────────────
DAMAGE_CLASS_NAMES = ["flood_damage", "fire_damage", "structural_damage", "no_damage"]


@dataclass
class ModelState:
    model:        Any   = None
    weights:      str   = ""
    version:      str   = "none"
    loaded_at:    str   = ""
    is_custom:    bool  = False
    map50:        float = 0.0
    accuracy:     float = 0.0
    meta:         dict  = field(default_factory=dict)


_victim = ModelState()
_damage = ModelState()

# ── Paths ─────────────────────────────────────────────────────────────────────
REPO_ROOT  = Path(__file__).parent.parent
MODELS_DIR = REPO_ROOT / "models"


def _load_meta(meta_file: Path) -> dict:
    try:
        return json.loads(meta_file.read_text())
    except Exception:
        return {}


def _load_single(weights_path: str, task: str) -> tuple[Any, bool]:
    """
    Load a YOLO model; returns (model, success).
    task: 'detect' or 'classify'
    """
    try:
        from ultralytics import YOLO  # type: ignore
        m = YOLO(weights_path)
        dummy = np.zeros((480, 640, 3), dtype="uint8")
        m(dummy, verbose=False)
        return m, True
    except Exception as exc:
        logger.warning(f"[yolo] Failed to load {weights_path}: {exc}")
        return None, False


def _resolve_victim_weights() -> tuple[str, bool]:
    """Return (weights_path, is_custom). Prefers ONNX over PT for faster CPU inference."""
    onnx = MODELS_DIR / "victim_best.onnx"
    if onnx.exists():
        return str(onnx), True
    custom = os.getenv("VICTIM_MODEL_PATH", str(MODELS_DIR / "victim_best.pt"))
    if Path(custom).exists():
        return custom, True
    fallback = os.getenv("MODEL_PATH", "yolov8n.pt")
    return fallback, False


def _resolve_damage_weights() -> tuple[str, bool]:
    custom = os.getenv("DAMAGE_MODEL_PATH", str(MODELS_DIR / "damage_best.pt"))
    if Path(custom).exists():
        return custom, True
    return "yolov8n-cls.pt", False


def _init_model(state: ModelState, weights: str, is_custom: bool,
                meta_file: Path | None = None, task: str = "detect") -> None:
    logger.info(f"[yolo] Loading {'custom' if is_custom else 'pretrained'} {task} model: {weights}")
    t0 = time.perf_counter()
    model, ok = _load_single(weights, task)
    elapsed = (time.perf_counter() - t0) * 1000

    state.model     = model
    state.weights   = weights
    state.is_custom = is_custom
    state.loaded_at = datetime.now(timezone.utc).isoformat()
    state.version   = "custom_v1" if is_custom else "pretrained_coco"

    if model is not None:
        logger.info(f"[yolo] {task} model ready in {elapsed:.0f}ms — {state.version}")
    else:
        logger.warning(f"[yolo] {task} model failed to load — stub mode")
        state.version = "stub"

    if meta_file and meta_file.exists():
        meta = _load_meta(meta_file)
        state.meta     = meta
        state.map50    = meta.get("map50", 0.0)
        state.accuracy = meta.get("accuracy_top1", 0.0)


# ── Public API ────────────────────────────────────────────────────────────────

def load_all() -> None:
    """Called once from FastAPI lifespan. Loads both models."""
    v_weights, v_custom = _resolve_victim_weights()
    _init_model(_victim, v_weights, v_custom,
                meta_file=MODELS_DIR / "victim_meta.json", task="detect")

    d_weights, d_custom = _resolve_damage_weights()
    _init_model(_damage, d_weights, d_custom,
                meta_file=MODELS_DIR / "damage_meta.json", task="classify")


def get_victim_model() -> Any:
    return _victim.model


def get_damage_model() -> Any:
    return _damage.model


def victim_state() -> ModelState:
    return _victim


def damage_state() -> ModelState:
    return _damage


def reload_victim() -> dict:
    """Hot-swap victim model weights (no server restart needed)."""
    weights, is_custom = _resolve_victim_weights()
    _init_model(_victim, weights, is_custom,
                meta_file=MODELS_DIR / "victim_meta.json", task="detect")
    return model_status()


def reload_damage() -> dict:
    """Hot-swap damage model weights."""
    weights, is_custom = _resolve_damage_weights()
    _init_model(_damage, weights, is_custom,
                meta_file=MODELS_DIR / "damage_meta.json", task="classify")
    return model_status()


def model_status() -> dict:
    """Serialisable status dict — returned by GET /models/status."""
    def _state_dict(s: ModelState, kind: str) -> dict:
        d: dict = {
            "version":     s.version,
            "weights":     s.weights,
            "loaded":      s.model is not None,
            "is_custom":   s.is_custom,
            "loaded_at":   s.loaded_at,
        }
        if kind == "victim" and s.map50:
            d["map50"] = s.map50
        if kind == "damage" and s.accuracy:
            d["accuracy"] = s.accuracy
        return d

    return {
        "victim_model": _state_dict(_victim, "victim"),
        "damage_model": _state_dict(_damage, "damage"),
    }


def model_info() -> dict:
    """Legacy compat — used by /health."""
    return {
        "victim": {"loaded": _victim.model is not None, "version": _victim.version},
        "damage": {"loaded": _damage.model is not None, "version": _damage.version},
    }
