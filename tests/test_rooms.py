from fastapi.testclient import TestClient

from backend.app import app

client = TestClient(app)


def configure_local_seat(room_id, token, seat_id, role_id):
    configured = client.post(f"/api/rooms/{room_id}/seats/{seat_id}", headers={"X-Seat-Token": token}, json={"role_id": role_id})
    assert configured.status_code == 200
    prepared = client.post(f"/api/rooms/{room_id}/seats/{seat_id}", headers={"X-Seat-Token": token}, json={"ready": True})
    assert prepared.status_code == 200


def test_solo_room_uses_two_configured_seats_and_preserves_role_starts():
    created = client.post("/api/rooms", json={"play_mode": "solo", "name": "石刻旅人", "scenario_id": "sand_and_stone", "difficulty_id": "guided"})
    assert created.status_code == 200
    payload = created.json()
    room_id = payload["room"]["room_id"]
    token = payload["seat_token"]
    assert len(payload["room"]["seats"]) == 2
    assert "player_id" not in payload["room"]["seats"][0]
    assert token and len(token) > 20
    assert client.get(f"/api/rooms/{room_id}").json()["viewer_seat_id"] is None
    assert client.get(f"/api/rooms/{room_id}", headers={"X-Seat-Token": token}).json()["viewer_seat_id"] == "seat-1"
    assert client.post(f"/api/rooms/{room_id}/start", headers={"X-Seat-Token": token}).status_code == 409
    configure_local_seat(room_id, token, "seat-1", "pingcheng_artisan")
    configure_local_seat(room_id, token, "seat-2", "grassland_rider")
    started = client.post(f"/api/rooms/{room_id}/start", headers={"X-Seat-Token": token})
    assert started.status_code == 200
    game = client.get(f"/api/rooms/{room_id}/game", headers={"X-Seat-Token": token})
    assert game.status_code == 200
    state = game.json()
    assert set(state["players"]) == {"player-seat-1", "player-seat-2"}
    assert state["players"]["player-seat-1"]["role_id"] == "pingcheng_artisan"
    assert state["players"]["player-seat-2"]["role_id"] == "grassland_rider"
    assert state["shared"]["solo_mode"] is True


def test_multi_device_requires_roles_ready_and_blocks_legacy_session_access():
    created = client.post("/api/rooms", json={"play_mode": "multi_device", "name": "房主", "max_players": 2})
    payload = created.json()
    room_id = payload["room"]["room_id"]
    host_token = payload["seat_token"]
    joined = client.post(f"/api/rooms/{room_id}/join", json={"name": "同行者", "role_id": "grassland_rider"})
    assert joined.status_code == 200
    guest_token = joined.json()["seat_token"]
    assert client.post(f"/api/rooms/{room_id}/start", headers={"X-Seat-Token": host_token}).status_code == 409
    assert client.post(f"/api/rooms/{room_id}/role", headers={"X-Seat-Token": host_token}, json={"role_id": "pingcheng_artisan"}).status_code == 200
    assert client.post(f"/api/rooms/{room_id}/ready", headers={"X-Seat-Token": host_token}, json={"ready": True}).status_code == 200
    assert client.post(f"/api/rooms/{room_id}/ready", headers={"X-Seat-Token": guest_token}, json={"ready": True}).status_code == 200
    started = client.post(f"/api/rooms/{room_id}/start", headers={"X-Seat-Token": host_token})
    assert started.status_code == 200
    assert client.get(f"/api/rooms/{room_id}/game", headers={"X-Seat-Token": "invalid"}).status_code == 401
    guest_state = client.get(f"/api/rooms/{room_id}/game", headers={"X-Seat-Token": guest_token})
    assert guest_state.status_code == 200
    assert guest_state.json()["viewer"]["can_act"] is False
    assert guest_state.json()["action_options"] == []
    reconnected = client.post(f"/api/rooms/{room_id}/reconnect", json={"seat_id": "seat-2"})
    assert reconnected.status_code == 200
    replacement_token = reconnected.json()["seat_token"]
    assert client.get(f"/api/rooms/{room_id}/game", headers={"X-Seat-Token": replacement_token}).json()["viewer"]["seat_id"] == "seat-2"
    assert client.get(f"/api/rooms/{room_id}/game", headers={"X-Seat-Token": guest_token}).status_code == 401


def test_multi_device_host_can_update_own_name():
    created = client.post("/api/rooms", json={"play_mode": "multi_device", "name": "房主", "max_players": 2})
    payload = created.json()
    room_id = payload["room"]["room_id"]
    updated = client.post(
        f"/api/rooms/{room_id}/seats/seat-1",
        headers={"X-Seat-Token": payload["seat_token"]},
        json={"name": "新的房主"},
    )
    assert updated.status_code == 200
    assert updated.json()["seats"][0]["name"] == "新的房主"


def test_local_host_configures_all_seats_without_joining_from_another_device():
    created = client.post("/api/rooms", json={"play_mode": "local", "name": "主持人", "max_players": 2})
    payload = created.json()
    room_id = payload["room"]["room_id"]
    token = payload["seat_token"]
    assert len(payload["room"]["seats"]) == 2
    configure_local_seat(room_id, token, "seat-1", "pingcheng_artisan")
    configure_local_seat(room_id, token, "seat-2", "grassland_rider")
    assert client.post(f"/api/rooms/{room_id}/start", headers={"X-Seat-Token": token}).status_code == 200
