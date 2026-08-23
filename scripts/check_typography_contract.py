from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1] / "frontend" / "src"
MIN_REM = 0.8125
FONT_SIZE = re.compile(r"font-size\s*:\s*([0-9.]+)(rem|px)")
FONT_SHORTHAND = re.compile(r"(?<!-)\bfont\s*:\s*[^;{}]*?([0-9.]+)(rem|px)")


def main() -> int:
    failures: list[str] = []
    for path in ROOT.rglob("*.css"):
        if path.name in {"tokens.css", "map.css"}:
            continue
        text = path.read_text(encoding="utf-8")
        for match in [*FONT_SIZE.finditer(text), *FONT_SHORTHAND.finditer(text)]:
            value = float(match.group(1))
            unit = match.group(2)
            too_small = value < (MIN_REM if unit == "rem" else 13)
            if too_small:
                line = text.count("\n", 0, match.start()) + 1
                failures.append(f"{path.relative_to(ROOT)}:{line}: visible text smaller than 13px")
    if failures:
        print("Typography contract violations:")
        print("\n".join(failures))
        return 1
    print("Typography contract passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
