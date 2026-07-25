# v1 到 v2 迁移

| v1 | v2 |
|---|---|
| 掷骰移动 | 路线图上的 AP 移动 |
| 棋子绕赛道 | 玩家占据遗产节点 |
| 前端流程控制卡牌 | 后端引擎解释卡牌和事件 |
| 内存状态 | SQLite `games` 表持久化 |
| 无并发版本 | `expected_revision` + 409 冲突 |

旧数据位于 `data/legacy/game_data.json`，旧机制位于 `docs/legacy/MECHANICS_V1_FLYING_CHESS.md`。v2 不自动把旧棋盘位置映射成节点位置。
