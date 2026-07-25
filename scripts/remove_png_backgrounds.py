"""
Remove white backgrounds from UI asset PNGs and add alpha channel.

Usage:
    python scripts/remove_png_backgrounds.py

Reads PNGs from yungang_ui_asset_pack/assets/, writes transparent versions
to frontend/static/ui-assets/, and keeps *_orig.png backups.
"""

from __future__ import annotations

import os
import shutil
from collections import deque
from pathlib import Path

from PIL import Image

SRC_DIR = Path("yungang_ui_asset_pack/assets")
DST_DIR = Path("frontend/static/ui-assets")
TOLERANCE = 30


def is_light(r: int, g: int, b: int, threshold: int = 245) -> bool:
    return r >= threshold and g >= threshold and b >= threshold


def flood_fill_background(img: Image.Image, tolerance: int = 30) -> list[list[bool]]:
    w, h = img.size
    pixels = img.load()
    visited = [[False] * h for _ in range(w)]
    bg = [[False] * h for _ in range(w)]
    queue: deque[tuple[int, int]] = deque()

    threshold = 255 - tolerance
    for x in range(w):
        for y in (0, h - 1):
            if not visited[x][y] and is_light(*pixels[x, y][:3], threshold):
                visited[x][y] = True
                bg[x][y] = True
                queue.append((x, y))
    for y in range(1, h - 1):
        for x in (0, w - 1):
            if not visited[x][y] and is_light(*pixels[x, y][:3], threshold):
                visited[x][y] = True
                bg[x][y] = True
                queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not visited[nx][ny]:
                r, g, b = pixels[nx, ny][:3]
                if is_light(r, g, b, threshold):
                    visited[nx][ny] = True
                    bg[nx][ny] = True
                    queue.append((nx, ny))

    return bg


def process_image(src_path: Path, dst_path: Path, tolerance: int = TOLERANCE) -> None:
    img = Image.open(src_path).convert("RGBA")
    w, h = img.size
    bg = flood_fill_background(img, tolerance)
    pixels = img.load()

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if bg[x][y] or (r > 250 and g > 250 and b > 250):
                pixels[x, y] = (r, g, b, 0)

    dst_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst_path)


def main() -> None:
    if DST_DIR.exists():
        shutil.rmtree(DST_DIR)
    DST_DIR.mkdir(parents=True)

    for src_path in sorted(SRC_DIR.glob("*.png")):
        if src_path.name.endswith("_orig.png"):
            continue
        dst_path = DST_DIR / src_path.name
        process_image(src_path, dst_path)
        print(f"Processed {src_path.name} -> {dst_path}")


if __name__ == "__main__":
    main()
