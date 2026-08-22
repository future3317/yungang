from backend.database import Database
from backend.content import Content
from backend.engine import GameEngine
from backend.repository import GameRepository
from backend.rooms import RoomRepository
from scripts.migrate_sqlite_to_postgres import migrate


def test_database_target_supports_sqlite_for_local_and_postgres_url_for_cloud(tmp_path):
    sqlite_db = Database(tmp_path / "runtime.sqlite3")
    postgres_db = Database("postgresql://user:password@neon.example/db?sslmode=require")

    assert sqlite_db.is_postgres is False
    assert sqlite_db.path == tmp_path / "runtime.sqlite3"
    assert postgres_db.is_postgres is True
    assert postgres_db.path is None


def test_migration_copies_games_and_rooms_to_the_new_database_target(tmp_path):
    source = tmp_path / "source.sqlite3"
    target = tmp_path / "target.sqlite3"
    state = GameEngine(Content()).new_game("migration-session", ["p1"])
    room = {"room_id": "migration-room", "session_id": state.session_id, "seats": []}

    GameRepository(source).save(state)
    RoomRepository(source).save(room)

    migrated = migrate(source, target)

    assert migrated == {"games": 1, "rooms": 1}
    assert GameRepository(target).get(state.session_id).session_id == state.session_id
    assert RoomRepository(target).get(room["room_id"]) == room


def test_game_room_timeline_and_event_history_survive_repository_reopen(tmp_path):
    database_path = tmp_path / "runtime.sqlite3"
    state = GameEngine(Content()).new_game("persisted-session", ["p1"])
    state.shared.journal = [{"id": "journal-1", "round": 1, "message": "抵达云冈石窟"}]
    state.shared.event_history = [{"event_id": "event-1", "round": 1, "event_targets": ["yungang"]}]
    room = {
        "room_id": "AB12CD34",
        "status": "in_progress",
        "session_id": state.session_id,
        "seats": [{"seat_id": "seat-1", "name": "石刻旅人", "token_hash": "saved-token"}],
    }

    GameRepository(database_path).save(state)
    RoomRepository(database_path).save(room)

    reopened_state = GameRepository(database_path).get(state.session_id)
    reopened_room = RoomRepository(database_path).get(room["room_id"])

    assert reopened_state is not None
    assert reopened_state.shared.journal[0]["message"] == "抵达云冈石窟"
    assert reopened_state.shared.event_history[0]["event_id"] == "event-1"
    assert reopened_room == room
