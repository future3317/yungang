"""Ensure player-facing action errors have a Chinese catalog entry."""

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCES = (ROOT / "backend" / "engine.py", ROOT / "backend" / "rooms.py", ROOT / "backend" / "repository.py")
ERROR_PATTERN = re.compile(r'raise ValueError\("([a-z][a-z0-9_]+)"\)')
INTERNAL_PREFIXES = ("content_", "unsupported_content_mechanism")


def main() -> int:
    catalog = json.loads((ROOT / "data" / "terminology.json").read_text(encoding="utf-8"))["errors"]
    codes = {code for path in SOURCES for code in ERROR_PATTERN.findall(path.read_text(encoding="utf-8")) if not code.startswith(INTERNAL_PREFIXES)}
    missing = sorted(code for code in codes if code not in catalog)
    if missing:
        print("Missing terminology.errors entries:")
        print("\n".join(missing))
        return 1
    print(f"error catalog covers {len(codes)} player-facing codes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
