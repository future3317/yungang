import json
from pathlib import Path
from typing import Optional

from .database import Database
from .models import GameState


CURRENT_SCHEMA_VERSION = 3


def _migrate_v1_to_v2(payload: dict) -> dict:
    migrated = dict(payload)
    shared = dict(migrated.get("shared") or {})
    if "threat" in shared and "weathering" not in shared:
        shared["weathering"] = shared.pop("threat")
    migrated["shared"] = shared
    return migrated


def _migrate_v2_to_v3(payload: dict) -> dict:
    migrated = dict(payload)
    shared = dict(migrated.get("shared") or {})
    if "threat" in shared and "weathering_track" not in shared:
        shared["weathering_track"] = shared.pop("threat")
    if "weathering" in shared and "weathering_track" not in shared:
        shared["weathering_track"] = shared.pop("weathering")
    shared.setdefault("event_targets", [])
    shared.setdefault("event_history", [])
    migrated["shared"] = shared
    migrated.setdefault("scenario_id", shared.get("scenario_id", "sand_and_stone"))
    migrated.setdefault("routes", {})
    migrated.setdefault("projects", {})
    migrated.setdefault("objectives", {})
    migrated.setdefault("result", {})
    migrated.setdefault("viewer", {})
    migrated["schema_version"] = 3
    return migrated


def migrate_game_state(payload: dict, *, from_version: int | None = None, to_version: int = CURRENT_SCHEMA_VERSION) -> dict:
    """Apply each persisted schema migration before strict model validation."""
    version = int(payload.get("schema_version", 1) if from_version is None else from_version)
    if version > to_version:
        raise ValueError(f"unsupported_game_schema:{version}")
    migrated = dict(payload)
    original_version = version
    while version < to_version:
        if version == 1:
            migrated = _migrate_v1_to_v2(migrated)
        elif version == 2:
            migrated = _migrate_v2_to_v3(migrated)
        else:
            raise ValueError(f"unsupported_game_schema:{version}")
        version += 1
    if original_version < to_version:
        migrated["migrated_from_schema_version"] = original_version
    migrated["schema_version"] = to_version
    return migrated


class GameRepository:
    def __init__(self, path: Optional[str | Path | Database] = None):
        target = path or Path(__file__).resolve().parents[1] / "data" / "games.sqlite3"
        self.database = target if isinstance(target, Database) else Database(target)
        self.path = self.database.path
        self.database.ensure_games()

    def get(self, session_id: str):
        with self.database.connect() as db:
            row = db.execute(self.database.sql("SELECT state FROM games WHERE session_id=?"), (session_id,)).fetchone()
        if not row:
            return None
        return GameState.model_validate(migrate_game_state(json.loads(row[0])))

    def save(self, state: GameState):
        with self.database.connect() as db:
            db.execute(self.database.sql("INSERT INTO games(session_id,state) VALUES(?,?) ON CONFLICT(session_id) DO UPDATE SET state=excluded.state"), (state.session_id, state.model_dump_json()))

    def save_if_revision(self, state: GameState, expected_revision: int) -> bool:
        with self.database.connect(immediate=True) as db:
            query = "SELECT state FROM games WHERE session_id=?"
            if self.database.is_postgres:
                query += " FOR UPDATE"
            row = db.execute(self.database.sql(query), (state.session_id,)).fetchone()
            if not row:
                return False
            current = json.loads(row[0])
            if current.get("revision", 0) != expected_revision:
                return False
            db.execute(self.database.sql("UPDATE games SET state=? WHERE session_id=?"), (state.model_dump_json(), state.session_id))
            return True

    def next_id(self):
        with self.database.connect() as db:
            row = db.execute(self.database.sql("SELECT COUNT(*) FROM games")).fetchone()
        return row[0] + 1

    def list_raw(self) -> list[tuple[str, str]]:
        with self.database.connect() as db:
            rows = db.execute(self.database.sql("SELECT session_id, state FROM games")).fetchall()
        return [(str(session_id), str(state)) for session_id, state in rows]
