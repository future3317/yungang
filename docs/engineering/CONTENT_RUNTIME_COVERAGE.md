# 内容运行时覆盖

此表由 `scripts/generate_content_runtime_coverage.py` 生成，并由 CI 检查。每一类内容均对应真实状态断言测试；新增内容时必须同时更新处理器、UI 入口和测试。

| 文件 | ID 数量 | 后端处理器 | UI 入口 | 状态断言测试 |
| --- | ---: | --- | --- | --- |
| `events.json` | 24 | `backend.engine._reveal_event / _finalize_round` | SiteInspector / ChoiceDialog | `test_event_chain_contract.py` |
| `action_cards.json` | 16 | `backend.engine._use_action_card` | CommandDock / ChoiceDialog | `test_action_card_semantics.py` |
| `role_upgrades.json` | 8 | `backend.engine._upgrade_effect / trigger checks` | RoleUpgradeDialog | `test_release_mechanics.py` |
| `projects.json` | 12 | `backend.engine._advance_project` | ProjectState / SiteInspector | `test_action_card_semantics.py` |
| `tasks.json` | 28 | `backend.engine._task_complete` | SiteInspector / HandTray | `test_release_mechanics.py` |
| `culture_cards.json` | 48 | `backend.engine._explore / _interpret_evidence / _effect` | Market / HandTray | `test_release_mechanics.py` |
