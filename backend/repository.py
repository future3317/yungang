import json
from pathlib import Path
from typing import Optional

from .database import Database
from .models import GameState


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
        payload = json.loads(row[0])
        if payload.get("schema_version", 2) < 3:
            payload["migrated_from_schema_version"] = payload.get("schema_version", 2)
            payload["schema_version"] = 3
        return GameState.model_validate(payload)

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
