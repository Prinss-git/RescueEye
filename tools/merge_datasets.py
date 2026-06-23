"""
Merge multiple YOLO-format datasets into one unified casualty dataset.

Handles both Roboflow structures:
  Structure A (Roboflow default):
    dataset/train/images/  dataset/train/labels/
    dataset/valid/images/  dataset/valid/labels/
    dataset/test/images/   dataset/test/labels/

  Structure B (alternative):
    dataset/images/train/  dataset/labels/train/
    dataset/images/val/    dataset/labels/val/

Usage:
    python merge_datasets.py \
        --sources dataset_A dataset_B dataset_C \
        --out merged_casualty \
        --split 80 10 10
"""
import argparse
import shutil
import random
from pathlib import Path


PERSON_KEYWORDS = (
    "person", "human", "people", "victim", "casualty",
    "fallen", "fall", "lying",
)

# Classes that look like casualties but aren't — explicitly excluded
EXCLUDE_KEYWORDS = (
    "standing", "stand", "sitting", "sit", "walking", "walk",
    "running", "run",
)


def load_class_names(yaml_path: Path) -> list:
    lines = yaml_path.read_text(encoding="utf-8", errors="ignore").splitlines()
    names, in_names = [], False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("names"):
            in_names = True
            # inline list: names: [a, b, c]
            if "[" in stripped:
                inner = stripped.split("[", 1)[1].split("]")[0]
                names = [n.strip().strip("'\"") for n in inner.split(",")]
                in_names = False
            continue
        if in_names:
            if stripped.startswith("-"):
                names.append(stripped.lstrip("- ").strip().strip("'\""))
            elif stripped and not stripped.startswith(" "):
                in_names = False
    return names


def person_class_ids(yaml_path: Path | None) -> set:
    if yaml_path is None or not yaml_path.exists():
        return {0}
    names = load_class_names(yaml_path)
    ids = {
        i for i, n in enumerate(names)
        if any(kw in n.lower() for kw in PERSON_KEYWORDS)
        and not any(ex in n.lower() for ex in EXCLUDE_KEYWORDS)
    }
    return ids or {0}


def find_pairs(root: Path) -> list:
    """Return list of (image_path, label_path) from any Roboflow structure."""
    pairs = []
    # Try both layout variants
    candidates = [
        # Roboflow default: split/images/ + split/labels/
        *[(root / sp / "images", root / sp / "labels")
          for sp in ("train", "valid", "val", "test")],
        # Alternative: images/split/ + labels/split/
        *[(root / "images" / sp, root / "labels" / sp)
          for sp in ("train", "valid", "val", "test")],
        # Flat
        (root / "images", root / "labels"),
    ]
    for img_dir, lbl_dir in candidates:
        if not img_dir.exists():
            continue
        for img in img_dir.iterdir():
            if img.suffix.lower() not in (".jpg", ".jpeg", ".png"):
                continue
            lbl = lbl_dir / (img.stem + ".txt")
            if lbl.exists():
                pairs.append((img, lbl))
    return pairs


def remap_label(src: Path, dst: Path, keep_ids: set) -> bool:
    lines_out = []
    for line in src.read_text(encoding="utf-8", errors="ignore").strip().splitlines():
        parts = line.split()
        if not parts:
            continue
        try:
            cls = int(parts[0])
        except ValueError:
            continue
        # Skip segmentation labels (more than 5 values = polygon, not bbox)
        if len(parts) != 5:
            continue
        if cls in keep_ids:
            lines_out.append("0 " + " ".join(parts[1:]))
    if lines_out:
        dst.write_text("\n".join(lines_out) + "\n", encoding="utf-8")
        return True
    return False


def merge(sources: list, out_dir: str, split: tuple):
    out = Path(out_dir)
    for sp in ("train", "val", "test"):
        (out / "images" / sp).mkdir(parents=True, exist_ok=True)
        (out / "labels" / sp).mkdir(parents=True, exist_ok=True)

    total = 0

    for src_idx, src_path in enumerate(sources):
        src      = Path(src_path)
        yaml_f   = next(src.glob("*.yaml"), None) or next(src.glob("data.yaml"), None)
        keep_ids = person_class_ids(yaml_f)
        names    = load_class_names(yaml_f) if yaml_f else []
        print(f"[{src_idx}] {src.name}  keep_ids={keep_ids}  classes={names[:6]}")

        all_pairs = find_pairs(src)
        if not all_pairs:
            print(f"  WARNING: no image/label pairs found — skipping")
            continue

        random.shuffle(all_pairs)
        n         = len(all_pairs)
        train_end = int(n * split[0] / 100)
        val_end   = train_end + int(n * split[1] / 100)
        buckets   = {
            "train": all_pairs[:train_end],
            "val":   all_pairs[train_end:val_end],
            "test":  all_pairs[val_end:],
        }

        saved = 0
        for sp, pairs in buckets.items():
            for img_path, lbl_path in pairs:
                stem    = f"s{src_idx}_{img_path.stem}"
                dst_img = out / "images" / sp / (stem + img_path.suffix)
                dst_lbl = out / "labels" / sp / (stem + ".txt")
                shutil.copy2(img_path, dst_img)
                if remap_label(lbl_path, dst_lbl, keep_ids):
                    saved += 1
                else:
                    dst_img.unlink(missing_ok=True)

        print(f"  saved {saved}/{n} images")
        total += saved

    (out / "data.yaml").write_text(
        f"path: {out.resolve().as_posix()}\n"
        f"train: images/train\n"
        f"val:   images/val\n"
        f"test:  images/test\n"
        f"nc: 1\n"
        f"names:\n"
        f"  - casualty\n",
        encoding="utf-8",
    )

    print()
    for sp in ("train", "val", "test"):
        count = len(list((out / "images" / sp).iterdir()))
        print(f"  {sp:5s}: {count} images")
    print(f"\nTotal: {total} images saved to {out}")
    print(f"data.yaml ready at {out / 'data.yaml'}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--sources", nargs="+", required=True)
    ap.add_argument("--out",     default="merged_casualty")
    ap.add_argument("--split",   nargs=3, type=int, default=[80, 10, 10],
                    metavar=("TRAIN", "VAL", "TEST"))
    args = ap.parse_args()
    random.seed(42)
    merge(args.sources, args.out, tuple(args.split))
