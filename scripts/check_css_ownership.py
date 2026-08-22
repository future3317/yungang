from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1] / "frontend" / "src" / "styles"
OWNERS = {"game-shell", "hud-layout", "hud-slot-left", "hud-slot-right", "hud-slot-world"}
FORBIDDEN = re.compile(r"(?:grid-area|grid-template|position|top|right|bottom|left)\s*:")
IMPORTANT = re.compile(r"!important\b")
MAP_SELECTORS = re.compile(r"\.(?:network-atmosphere|route-layer|map-node|region-layer|region-shape|player-marker)(?:\b|[-:])")
PAGE_GEOMETRY_SELECTORS = re.compile(r"\.(?:game-shell|game-header|stage-column|network-frame|hud-layout|hud-slot-(?:left|right|world))(?:\b|[-:])")


def main() -> int:
    failures = []
    for path in ROOT.glob("*.css"):
        if path.name == "hud-contract.css":
            continue
        text = path.read_text(encoding="utf-8")
        if path.name != "map.css":
            for match in re.finditer(r"([^{}]+)\{", text):
                selector = match.group(1)
                if MAP_SELECTORS.search(selector):
                    line_no = text.count("\n", 0, match.start()) + 1
                    failures.append(f"{path.relative_to(ROOT)}:{line_no}: map visual selector must be owned by map.css: {selector.strip()}")
        if path.name not in {"hud-contract.css", "map.css"}:
            for match in re.finditer(r"([^{}]+)\{([^{}]*)\}", text):
                selector, body = match.groups()
                if FORBIDDEN.search(body) and PAGE_GEOMETRY_SELECTORS.search(selector):
                    line_no = text.count("\n", 0, match.start()) + 1
                    failures.append(f"{path.relative_to(ROOT)}:{line_no}: page geometry must be owned by hud-contract.css: {selector.strip()}")
        if IMPORTANT.search(text):
            line_no = text.count("\n", 0, IMPORTANT.search(text).start()) + 1
            failures.append(f"{path.relative_to(ROOT)}:{line_no}: !important is not allowed; fix layer ownership instead")
        for match in re.finditer(r"([^{}]+)\{([^{}]*)\}", text):
            selector, body = match.groups()
            if FORBIDDEN.search(body) and any(re.search(rf"\.{name}(?:\b|[-:])", selector) for name in OWNERS):
                line_no = text.count("\n", 0, match.start()) + 1
                failures.append(f"{path.relative_to(ROOT)}:{line_no}: {selector.strip()}")
    if failures:
        print("HUD geometry must be owned by hud-contract.css:")
        print("\n".join(failures))
        return 1
    print("CSS ownership check passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
