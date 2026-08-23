from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1] / "frontend" / "src"
import re

DECLARATION = re.compile(r"(?P<property>font-size|(?<!-)font)\s*:\s*(?P<value>[^;{}]+)")
SEMANTIC_TOKEN = re.compile(r"var\(--(?:(?:type|map-type)-[a-z0-9-]+|editor-map-label)\)")
SPACING_WITH_TYPE = re.compile(r"(?:padding|margin|gap|(?:min-|max-)?(?:width|height)|inline-size|block-size)\s*:\s*[^;{}]*var\(--type-[a-z0-9-]+\)")


def main() -> int:
    failures: list[str] = []
    for path in ROOT.rglob("*.css"):
        if path.name == "tokens.css":
            continue
        text = path.read_text(encoding="utf-8")
        for match in DECLARATION.finditer(text):
            value = match.group("value").strip()
            if value in {"inherit", "initial", "unset", "revert"} or SEMANTIC_TOKEN.search(value):
                continue
            line = text.count("\n", 0, match.start()) + 1
            failures.append(
                f"{path.relative_to(ROOT)}:{line}: {match.group('property')} must use a semantic typography token"
            )
        for match in SPACING_WITH_TYPE.finditer(text):
            line = text.count("\n", 0, match.start()) + 1
            failures.append(f"{path.relative_to(ROOT)}:{line}: typography tokens cannot be used for spacing or geometry")
    if failures:
        print("Typography contract violations:")
        print("\n".join(failures))
        return 1
    print("Typography contract passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
