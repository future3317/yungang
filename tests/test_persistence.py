from backend.content import Content
from backend.engine import GameEngine
from backend.repository import GameRepository
from backend.rooms import RoomRepository


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

