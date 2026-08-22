from __future__ import annotations

import argparse
from pathlib import Path
import os
import sqlite3
import sys
from typing import Any

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.database import Database


def migrate(source: str | Path, target: str | Path) -> dict[str, int]:
    """Copy the current SQLite snapshots into the configured database target."""
    source_path = Path(source)
    target_database = Database(target)
    target_database.ensure_games()
    target_database.ensure_rooms()
    copied = {"games": 0, "rooms": 0}

    with sqlite3.connect(source_path) as source_db, target_database.connect() as target_db:
        cursor = target_db.cursor()
        try:
            for table, key, column in (("games", "session_id", "state"), ("rooms", "room_id", "payload")):
                rows = source_db.execute(f"SELECT {key}, {column} FROM {table}").fetchall()
                query = f"INSERT INTO {table}({key},{column}) VALUES(?,?) ON CONFLICT({key}) DO UPDATE SET {column}=excluded.{column}"
                cursor.executemany(target_database.sql(query), rows)
                copied[table] = len(rows)
        finally:
            cursor.close()
    return copied


def main() -> None:
    parser = argparse.ArgumentParser(description="将本地 SQLite 游戏存档导入 Neon/PostgreSQL")
    parser.add_argument("--source", default=os.getenv("YUNGANG_SQLITE_SOURCE", "data/games.sqlite3"))
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"))
    args = parser.parse_args()
    if not args.database_url or not args.database_url.startswith(("postgres://", "postgresql://")):
        parser.error("请通过 --database-url 或 DATABASE_URL 提供 PostgreSQL 连接串。")
    result = migrate(args.source, args.database_url)
    print(f"已导入游戏存档 {result['games']} 条，房间存档 {result['rooms']} 条。")


if __name__ == "__main__":
    main()
