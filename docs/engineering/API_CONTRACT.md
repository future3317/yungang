# API contract

- `GET /api/meta` returns domains, roles, sites with x/y coordinates and connections, cards, events, tasks and difficulty.
- `POST /api/games` accepts `player_ids` and `difficulty_id` and returns `GameState`.
- `GET /api/games/{session_id}` returns the authoritative snapshot.
- `POST /api/games/{session_id}/actions` accepts `player_id`, enum `action`, `expected_revision` and optional target/card fields.
- A stale revision returns `409` with `code=revision_conflict` and `current_state`.

The generated frontend client keeps these fields typed locally. `npm run api:generate` can regenerate OpenAPI types when the API is running.
