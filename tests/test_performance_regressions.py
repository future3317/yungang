import asyncio
import sys
import time
from contextlib import contextmanager
from types import SimpleNamespace

from backend import app as app_module
from backend.database import Database
from backend.models import RoomActionRequest
from backend.content import Content
from backend.engine import GameEngine
from backend.rooms import RoomRepository, RoomService


def test_room_for_session_uses_the_session_indexed_lookup(tmp_path):
    database = Database(tmp_path / "rooms.sqlite3")
    repository = RoomRepository(database)
    repository.save({"room_id": "room-1", "session_id": "game-1", "status": "in_progress", "seats": []})
    with database.connect() as connection:
        indexes = {row[1] for row in connection.execute("PRAGMA index_list(rooms)").fetchall()}
    assert "idx_rooms_session_id" in indexes
    statements = []
    original_connect = database.connect

    @contextmanager
    def traced_connect(*, immediate=False):
        with original_connect(immediate=immediate) as connection:
            class TracedConnection:
                def execute(self, statement, parameters=()):
                    statements.append(statement)
                    return connection.execute(statement, parameters)

            yield TracedConnection()

    database.connect = traced_connect
    assert RoomService(repository).room_for_session("game-1")["room_id"] == "room-1"
    assert any("WHERE session_id=? LIMIT 1" in statement for statement in statements)
    assert not any(statement.strip() == "SELECT payload FROM rooms" for statement in statements)


def test_postgres_database_reuses_one_connection_pool(monkeypatch):
    instances = []

    class FakePool:
        def __init__(self, target, **kwargs):
            self.target = target
            self.kwargs = kwargs
            instances.append(self)

        def wait(self, timeout):
            return None

        def close(self):
            return None

    monkeypatch.setitem(sys.modules, "psycopg_pool", SimpleNamespace(ConnectionPool=FakePool))
    database = Database("postgresql://user:password@host/database")
    assert database._get_pool() is database._get_pool()
    assert len(instances) == 1
    assert instances[0].kwargs["max_size"] == 10


def test_existing_room_rows_are_backfilled_without_being_deleted(tmp_path):
    database = Database(tmp_path / "legacy.sqlite3")
    with database.connect() as connection:
        connection.execute("CREATE TABLE rooms (room_id TEXT PRIMARY KEY, payload TEXT NOT NULL)")
        connection.execute("INSERT INTO rooms(room_id, payload) VALUES(?, ?)", ("room-1", '{"room_id":"room-1","session_id":"game-1","seats":[]}'))

    repository = RoomRepository(database)
    with database.connect() as connection:
        count = connection.execute("SELECT COUNT(*) FROM rooms").fetchone()[0]
        session_id = connection.execute("SELECT session_id FROM rooms WHERE room_id=?", ("room-1",)).fetchone()[0]
    assert count == 1
    assert session_id == "game-1"
    assert RoomService(repository).room_for_session("game-1")["room_id"] == "room-1"


def test_run_action_uses_prefetched_room_state(monkeypatch):
    state = SimpleNamespace(revision=4, processed_request_ids=[], model_dump=lambda: {})
    request = SimpleNamespace(request_id=None, expected_revision=4)

    class NoReadRepository:
        def get(self, session_id):
            raise AssertionError("room_action should not load the game twice")

        def save_if_revision(self, next_state, expected_revision):
            return True

    monkeypatch.setattr(app_module, "repo", NoReadRepository())
    monkeypatch.setattr(app_module, "dispatch", lambda engine, current, action: current)
    assert app_module._run_action("game-1", request, state) is state


def test_room_action_loads_game_once(monkeypatch):
    state = SimpleNamespace(
        revision=4,
        processed_request_ids=[],
        shared=SimpleNamespace(active_player_id="player-seat-1", outcome=None),
        model_dump=lambda: {},
    )
    room = {
        "room_id": "room-1",
        "status": "in_progress",
        "play_mode": "multi_device",
        "session_id": "game-1",
        "seats": [{"seat_id": "seat-1", "player_id": "player-seat-1"}],
    }
    loads = 0

    class FakeRepository:
        def notify(self, room_id, **kwargs):
            return None

    class FakeRoomService:
        repository = FakeRepository()

        @staticmethod
        def authenticate(_room, _token):
            return room["seats"][0]

    class FakeGameRepository:
        def get(self, session_id):
            nonlocal loads
            loads += 1
            assert session_id == "game-1"
            return state

        @staticmethod
        def save_if_revision(_state, _expected_revision):
            return True

    monkeypatch.setattr(app_module, "_room_or_404", lambda _room_id: room)
    monkeypatch.setattr(app_module, "room_service", FakeRoomService())
    monkeypatch.setattr(app_module, "repo", FakeGameRepository())
    monkeypatch.setattr(app_module, "dispatch", lambda _engine, current, _request: current)

    result = app_module.room_action("room-1", RoomActionRequest(action="end_turn", expected_revision=4), "seat-token")

    assert result is state
    assert loads == 1


def test_sse_stream_waits_for_notification_instead_of_querying_each_second(monkeypatch):
    async def consume_one_event():
        queue = asyncio.Queue()
        listener = (asyncio.get_running_loop(), queue)
        await queue.put({"revision": 7, "status": "in_progress"})
        generator = app_module._room_revision_stream("room-1", listener)
        event = await generator.__anext__()
        await generator.aclose()
        return event

    monkeypatch.setattr(app_module.room_service.repository, "unsubscribe", lambda room_id, listener: None)
    event = asyncio.run(consume_one_event())
    assert '"revision": 7' in event


def test_action_option_refresh_stays_within_performance_budget():
    engine = GameEngine(Content())
    state = engine.new_game("performance-budget", ["p1", "p2"], "normal", "sand_and_stone", seed=2026)
    engine.refresh(state)
    samples = []
    for _ in range(3):
        started = time.perf_counter()
        engine.refresh(state)
        samples.append((time.perf_counter() - started) * 1000)
    assert max(samples) < 100, f"refresh exceeded 100ms budget: {samples}"
