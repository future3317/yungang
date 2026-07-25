import sqlite3
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
        return GameState.model_validate_json(row[0]) if row else None

    def save(self, state: GameState):
        with sqlite3.connect(self.path) as db:
            db.execute("INSERT INTO games(session_id,state) VALUES(?,?) ON CONFLICT(session_id) DO UPDATE SET state=excluded.state", (state.session_id, state.model_dump_json()))
