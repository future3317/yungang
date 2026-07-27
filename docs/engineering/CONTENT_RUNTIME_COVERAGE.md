# 内容运行时覆盖

此表由 `scripts/generate_content_runtime_coverage.py` 生成。它列出入口，不替代语义测试。

| 文件 | ID 数量 | 后端处理器 | UI 入口 | 测试状态 |
| --- | ---: | --- | --- | --- |
| `events.json` | 18 | `backend.engine._reveal_event / _settle_event` | SiteInspector / ChoiceDialog | 需要参数化覆盖 |
| `action_cards.json` | 12 | `backend.engine._use_action_card` | CommandDock / ChoiceDialog | 需要参数化覆盖 |
| `role_upgrades.json` | 8 | `backend.engine._upgrade_effect / trigger checks` | RoleUpgradeDialog | 需要参数化覆盖 |
| `projects.json` | 8 | `backend.engine._advance_project` | ProjectState / SiteInspector | 需要参数化覆盖 |
| `tasks.json` | 18 | `backend.engine._task_complete` | SiteInspector / HandTray | 需要参数化覆盖 |
| `culture_cards.json` | 36 | `backend.engine._explore / _contribute / _effect` | Market / HandTray | 需要参数化覆盖 |
