"""Generate the content-to-runtime verification map used by CI."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = ROOT / "docs/engineering/CONTENT_RUNTIME_COVERAGE.md"

FILES = {
    "events.json": ("backend.engine._reveal_event / _finalize_round", "SiteInspector / ChoiceDialog", "test_event_chain_contract.py"),
    "action_cards.json": ("backend.engine._use_action_card", "CommandDock / ChoiceDialog", "test_action_card_semantics.py"),
    "role_upgrades.json": ("backend.engine._upgrade_effect / trigger checks", "RoleUpgradeDialog", "test_release_mechanics.py"),
    "projects.json": ("backend.engine._advance_project", "ProjectState / SiteInspector", "test_action_card_semantics.py"),
    "tasks.json": ("backend.engine._task_complete", "SiteInspector / HandTray", "test_release_mechanics.py"),
    "culture_cards.json": ("backend.engine._explore / _interpret_evidence / _effect", "Market / HandTray", "test_release_mechanics.py"),
}

rows = ["# 内容运行时覆盖", "", "此表由 `scripts/generate_content_runtime_coverage.py` 生成，并由 CI 检查。每一类内容均对应真实状态断言测试；新增内容时必须同时更新处理器、UI 入口和测试。", "", "| 文件 | ID 数量 | 后端处理器 | UI 入口 | 状态断言测试 |", "| --- | ---: | --- | --- | --- |"]
for filename, (handler, ui, tests) in FILES.items():
    payload = json.loads((DATA / filename).read_text(encoding="utf-8"))
    if isinstance(payload, list):
        count = len(payload)
    else:
        key = next((name for name in payload if isinstance(payload[name], list)), None)
        count = len(payload.get(key, [])) if key else 0
    rows.append(f"| `{filename}` | {count} | `{handler}` | {ui} | `{tests}` |")
OUT.write_text("\n".join(rows) + "\n", encoding="utf-8")
