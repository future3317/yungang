"""Detect and crop circular badges from the generated icon sheet."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


BADGE_ASSET_MAP = {
    "icon_action_contribute.png": 11,
    "icon_action_explore.png": 8,
    "icon_action_restore.png": 9,
    "icon_card_scroll.png": 14,
    "icon_event_night.png": 16,
    "icon_event_sandstorm.png": 12,
    "icon_event_threat.png": 13,
    "icon_node_auxiliary_temple.png": 4,
    "icon_node_huayan_temple.png": 2,
    "icon_node_pingcheng_ruins.png": 7,
    "icon_node_shanhua_temple.png": 3,
    "icon_node_trade_post.png": 6,
    "icon_node_wall_pass.png": 5,
    "icon_node_yungang.png": 1,
    "icon_resource_influence.png": 11,
    "icon_resource_restoration.png": 10,
    "icon_role_craftsman.png": 19,
    "icon_role_diplomat.png": 21,
    "icon_role_rider.png": 12,
    "icon_role_scribe.png": 20,
    "icon_task_statue.png": 1,
    "icon_task_trade.png": 6,
}


def detect_badges(image: np.ndarray) -> list[tuple[int, int, int]]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.medianBlur(gray, 5)
    circles = cv2.HoughCircles(
        gray,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=150,
        param1=120,
        param2=48,
        minRadius=72,
        maxRadius=105,
    )
    if circles is None:
        raise RuntimeError("No circular badges detected")
    detected = [tuple(int(round(value)) for value in circle) for circle in circles[0]]
    if len(detected) != 21:
        raise RuntimeError(f"Expected 21 badges, detected {len(detected)}: {detected}")
    detected.sort(key=lambda item: item[1])
    rows: list[list[tuple[int, int, int]]] = []
    for item in detected:
        row = next((candidate for candidate in rows if abs(item[1] - candidate[0][1]) < 80), None)
        if row is None:
            rows.append([item])
        else:
            row.append(item)
    if len(rows) != 3 or any(len(row) != 7 for row in rows):
        raise RuntimeError(f"Expected three rows of seven badges, got {[len(row) for row in rows]}")
    radius = int(round(float(np.median([item[2] for item in detected])))) + 2
    return [(x, y, radius) for row in sorted(rows, key=lambda group: np.mean([item[1] for item in group])) for x, y, _ in sorted(row, key=lambda item: item[0])]


def crop_badge(image: Image.Image, center: tuple[int, int, int]) -> Image.Image:
    x, y, radius = center
    size = radius * 2 + 8
    left = x - size // 2
    top = y - size // 2
    crop = image.crop((left, top, left + size, top + size)).convert("RGBA")
    alpha = Image.new("L", crop.size, 0)
    alpha_draw = cv2.circle(
        np.zeros((crop.height, crop.width), dtype=np.uint8),
        (crop.width // 2, crop.height // 2),
        radius - 2,
        255,
        -1,
        lineType=cv2.LINE_AA,
    )
    alpha = Image.fromarray(alpha_draw, mode="L")
    crop.putalpha(alpha)
    return crop


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--asset-root", type=Path)
    args = parser.parse_args()

    source_cv = cv2.imread(str(args.source), cv2.IMREAD_COLOR)
    if source_cv is None:
        raise FileNotFoundError(args.source)
    centers = detect_badges(source_cv)
    source = Image.open(args.source)
    args.output.mkdir(parents=True, exist_ok=True)
    for index, center in enumerate(centers, start=1):
        crop_badge(source, center).save(args.output / f"badge_{index:02d}.png")
    if args.asset_root:
        args.asset_root.mkdir(parents=True, exist_ok=True)
        for asset_name, index in BADGE_ASSET_MAP.items():
            shutil.copyfile(args.output / f"badge_{index:02d}.png", args.asset_root / asset_name)
    (args.output / "detected_centers.json").write_text(
        json.dumps(
            [
                {"index": index, "x": x, "y": y, "radius": radius}
                for index, (x, y, radius) in enumerate(centers, start=1)
            ],
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps(centers))


if __name__ == "__main__":
    main()
