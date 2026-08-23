# API contract

- `GET /api/meta` returns domains, roles, sites with layout data, routes, cards, events, tasks, projects, objectives and difficulty.
- `GET /api/archives` returns resumable journey records with mode, scenario, round and player/role summaries.
- `POST /api/rooms` creates a solo, local or multi-device journey and returns room and seat credentials.
- `GET /api/rooms/{room_id}/game` returns the authoritative viewer-scoped `GameState`.
- `POST /api/rooms/{room_id}/actions` accepts an enum action, `expected_revision` and optional target/card fields.
- A stale revision returns `409` with `code=revision_conflict` and the current viewer-scoped state.
- Room SSE uses a short-lived ticket from `GET /api/rooms/{room_id}/events-ticket`; seat tokens are sent through `X-Seat-Token`, not the URL.

The generated frontend client is derived from the backend OpenAPI document; API DTOs are not maintained as a second hand-written contract. Run `npm run api:generate` with the backend running, then ensure `src/shared/api/generated.ts` has no drift.
# 当前接口契约补充

OpenAPI 是唯一接口契约。后端 Pydantic 模型变更后，先启动 `backend.app:app`，再在 `frontend` 运行 `npm run api:generate`；提交前必须确认 `frontend/src/shared/api/generated.ts` 没有未提交漂移。

游戏状态中的 `action_options` 是唯一玩家行动来源。每个选项包含 `id`、`type`、`label`、`cost`、`targets`、`requirements`、`disabled_reason`、`preview_delta`、`recommendation_score`、`reason` 和 `payload`。行动成功后使用 `feedback_events` 展示服务端确认的因果变化，使用 `goal_status` 展示胜负目标，不由前端推断。
