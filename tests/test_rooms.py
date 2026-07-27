from fastapi.testclient import TestClient

from backend.app import app


client = TestClient(app)


def test_solo_room_uses_opaque_seat_token_and_starts():
    created = client.post("/api/rooms", json={"play_mode": "solo", "name": "石刻旅人", "scenario_id": "sand_and_stone", "difficulty_id": "guided"})
    assert created.status_code == 200
    payload = created.json()
    room_id = payload["room"]["room_id"]
    token = payload["seat_token"]
    assert "player_id" not in payload["room"]["seats"][0]
    assert token and len(token) > 20
    assert client.get(f"/api/rooms/{room_id}").json()["viewer_seat_id"] is None
    assert client.get(f"/api/rooms/{room_id}", headers={"X-Seat-Token": token}).json()["viewer_seat_id"] == "seat-1"
    started = client.post(f"/api/rooms/{room_id}/start", headers={"X-Seat-Token": token})
    assert started.status_code == 200
    game = client.get(f"/api/rooms/{room_id}/game", headers={"X-Seat-Token": token})
    assert game.status_code == 200
    assert len(game.json()["players"]) == 2


def test_multi_device_room_requires_ready_seats_and_rejects_invalid_token():
    created = client.post("/api/rooms", json={"play_mode": "multi_device", "name": "房主", "max_players": 2})
    payload = created.json()
    room_id = payload["room"]["room_id"]
    host_token = payload["seat_token"]
    joined = client.post(f"/api/rooms/{room_id}/join", json={"name": "同行者", "role_id": "grassland_rider"})
    assert joined.status_code == 200
    guest_token = joined.json()["seat_token"]
    not_ready = client.post(f"/api/rooms/{room_id}/start", headers={"X-Seat-Token": host_token})
    assert not_ready.status_code == 409
    client.post(f"/api/rooms/{room_id}/ready", headers={"X-Seat-Token": host_token}, json={"ready": True})
    client.post(f"/api/rooms/{room_id}/ready", headers={"X-Seat-Token": guest_token}, json={"ready": True})
    started = client.post(f"/api/rooms/{room_id}/start", headers={"X-Seat-Token": host_token})
    assert started.status_code == 200
    assert client.get(f"/api/rooms/{room_id}/game", headers={"X-Seat-Token": "invalid"}).status_code == 401
    assert client.get(f"/api/rooms/{room_id}/game", headers={"X-Seat-Token": guest_token}).status_code == 200
