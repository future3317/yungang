from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1] / "frontend" / "src"
FORBIDDEN = (
    re.compile(r">\s*Use Action Card", re.I),
    re.compile(r">\s*Route:\s*", re.I),
    re.compile(r">\s*Project:\s*", re.I),
    re.compile(r"（目标：(?:project_|route_)", re.I),
    re.compile(r">\s*(?:target_rule|effect\.type|weathering_track|threat_delta|use_action_card)\s*<", re.I),
    re.compile(r"目标\s*[:：]\s*(?:project_|route_|player-seat-)", re.I),
)


def main() -> int:
    failures: list[str] = []
    for path in ROOT.rglob("*"):
        if path.suffix not in {".ts", ".tsx"} or path.name == "generated.ts" or path.name.endswith(".test.ts") or path.name.endswith(".test.tsx"):
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
