"""
Download casualty/fallen-person datasets from Roboflow Universe.

Usage:
    python download_datasets.py --api-key YOUR_KEY
"""
import argparse
from pathlib import Path

# (workspace_slug, project_slug, version)  — verified from API search
DATASETS = [
    ("fallen-people-data-set",  "fallen-person-uhif8",         4),  # 2876 imgs, fallen person
    ("fallen-person-64goj",     "fallen-person-0gxti",         3),  # 487 imgs, fallen person
    ("aerial-person-detection", "aerial-person-detection",     4),  # 7015 imgs, aerial UAV
    ("lying-glihm",             "standing-lying",              5),  # 1659 imgs, lying vs standing
    ("project-avtuf",           "fallen-person-kxook",         2),  # 3306 imgs, fallen person
]


def download_all(api_key: str, out_dir: str):
    from roboflow import Roboflow
    rf  = Roboflow(api_key=api_key)
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    downloaded, failed = [], []

    for ws, proj, version in DATASETS:
        label = f"{ws}/{proj}"
        dst   = out / proj
        if dst.exists() and any(dst.iterdir()):
            print(f"[SKIP] Already downloaded: {proj}")
            downloaded.append(str(dst))
            continue

        print(f"\n[DOWNLOAD] {label} v{version} ...")
        try:
            project = rf.workspace(ws).project(proj)
            ver     = project.version(version)
            ver.download("yolov8", location=str(dst), overwrite=True)
            print(f"[OK] → {dst}")
            downloaded.append(str(dst))
        except Exception as exc:
            print(f"[FAIL] {label}: {exc}")
            # Try lower version numbers
            for v in range(version - 1, 0, -1):
                try:
                    print(f"  Trying v{v}...")
                    ver = project.version(v)
                    ver.download("yolov8", location=str(dst), overwrite=True)
                    print(f"[OK] v{v} → {dst}")
                    downloaded.append(str(dst))
                    break
                except Exception as e2:
                    print(f"  v{v} also failed: {e2}")
            else:
                failed.append(label)

    print("\n" + "="*60)
    print(f"Downloaded : {len(downloaded)}")
    print(f"Failed     : {len(failed)}")
    if failed:
        print(f"Failed     : {failed}")

    if downloaded:
        sources = " ".join(f'"{d}"' for d in downloaded)
        print(f"\nNext — merge datasets:")
        print(f"  python merge_datasets.py --sources {sources} --out merged_casualty")

    return downloaded


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--api-key", required=True)
    ap.add_argument("--out",     default="datasets")
    args = ap.parse_args()
    download_all(args.api_key, args.out)
