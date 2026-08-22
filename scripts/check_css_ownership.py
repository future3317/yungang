from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1] / "frontend" / "src" / "styles"
OWNERS = {"game-shell", "hud-layout", "hud-slot-left", "hud-slot-right", "hud-slot-world"}
FORBIDDEN = re.compile(r"(?:grid-area|grid-template|position|top|right|bottom|left)\s*:")
IMPORTANT = re.compile(r"!important\b")


def main() -> int:
    failures = []
    for path in ROOT.glob("*.css"):
        if path.name == "hud-contract.css":
            continue
        text = path.read_text(encoding="utf-8")
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
