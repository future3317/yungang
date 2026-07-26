from pathlib import Path
from typing import Iterable

import cv2
import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "static" / "ui-assets" / "generated"


SOURCES = {
    "nodes_normal": "ChatGPT Image 2026年7月26日 08_22_55 (4).png",
    "nodes_active": "ChatGPT Image 2026年7月26日 08_22_54 (2).png",
    "nodes_reachable": "ChatGPT Image 2026年7月26日 08_22_54 (3).png",
    "nodes_closed": "ChatGPT Image 2026年7月26日 08_22_55 (5).png",
    "routes_a": "ChatGPT Image 2026年7月26日 08_22_43 (4).png",
    "routes_b": "ChatGPT Image 2026年7月26日 08_22_44 (5).png",
    "effects": "ChatGPT Image 2026年7月26日 08_22_44 (6).png",
    "victory_ring": "ChatGPT Image 2026年7月26日 08_22_44 (7).png",
    "network_effects": "ChatGPT Image 2026年7月26日 08_22_44 (8).png",
    "state_rings": "ChatGPT Image 2026年7月26日 08_22_43 (2).png",
    "state_badges": "ChatGPT Image 2026年7月26日 08_22_43 (3).png",
    "badges": "ChatGPT Image 2026年7月26日 08_26_22 (3).png",
    "panel_a": "ChatGPT Image 2026年7月26日 08_26_21 (1).png",
    "panel_b": "ChatGPT Image 2026年7月26日 08_26_22 (2).png",
    "banner_set": "ChatGPT Image 2026年7月26日 08_26_22 (4).png",
    "card_set": "ChatGPT Image 2026年7月26日 08_26_23 (5).png",
    "badge_set": "ChatGPT Image 2026年7月26日 08_26_23 (6).png",
}


NODE_IDS = [
    "yungang",
    "huayan_temple",
    "shanhua_temple",
    "archive_depot",
    "pingcheng_ruins",
    "trade_post",
    "wall_pass",
    "border_market",
    "northern_workshop",
    "river_crossing",
    "motif_gallery",
    "river_archive",
    "watchtower",
    "material_yard",
    "carving_courtyard",
    "craft_school",
    "route_junction",
    "caravan_camp",
]


def source(key: str) -> Image.Image:
    path = ROOT / SOURCES[key]
    if not path.exists():
        raise FileNotFoundError(path)
    return Image.open(path).convert("RGBA")


def grid_crop(image: Image.Image, col: int, row: int, cols: int, rows: int) -> Image.Image:
    x0 = round(image.width * col / cols)
    y0 = round(image.height * row / rows)
    x1 = round(image.width * (col + 1) / cols)
    y1 = round(image.height * (row + 1) / rows)
    crop = image.crop((x0, y0, x1, y1))
    bbox = crop.getchannel("A").getbbox()
    if not bbox:
        return crop
    pad = 8
    left = max(0, bbox[0] - pad)
    top = max(0, bbox[1] - pad)
    right = min(crop.width, bbox[2] + pad)
    bottom = min(crop.height, bbox[3] + pad)
    return crop.crop((left, top, right, bottom))


def explicit_crop(image: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    crop = image.crop(box)
    bbox = crop.getchannel("A").getbbox()
    if not bbox:
        return crop
    pad = 8
    return crop.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(crop.width, bbox[2] + pad), min(crop.height, bbox[3] + pad)))


def component_boxes(image: Image.Image, expected: int) -> list[tuple[int, int, int, int]]:
    alpha = np.asarray(image.getchannel("A"))
    mask = (alpha > 24).astype(np.uint8)
    count, _, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    boxes = [tuple(int(value) for value in stat[:4]) for stat in stats[1:] if int(stat[4]) > 1000]
    if len(boxes) != expected:
        raise ValueError(f"expected {expected} components, found {len(boxes)}")
    boxes.sort(key=lambda box: (round(box[1] / 180), box[0]))
    return boxes


def crop_components(image: Image.Image, boxes: list[tuple[int, int, int, int]]) -> list[Image.Image]:
    crops = []
    for x, y, width, height in boxes:
        pad = 10
        crops.append(image.crop((max(0, x - pad), max(0, y - pad), min(image.width, x + width + pad), min(image.height, y + height + pad))))
    return crops


def save(crop: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    crop.save(path, "PNG", optimize=True)


def save_grid(key: str, names: Iterable[str], folder: str, cols: int, rows: int) -> None:
    image = source(key)
    for index, name in enumerate(names):
        row, col = divmod(index, cols)
        save(grid_crop(image, col, row, cols, rows), OUT / folder / f"{name}.png")


def main() -> None:
    node_boxes = component_boxes(source("nodes_normal"), len(NODE_IDS))
    for variant, key in (("normal", "nodes_normal"), ("active", "nodes_active"), ("reachable", "nodes_reachable"), ("closed", "nodes_closed")):
        for node_id, crop in zip(NODE_IDS, crop_components(source(key), node_boxes)):
            save(crop, OUT / "nodes" / "states" / f"{node_id}_{variant}.png")
    for node_id, crop in zip(NODE_IDS, crop_components(source("nodes_normal"), node_boxes)):
        save(crop, OUT / "nodes" / f"icon_node_{node_id}.png")

    save_grid("routes_a", ("route_base", "route_restored", "route_surveyed", "route_connected"), "routes", 1, 4)
    save_grid("routes_b", ("route_danger", "route_neutral", "route_active", "route_target"), "routes", 1, 4)

    save_grid("effects", ("effect_discovery_scroll", "effect_restore_lotus", "effect_complete_seal", "effect_event_cloud"), "effects", 2, 2)
    save_grid("network_effects", ("effect_network_complete", "effect_network_faded"), "effects", 2, 1)
    save_grid("victory_ring", ("effect_victory_ring",), "effects", 1, 1)
    save_grid("state_rings", ("ring_damaged", "ring_neutral", "ring_active"), "badges", 3, 1)
    save_grid("state_badges", ("badge_lotus", "badge_connection", "badge_warning"), "badges", 3, 1)
    save_grid("badges", ("badge_node_focus", "badge_task", "badge_warning_large", "badge_damaged", "badge_connection_large", "marker_reachable", "resource_restoration", "badge_repair"), "badges", 4, 2)

    save_grid("panel_a", ("panel_landscape", "panel_wide"), "panels", 1, 2)
    image = source("panel_b")
    for name, box in (
        ("panel_portrait", (90, 40, 690, 560)),
        ("panel_context", (820, 40, 1480, 560)),
        ("panel_long", (90, 590, 1480, 1005)),
    ):
        save(explicit_crop(image, box), OUT / "panels" / f"{name}.png")
    save_grid("banner_set", ("banner_top", "banner_scene", "banner_route", "banner_cloud", "banner_scroll", "banner_event"), "panels", 2, 3)

    image = source("card_set")
    card_boxes = (
        (70, 55, 365, 535), (370, 55, 675, 535), (690, 55, 1000, 535), (1025, 55, 1385, 535),
        (300, 545, 615, 985), (640, 545, 945, 985), (970, 545, 1260, 985), (1270, 545, 1510, 985),
    )
    for index, box in enumerate(card_boxes, start=1):
        save(explicit_crop(image, box), OUT / "cards" / f"card_frame_{index:02d}.png")
    save_grid("badge_set", ("badge_domain", "badge_achievement", "badge_restore", "badge_defeat"), "badges", 2, 2)

    print(f"generated assets in {OUT}")


if __name__ == "__main__":
    main()
