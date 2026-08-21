from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1] / "frontend" / "src"
FORBIDDEN = (
    re.compile(r"\bUse Action Card\b", re.I),
    re.compile(r"\bRoute:\s*", re.I),
    re.compile(r"\bProject:\s*", re.I),
    re.compile(r"（目标：(?:project_|route_)", re.I),
)


def main() -> int:
    failures: list[str] = []
    for path in ROOT.rglob("*"):
        if path.suffix not in {".ts", ".tsx"} or path.name in {"gameUi.ts", "generated.ts", "inspectorFormatters.ts", "HeritageNetwork.tsx"} or path.name.endswith(".test.ts") or path.name.endswith(".test.tsx"):
            continue
        text = path.read_text(encoding="utf-8")
        for pattern in FORBIDDEN:
            if pattern.search(text):
                failures.append(f"{path.relative_to(ROOT)}: {pattern.pattern}")
    if failures:
        print("玩家界面出现废弃或内部英文：")
        print("\n".join(failures))
        return 1
    print("玩家界面废弃术语扫描通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
