from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
import os
import sqlite3
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
        if self.path is not None:
            self.path.parent.mkdir(parents=True, exist_ok=True)

    @property
    def kind(self) -> str:
        return "postgresql" if self.is_postgres else "sqlite"

    def sql(self, statement: str) -> str:
        return statement.replace("?", "%s") if self.is_postgres else statement

    @contextmanager
    def connect(self, *, immediate: bool = False) -> Iterator[Any]:
        if self.is_postgres:
            try:
                import psycopg
            except ImportError as exc:
                raise RuntimeError("PostgreSQL storage requires the psycopg package.") from exc
            connection = psycopg.connect(self.target)
        else:
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

    def ping(self) -> None:
        with self.connect() as db:
            db.execute(self.sql("SELECT 1")).fetchone()
