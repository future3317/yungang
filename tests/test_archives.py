from fastapi.testclient import TestClient

from backend.app import app, repo
from backend.models import JournalEntry
from backend.repository import migrate_game_state


client = TestClient(app)


def test_archive_list_returns_resume_context_without_room_tokens():
    created = client.post("/api/games", json={"player_ids": ["p1"], "difficulty_id": "guided", "scenario_id": "sand_and_stone"})
    assert created.status_code == 200
    session_id = created.json()["session_id"]
    state = repo.get(session_id)
    state.players["p1"].name = "石刻旅人"
    repo.save(state)

    response = client.get("/api/archives")

    assert response.status_code == 200
    item = next(item for item in response.json() if item["session_id"] == session_id)
    assert item["archive_id"] == session_id
    assert item["mode"] == "solo"
    assert {player["role_id"] for player in item["players"]} == {"pingcheng_artisan", "western_dancer"}
    assert next(player for player in item["players"] if player["role_id"] == "pingcheng_artisan")["name"] == "石刻旅人"
    assert "seat_token" not in item
    assert "host_token" not in item


def test_archive_list_sorts_by_latest_journal_entry():
    first = client.post("/api/games", json={"player_ids": ["p1"], "difficulty_id": "guided", "scenario_id": "sand_and_stone", "seed": 101})
    second = client.post("/api/games", json={"player_ids": ["p1"], "difficulty_id": "guided", "scenario_id": "sand_and_stone", "seed": 102})
    assert first.status_code == second.status_code == 200
    first_state = repo.get(first.json()["session_id"])
    second_state = repo.get(second.json()["session_id"])
    first_state.shared.journal = [JournalEntry(id="old", created_at="2026-01-01T00:00:00+00:00")]
    second_state.shared.journal = [JournalEntry(id="new", created_at="2026-02-01T00:00:00+00:00")]
    repo.save(first_state)
    repo.save(second_state)
    archives = client.get("/api/archives").json()
    ids = [item["session_id"] for item in archives]
    assert ids.index(second_state.session_id) < ids.index(first_state.session_id)


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
