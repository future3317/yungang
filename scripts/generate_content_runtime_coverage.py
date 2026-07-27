"""Generate a conservative content-to-runtime coverage table.

This intentionally reports explicit runtime entry points rather than claiming
that every data effect is semantically complete. Review the generated table
when adding a new content type or effect.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = ROOT / "docs/engineering/CONTENT_RUNTIME_COVERAGE.md"

FILES = {
    "events.json": ("backend.engine._reveal_event / _settle_event", "SiteInspector / ChoiceDialog"),
    "action_cards.json": ("backend.engine._use_action_card", "CommandDock / ChoiceDialog"),
    "role_upgrades.json": ("backend.engine._upgrade_effect / trigger checks", "RoleUpgradeDialog"),
    "projects.json": ("backend.engine._advance_project", "ProjectState / SiteInspector"),
    "tasks.json": ("backend.engine._task_complete", "SiteInspector / HandTray"),
    "culture_cards.json": ("backend.engine._explore / _contribute / _effect", "Market / HandTray"),
}

rows = ["# 内容运行时覆盖", "", "此表由 `scripts/generate_content_runtime_coverage.py` 生成。它列出入口，不替代语义测试。", "", "| 文件 | ID 数量 | 后端处理器 | UI 入口 | 测试状态 |", "| --- | ---: | --- | --- | --- |"]
for filename, (handler, ui) in FILES.items():
    payload = json.loads((DATA / filename).read_text(encoding="utf-8"))
    if isinstance(payload, list):
        count = len(payload)
    else:
        key = next((name for name in payload if isinstance(payload[name], list)), None)
        count = len(payload.get(key, [])) if key else 0
    rows.append(f"| `{filename}` | {count} | `{handler}` | {ui} | 需要参数化覆盖 |")
OUT.write_text("\n".join(rows) + "\n", encoding="utf-8")
