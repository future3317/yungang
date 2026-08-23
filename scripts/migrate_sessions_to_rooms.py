"""One-off migration: create a room record for every existing game session.

Before this migration, games were accessed directly via `/api/games/{session_id}`.
Afterwards, every session is owned by a room and must be reached through
`/api/rooms/{room_id}/*`.  Running this script against an existing database
preserves all game states and creates companion room records so players can
resume their journeys via the room flow.

Usage:
    python scripts/migrate_sessions_to_rooms.py
    python scripts/migrate_sessions_to_rooms.py data/games.sqlite3
    YUNGANG_DATABASE_PATH=data/games.sqlite3 python scripts/migrate_sessions_to_rooms.py
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.database import Database, database_target_from_environment
from backend.models import GameState
from backend.repository import GameRepository, migrate_game_state
from backend.rooms import RoomRepository, RoomService


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _make_seat(seat_number: int, player_id: str, name: str, role_id: str | None) -> dict[str, Any]:
    from backend.rooms import _digest, _token

    return {
        "seat_id": f"seat-{seat_number}",
        "player_id": player_id,
        "name": name or "同行者",
        "role_id": role_id,
        "ready": True,
        "connected": False,
        "role_locked": bool(role_id),
        "token_hash": _digest(_token()),
    }


def migrate(database_path: str | Path | None = None, dry_run: bool = False) -> dict[str, int]:
    target = database_path or database_target_from_environment("data/games.sqlite3")
    if target is None:
        raise RuntimeError("No database target configured. Set DATABASE_URL, YUNGANG_DATABASE_PATH, or pass a path.")

    db = Database(target)
    db.ensure_games()
    db.ensure_rooms()

    repo = GameRepository(db)
    room_repo = RoomRepository(db)
    room_service = RoomService(room_repo)

    stats = {"sessions": 0, "rooms_created": 0, "skipped": 0, "errors": 0}

    for session_id, raw_state in repo.list_raw():
        stats["sessions"] += 1
        try:
            migrated = migrate_game_state(json.loads(raw_state))
            state = GameState.model_validate(migrated)
        except (TypeError, json.JSONDecodeError, ValueError) as exc:
            print(f"  skip {session_id}: invalid state ({exc})")
            stats["errors"] += 1
            continue

        # Skip sessions that already have a linked room.
        existing = room_service.room_for_session(session_id)
        if existing:
            stats["skipped"] += 1
            continue

        player_ids = list(state.players.keys())
        seats = [
            _make_seat(idx + 1, player_id, state.players[player_id].name, state.players[player_id].role_id)
            for idx, player_id in enumerate(player_ids)
        ]

        room_id = f"room-{session_id.replace('game-', '')}"
        room: dict[str, Any] = {
            "room_id": room_id,
            "status": "completed" if state.shared.outcome else "in_progress",
            "play_mode": "solo" if state.shared.solo_mode or len(player_ids) == 1 else "local",
            "scenario_id": state.scenario_id or state.shared.scenario_id,
            "difficulty_id": state.difficulty_id,
            "seed": state.seed,
            "max_players": max(1, len(player_ids)),
            "host_token_hash": seats[0]["token_hash"] if seats else "",
            "session_id": session_id,
            "created_at": _now(),
            "updated_at": _now(),
            "seats": seats,
        }

        if dry_run:
            print(f"  would create room {room_id} for {session_id}")
        else:
            room_repo.save(room)
            print(f"  created room {room_id} for {session_id}")
        stats["rooms_created"] += 1

    return stats


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate legacy game sessions to room records.")
    parser.add_argument("database_path", nargs="?", help="Path to the SQLite database or PostgreSQL URL.")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be created without writing.")
    args = parser.parse_args()

    stats = migrate(args.database_path, dry_run=args.dry_run)
    created_phrase = f"{stats['rooms_created']} rooms would be created" if args.dry_run else f"{stats['rooms_created']} rooms created"
    print(
        f"Done: {stats['sessions']} sessions inspected, "
        f"{created_phrase}, {stats['skipped']} already linked, {stats['errors']} errors."
    )
    return 0 if stats["errors"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
