import json

from fastapi.testclient import TestClient

from backend.app import app
from backend.dependencies import engine, repo
from backend.models import JournalEntry
from backend.repository import migrate_game_state

client = TestClient(app)


def _started_archive_room(name: str, seed: int | None = None) -> tuple[str, str, str, str]:
    payload = {
        "play_mode": "solo",
        "name": name,
        "scenario_id": "sand_and_stone",
        "difficulty_id": "guided",
    }
    if seed is not None:
        payload["seed"] = seed
    created = client.post("/api/rooms", json=payload).json()
    room = created["room"]
    room_id = room["room_id"]
    token = created["seat_token"]
    recovery_token = created["recovery_token"]
    for seat_id, role_id in (("seat-1", "pingcheng_artisan"), ("seat-2", "western_dancer")):
        response = client.post(
            f"/api/rooms/{room_id}/seats/{seat_id}",
            headers={"X-Seat-Token": token},
            json={"role_id": role_id, "ready": True},
        )
        assert response.status_code == 200
    started = client.post(f"/api/rooms/{room_id}/start", headers={"X-Seat-Token": token})
    assert started.status_code == 200
    return room_id, token, recovery_token, started.json()["session_id"]


def test_archive_list_requires_owned_capability_and_returns_resume_context():
    room_id, _, recovery_token, _ = _started_archive_room("石刻旅人")
    response = client.get(
        "/api/archives",
        headers={"X-Archive-Capabilities": json.dumps({room_id: recovery_token})},
    )

    assert response.status_code == 200
    item = next(item for item in response.json() if item["room_id"] == room_id)
    assert item["archive_id"] == room_id
    assert item["mode"] == "solo"
    assert {player["role_id"] for player in item["players"]} == {"pingcheng_artisan", "western_dancer"}
    assert "seat_token" not in item
    assert "host_token" not in item


def test_archive_list_sorts_by_latest_journal_entry():
    first_room, _, first_recovery, first_session = _started_archive_room("同行者", seed=101)
    second_room, _, second_recovery, second_session = _started_archive_room("同行者", seed=102)
    rooms = {first_room: first_recovery, second_room: second_recovery}
    first_state = repo.get(first_session)
    second_state = repo.get(second_session)
    first_state.shared.journal = [JournalEntry(id="old", created_at="2026-01-01T00:00:00+00:00")]
    second_state.shared.journal = [JournalEntry(id="new", created_at="2026-02-01T00:00:00+00:00")]
    repo.save(first_state)
    repo.save(second_state)

    archives = client.get("/api/archives", headers={"X-Archive-Capabilities": json.dumps(rooms)}).json()
    ids = [item["room_id"] for item in archives]
    assert ids.index(second_room) < ids.index(first_room)


def test_legacy_state_migration_translates_pressure_alias_before_validation():
    payload = {
        "schema_version": 2,
        "session_id": "legacy-game",
        "players": {},
        "sites": {},
        "shared": {"threat": 3},
    }
    migrated = migrate_game_state(payload)
    assert migrated["schema_version"] == 3
    assert migrated["migrated_from_schema_version"] == 2
    assert migrated["shared"]["weathering_track"] == 3
    assert "threat" not in migrated["shared"]


def test_v1_state_migration_runs_each_version_step():
    payload = {"schema_version": 1, "session_id": "legacy-v1", "shared": {"threat": 2}}
    migrated = migrate_game_state(payload)
    assert migrated["schema_version"] == 3
    assert migrated["migrated_from_schema_version"] == 1
    assert migrated["shared"]["weathering_track"] == 2
    assert "threat" not in migrated["shared"]


def test_repository_persists_canonical_state_after_legacy_read(tmp_path):
    from backend.repository import GameRepository

    repository = GameRepository(tmp_path / "legacy.sqlite3")
    repository.database.ensure_games()
    payload = json.loads(engine.new_game("legacy-read", ["p1"], scenario_id="sand_and_stone").model_dump_json())
    payload["schema_version"] = 1
    payload["shared"]["threat"] = 2
    payload["shared"].pop("weathering_track", None)
    with repository.database.connect() as db:
        db.execute(repository.database.sql("INSERT INTO games(session_id,state) VALUES(?,?)"), ("legacy-read", json.dumps(payload)))

    assert repository.get("legacy-read") is not None
    with repository.database.connect() as db:
        raw = db.execute(repository.database.sql("SELECT state FROM games WHERE session_id=?"), ("legacy-read",)).fetchone()[0]
    stored = json.loads(raw)
    assert stored["schema_version"] == 3
    assert stored["shared"]["weathering_track"] == 2
    assert "threat" not in stored["shared"]
