from __future__ import annotations

import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator


def database_target_from_environment(default: str | Path | None = None) -> str | Path | None:
    database_url = os.getenv("DATABASE_URL")
    if os.getenv("YUNGANG_REQUIRE_EXTERNAL_DATABASE", "false").lower() == "true" and not database_url:
        raise RuntimeError("DATABASE_URL must be configured when external database storage is required.")
    return database_url or os.getenv("YUNGANG_DATABASE_PATH") or default


class Database:
    """Small connection adapter for local SQLite and hosted PostgreSQL."""

    def __init__(self, target: str | Path):
        self.target = str(target)
        self.is_postgres = self.target.startswith(("postgres://", "postgresql://"))
        self.path = None if self.is_postgres else Path(self.target)
        self._pool = None
        self._pool_lock = threading.Lock()
        if self.path is not None:
            self.path.parent.mkdir(parents=True, exist_ok=True)
    def _get_pool(self):
        if self._pool is None:
            with self._pool_lock:
                if self._pool is None:
                    try:
                        from psycopg_pool import ConnectionPool
                    except ImportError as exc:
                        raise RuntimeError("PostgreSQL storage requires psycopg with the pool extra.") from exc
                    self._pool = ConnectionPool(self.target, min_size=1, max_size=10, timeout=10, open=True)
                    self._pool.wait(timeout=10)
        return self._pool

    @property
    def kind(self) -> str:
        return "postgresql" if self.is_postgres else "sqlite"

    def sql(self, statement: str) -> str:
        return statement.replace("?", "%s") if self.is_postgres else statement

    @contextmanager
    def connect(self, *, immediate: bool = False) -> Iterator[Any]:
        if self.is_postgres:
            with self._get_pool().connection() as connection:
                try:
                    yield connection
                    connection.commit()
                except BaseException:
                    connection.rollback()
                    raise
            return
        connection = sqlite3.connect(self.path, isolation_level="IMMEDIATE" if immediate else None, timeout=10)
        connection.execute("PRAGMA busy_timeout=10000")
        try:
            yield connection
            connection.commit()
        except BaseException:
            connection.rollback()
            raise
        finally:
            connection.close()

    def ensure_games(self) -> None:
        with self.connect() as db:
            if not self.is_postgres:
                db.execute("PRAGMA journal_mode=WAL")
            db.execute(self.sql("CREATE TABLE IF NOT EXISTS games (session_id TEXT PRIMARY KEY, state TEXT NOT NULL)"))

    def ensure_rooms(self) -> None:
        with self.connect() as db:
            if not self.is_postgres:
                db.execute("PRAGMA journal_mode=WAL")
            db.execute(self.sql("CREATE TABLE IF NOT EXISTS rooms (room_id TEXT PRIMARY KEY, payload TEXT NOT NULL)"))
            if self.is_postgres:
                column = db.execute("SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=%s AND column_name=%s", ("rooms", "session_id")).fetchone()
            else:
                column = next((row for row in db.execute("PRAGMA table_info(rooms)").fetchall() if row[1] == "session_id"), None)
            if not column:
                db.execute("ALTER TABLE rooms ADD COLUMN session_id TEXT")
            db.execute(self.sql("CREATE INDEX IF NOT EXISTS idx_rooms_session_id ON rooms(session_id)"))
            rows = db.execute(self.sql("SELECT room_id, payload FROM rooms WHERE session_id IS NULL")).fetchall()
            for room_id, payload in rows:
                try:
                    session_id = json.loads(payload).get("session_id")
                except (TypeError, json.JSONDecodeError):
                    session_id = None
                if session_id:
                    db.execute(self.sql("UPDATE rooms SET session_id=? WHERE room_id=? AND session_id IS NULL"), (session_id, room_id))

    def ping(self) -> None:
        with self.connect() as db:
            db.execute(self.sql("SELECT 1")).fetchone()

    def close(self) -> None:
        with self._pool_lock:
            if self._pool is not None:
                self._pool.close()
                self._pool = None
