from fastapi.testclient import TestClient

from backend.app import app, repo


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
