"""Compress all WebP assets in-place while keeping one backup per file."""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STATIC_DIR = ROOT / "frontend" / "static" / "ui-assets"
BACKUP_DIR = ROOT / "assets-source" / "compressed-orig"
QUALITY = 40


def compress(path: Path) -> tuple[int, int]:
    backup = BACKUP_DIR / path.relative_to(STATIC_DIR)
    backup.parent.mkdir(parents=True, exist_ok=True)
    if not backup.exists():
        shutil.copy2(path, backup)

    img = Image.open(path)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGBA")
    else:
        img = img.convert("RGB")

    max_side = max(img.size)
    # Scene images can stay a bit larger; UI chrome/icons are capped at 256 px.
    if "generated/scene_" in str(path):
        max_dimension = 1024
    else:
        max_dimension = 256
    if max_side > max_dimension:
        ratio = max_dimension / max_side
        new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
        img = img.resize(new_size, Image.Resampling.LANCZOS)

    before = path.stat().st_size
    img.save(path, "webp", quality=QUALITY, method=6)
    after = path.stat().st_size
    return before, after


def main() -> int:
    targets = sorted(STATIC_DIR.rglob("*.webp"), key=lambda p: p.stat().st_size, reverse=True)
    if not targets:
        print("No WebP files found.")
        return 0

    total_before = 0
    total_after = 0
    for path in targets:
        before, after = compress(path)
        total_before += before
        total_after += after

    print(f"Total: {total_before / 1024 / 1024:.2f} MB -> {total_after / 1024 / 1024:.2f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
