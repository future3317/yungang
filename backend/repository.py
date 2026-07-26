import sqlite3
import json
from pathlib import Path
from typing import Optional
from .models import GameState

class GameRepository:
    def __init__(self, path: Optional[str] = None):
        self.path = Path(path or Path(__file__).resolve().parents[1] / "data" / "games.sqlite3")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.path) as db:
            db.execute("CREATE TABLE IF NOT EXISTS games (session_id TEXT PRIMARY KEY, state TEXT NOT NULL)")

    def get(self, session_id: str):
        with sqlite3.connect(self.path) as db:
            row = db.execute("SELECT state FROM games WHERE session_id=?", (session_id,)).fetchone()
        if not row:
            return None
        payload = json.loads(row[0])
        if payload.get("schema_version", 2) < 3:
            payload["migrated_from_schema_version"] = payload.get("schema_version", 2)
            payload["schema_version"] = 3
        return GameState.model_validate(payload)

    def save(self, state: GameState):
        with sqlite3.connect(self.path) as db:
            db.execute("INSERT INTO games(session_id,state) VALUES(?,?) ON CONFLICT(session_id) DO UPDATE SET state=excluded.state", (state.session_id, state.model_dump_json()))

    def save_if_revision(self, state: GameState, expected_revision: int) -> bool:
        with sqlite3.connect(self.path, isolation_level="IMMEDIATE") as db:
            row = db.execute("SELECT state FROM games WHERE session_id=?", (state.session_id,)).fetchone()
            if not row:
                return False
            current = json.loads(row[0])
            if current.get("revision", 0) != expected_revision:
                return False
            db.execute("UPDATE games SET state=? WHERE session_id=?", (state.model_dump_json(), state.session_id))
            return True

    def next_id(self):
        with sqlite3.connect(self.path) as db:
            row = db.execute("SELECT COUNT(*) FROM games").fetchone()
        return row[0] + 1
