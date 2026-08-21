# API contract

- `GET /api/meta` returns domains, roles, sites with x/y coordinates and connections, cards, events, tasks and difficulty.
- `POST /api/games` accepts `player_ids` and `difficulty_id` and returns `GameState`.
- `GET /api/games/{session_id}` returns the authoritative snapshot.
- `POST /api/games/{session_id}/actions` accepts `player_id`, enum `action`, `expected_revision` and optional target/card fields.
- A stale revision returns `409` with `code=revision_conflict` and `current_state`.

The generated frontend client keeps these fields typed locally. `npm run api:generate` can regenerate OpenAPI types when the API is running.
# 当前接口契约补充

OpenAPI 是唯一接口契约。后端 Pydantic 模型变更后，先启动 `backend.app:app`，再在 `frontend` 运行 `npm run api:generate`；提交前必须确认 `frontend/src/shared/api/generated.ts` 没有未提交漂移。

游戏状态中的 `action_options` 是唯一玩家行动来源。每个选项包含 `id`、`type`、`label`、`cost`、`targets`、`requirements`、`disabled_reason`、`preview_delta`、`recommendation_score`、`reason` 和 `payload`。行动成功后使用 `feedback_events` 展示服务端确认的因果变化，使用 `goal_status` 展示胜负目标，不由前端推断。
