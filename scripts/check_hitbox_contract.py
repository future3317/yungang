from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1] / "frontend" / "src"
SMALL_HITBOX = re.compile(r"min-height\s*:\s*(?:3[0-9]|4[0-3])px")


def main() -> int:
    failures: list[str] = []
    for path in ROOT.rglob("*.css"):
        text = path.read_text(encoding="utf-8")
        for match in SMALL_HITBOX.finditer(text):
            line = text.count("\n", 0, match.start()) + 1
            failures.append(f"{path.relative_to(ROOT)}:{line}: interactive min-height must be at least 44px")
    if failures:
        print("Hitbox contract violations:")
        print("\n".join(failures))
        return 1
    print("Hitbox contract passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
