import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.dependencies import content, repo
from backend.engine import GameEngine

client = TestClient(app)
_rooms: dict[str, str] = {}


_ROLES = ["pingcheng_artisan", "western_dancer", "grassland_rider", "central_scribe"]


def _start_solo_room(session: str, scenario_id: str = "sand_and_stone", difficulty_id: str = "normal", seed: int | None = None):
    payload = {"play_mode": "solo", "name": "p1", "scenario_id": scenario_id, "difficulty_id": difficulty_id}
    if seed is not None:
        payload["seed"] = seed
    created = client.post("/api/rooms", json=payload)
    assert created.status_code == 200
    room_id = created.json()["room"]["room_id"]
    token = created.json()["seat_token"]
    for seat_index, role_id in enumerate(_ROLES[:2], start=1):
        configured = client.post(
            f"/api/rooms/{room_id}/seats/seat-{seat_index}",
            headers={"X-Seat-Token": token},
            json={"role_id": role_id, "ready": True},
        )
        assert configured.status_code == 200
    started = client.post(f"/api/rooms/{room_id}/start", headers={"X-Seat-Token": token})
    assert started.status_code == 200
    _rooms[session] = room_id
    return room_id, token


def create(session, players=None, **options):
    room_id, token = _start_solo_room(session, **options)
    game = client.get(f"/api/rooms/{room_id}/game", headers={"X-Seat-Token": token})
    assert game.status_code == 200
    return game.json()


def action(session, state, player, kind, **extra):
    room_id = _rooms[session]
    token = _token_for_room(room_id)
    payload = {"action": kind, "expected_revision": state["revision"], **extra}
    return client.post(f"/api/rooms/{room_id}/actions", headers={"X-Seat-Token": token}, json=payload)


def _token_for_room(room_id: str) -> str:
    # Re-connect to seat-1 to obtain a fresh token for the in-progress room.
    reconnected = client.post(f"/api/rooms/{room_id}/reconnect", json={"seat_id": "seat-1"})
    assert reconnected.status_code == 200
    return reconnected.json()["seat_token"]


def test_meta_and_v3_game_setup():
    meta = client.get("/api/meta").json()
    assert meta["schema_version"] == 3
    assert len(meta["roles"]) == 4
    assert len(meta["regions"]) == 5
    assert len(meta["sites"]) >= 18
    state = create("test-v3")
    assert state["mode"] == "heritage_network"
    assert state["schema_version"] == 3
    assert state["shared"]["current_event_id"] in {item["id"] for item in meta["events"]}
    assert len(state["market"]) == 3
    active_player = state["shared"]["active_player_id"]
    assert state["players"][active_player]["location"] == "pingcheng_ruins"
    assert state["action_options"]


def test_meta_effective_rules_preview_is_typed_and_keyed():
    response = client.get("/api/meta")
    assert response.status_code == 200
    previews = response.json()["effective_rules_preview"]
    assert previews
    for key, preview in previews.items():
        scenario_id, difficulty_id, play_mode = key.split(":")
        assert preview["scenario_id"] == scenario_id
        assert preview["difficulty_id"] == difficulty_id
        assert preview["play_mode"] == play_mode
        assert isinstance(preview["max_rounds"], int)
        assert isinstance(preview["restoration_resource"], int)


@pytest.mark.parametrize("raw_code,base_code", [
    ("invalid_action_card_discard", "invalid_action_card_discard"),
    ("unsupported_action_card_effect:unknown_effect", "unsupported_action_card_effect"),
    ("unsupported_effect:unknown_effect", "unsupported_effect"),
    ("unsupported_trigger:unknown_trigger", "unsupported_trigger"),
])
def test_dynamic_engine_errors_use_catalog_messages(monkeypatch, raw_code, base_code):
    state = create(f"error-catalog-{base_code}")

    def fail_dispatch(*_args, **_kwargs):
        raise ValueError(raw_code)

    monkeypatch.setattr("backend.routers.rooms.dispatch", fail_dispatch)
    response = action(f"error-catalog-{base_code}", state, state["shared"]["active_player_id"], "end_turn")
    detail = response.json()["detail"]
    errors = content.terminology["errors"]

    assert response.status_code == 400
    assert detail["code"] == raw_code
    assert detail["message"] == errors[base_code]
    assert "unknown_" not in detail["message"]


def test_market_explore_and_revision_conflict():
    session = "test-market"
    state = create(session)
    active_player = state["shared"]["active_player_id"]
    card = state["market"][0]
    updated = action(session, state, active_player, "explore", target_id="pingcheng_ruins", card_id=card).json()
    assert updated["revision"] == 1
    assert card in updated["players"][active_player]["hand"]
    assert len(updated["market"]) == 3
    conflict = action(session, state, active_player, "explore", target_id="pingcheng_ruins", card_id=card)
    assert conflict.status_code == 409
    assert conflict.json()["detail"]["code"] == "revision_conflict"


def test_role_skill_uses_ap_and_once_per_round():
    session = "test-skill"
    state = create(session)
    state_obj = repo.get(state["session_id"])
    state_obj.sites["pingcheng_ruins"].damage = 2
    state_obj.sites["pingcheng_ruins"].status = "at_risk"
    repo.save(state_obj)
    state = client.get(f"/api/rooms/{_rooms[session]}/game", headers={"X-Seat-Token": _token_for_room(_rooms[session])}).json()
    active_player = state["shared"]["active_player_id"]
    updated = action(session, state, active_player, "use_skill").json()
    assert updated["players"][active_player]["skill_used"] is True
    assert updated["sites"]["pingcheng_ruins"]["damage"] == 0
    assert updated["players"][active_player]["ap"] == 2


def test_event_choice_is_server_driven():
    session = "test-event-choice"
    state = create(session)
    state_obj = repo.get(state["session_id"])
    state_obj.shared.current_event_id = "route_blocked"
    state_obj.shared.player_order = [state_obj.shared.active_player_id]
    other_player = next(pid for pid in state_obj.players if pid != state_obj.shared.active_player_id)
    state_obj.players.pop(other_player)
    repo.save(state_obj)
    state = client.get(f"/api/rooms/{_rooms[session]}/game", headers={"X-Seat-Token": _token_for_room(_rooms[session])}).json()
    active_player = state["shared"]["active_player_id"]
    ended = action(session, state, active_player, "end_turn").json()
    assert ended["pending_choice"]["kind"] == "event"
    option_types = {item["type"] for item in ended["action_options"]}
    assert "resolve_event" in option_types
    assert all(item["label"] for item in ended["action_options"] if item["type"] == "use_action_card")
    resources_before = ended["shared"]["restoration_resource"]
    resolved = action(session, ended, active_player, "resolve_event", target_id="mitigate").json()
    assert resolved["pending_choice"] is None
    assert resolved["shared"]["restoration_resource"] == resources_before - 1


def test_move_is_route_driven():
    session = "test-move-route-current"
    state = create(session)
    active_player = state["shared"]["active_player_id"]
    updated = action(session, state, active_player, "move", target_id="yungang").json()
    assert updated["players"][active_player]["location"] == "yungang"
    assert updated["players"][active_player]["ap"] == 2


def test_same_seed_reproduces_opening_and_different_seed_changes_it():
    first = create("seed-first", seed=42)
    second = create("seed-second", seed=42)
    other = create("seed-other", seed=43)
    assert first["seed"] == second["seed"] == 42
    assert first["market"] == second["market"]
    assert first["shared"]["current_event_id"] == second["shared"]["current_event_id"]
    assert first["market"] != other["market"] or first["shared"]["current_event_id"] != other["shared"]["current_event_id"]


def test_scenario_changes_initial_rules_and_route_state():
    state = create("scenario-test", scenario_id="market_reopening", seed=7)
    assert state["scenario_id"] == "market_reopening"
    scenario = GameEngine().content.scenarios["market_reopening"]
    assert state["shared"]["max_rounds"] == scenario["max_rounds"]
    assert sum(route["status"] == "blocked" for route in state["routes"].values()) == scenario["blocked_route_count"]


def test_routes_are_single_records_and_move_from_either_endpoint():
    session = "test-undirected-route"
    state = create(session)
    pairs = {tuple(sorted((route["from_site"], route["to_site"]))) for route in state["routes"].values()}
    assert len(pairs) == len(state["routes"])
    stored = repo.get(state["session_id"])
    active_player = stored.shared.active_player_id
    stored.players[active_player].location = "yungang"
    repo.save(stored)
    state = client.get(f"/api/rooms/{_rooms[session]}/game", headers={"X-Seat-Token": _token_for_room(_rooms[session])}).json()
    updated = action(session, state, active_player, "move", target_id="pingcheng_ruins").json()
    assert updated["players"][active_player]["location"] == "pingcheng_ruins"


def test_prepare_event_consumes_flag_and_prevents_event_choice():
    session = "test-prepare-effect"
    state = create(session)
    stored = repo.get(state["session_id"])
    stored.shared.current_event_id = "route_blocked"
    players = list(stored.players)
    stored.shared.player_order = [players[0]]
    stored.players.pop(players[1])
    repo.save(stored)
    state = client.get(f"/api/rooms/{_rooms[session]}/game", headers={"X-Seat-Token": _token_for_room(_rooms[session])}).json()
    active_player = state["shared"]["active_player_id"]
    prepared = action(session, state, active_player, "prepare").json()
    assert "flags" not in prepared["players"][active_player]
    assert repo.get(state["session_id"]).players[active_player].flags["prepared_event_id"] == "route_blocked"
    ended = action(session, prepared, active_player, "end_turn").json()
    assert ended["pending_choice"] is None
    assert "prepared_event_ids" not in ended["shared"]
    assert repo.get(state["session_id"]).shared.prepared_event_ids == []


def test_route_blocked_event_changes_a_real_route_state():
    session = "test-route-blocked-target"
    state = create(session)
    stored = repo.get(state["session_id"])
    stored.shared.current_event_id = "route_blocked"
    players = list(stored.players)
    stored.shared.player_order = [players[0]]
    stored.players.pop(players[1])
    open_before = sum(route.status in {"open", "strained"} for route in stored.routes.values())
    repo.save(stored)
    state = client.get(f"/api/rooms/{_rooms[session]}/game", headers={"X-Seat-Token": _token_for_room(_rooms[session])}).json()
    active_player = state["shared"]["active_player_id"]
    ended = action(session, state, active_player, "end_turn").json()
    open_after = sum(route["status"] in {"open", "strained"} for route in ended["routes"].values())
    assert open_after == open_before - 1
    assert ended["pending_choice"]["kind"] == "event"


def test_action_card_requires_a_route_target_before_resolution():
    session = "test-action-card-target"
    state = create(session)
    stored = repo.get(state["session_id"])
    active_player = stored.shared.active_player_id
    stored.players[active_player].action_hand = ["action_01"]
    route = next(route for route in stored.routes.values() if stored.players[active_player].location in {route.from_site, route.to_site})
    route.status = "strained"
    repo.save(stored)
    state = client.get(f"/api/rooms/{_rooms[session]}/game", headers={"X-Seat-Token": _token_for_room(_rooms[session])}).json()
    choosing = action(session, state, active_player, "use_action_card", card_id="action_01").json()
    assert choosing["pending_choice"]["kind"] == "action_card"
    target = choosing["action_options"][0]["targets"][0]["id"]
    resolved = action(session, choosing, active_player, "use_action_card", card_id="action_01", target_id=target).json()
    assert resolved["pending_choice"] is None
    assert "action_01" not in resolved["players"][active_player]["action_hand"]


def test_card_has_archive_and_discard_paths():
    session = "test-card-dual-use"
    state = create(session)
    active_player = state["shared"]["active_player_id"]
    assert state["decks"]["action"]
    card = state["market"][0]
    explored = action(session, state, active_player, "explore", target_id="pingcheng_ruins", card_id=card).json()
    played = action(session, explored, active_player, "play_card", card_id=card).json()
    assert card in played["decks"]["discard"]


def test_revision_conflict_returns_public_state_without_persistence_fields():
    state = create("revision-conflict", difficulty_id="guided", scenario_id="sand_and_stone")
    session_id = state["session_id"]
    response = client.post(
        f"/api/rooms/{_rooms['revision-conflict']}/actions",
        headers={"X-Seat-Token": _token_for_room(_rooms["revision-conflict"])},
        json={"action": "end_turn", "expected_revision": -1},
    )

    assert response.status_code == 409
    current = response.json()["detail"]["current_state"]
    assert current["session_id"] == session_id
    assert "flags" not in current["players"][state["shared"]["active_player_id"]]
    assert "rng_state" not in current
    assert "processed_request_ids" not in current


def test_round_enters_player_action_without_manual_planning_step():
    session = "test-planning-phase"
    state = create(session)
    stored = repo.get(state["session_id"])
    stored.shared.current_event_id = "pilgrims"
    repo.save(stored)
    players = list(stored.players)
    first = action(session, client.get(f"/api/rooms/{_rooms[session]}/game", headers={"X-Seat-Token": _token_for_room(_rooms[session])}).json(), players[0], "end_turn").json()
    second = action(session, first, players[1], "end_turn").json()
    assert second["shared"]["phase"] == "player_action"
    assert second["shared"]["planning_marks"] == {}
    assert any(item["type"] == "move" for item in second["action_options"])


def test_event_targets_are_seed_deterministic():
    first = create("event-targets-1", seed=91)
    second = create("event-targets-2", seed=91)
    assert first["shared"]["event_targets"] == second["shared"]["event_targets"]
    assert first["shared"]["event_instance"]["revealed_targets"] == second["shared"]["event_instance"]["revealed_targets"]


def test_non_route_action_card_requires_human_target():
    session = "test-action-card-player-target"
    state = create(session)
    stored = repo.get(state["session_id"])
    active_player = stored.shared.active_player_id
    stored.players[active_player].action_hand = ["action_11"]
    other_player = next(pid for pid in stored.players if pid != active_player)
    stored.players[other_player].location = stored.players[active_player].location
    repo.save(stored)
    state = client.get(f"/api/rooms/{_rooms[session]}/game", headers={"X-Seat-Token": _token_for_room(_rooms[session])}).json()
    choosing = action(session, state, active_player, "use_action_card", card_id="action_11").json()
    assert choosing["pending_choice"]["kind"] == "action_card"
    assert choosing["action_options"][0]["targets"][0]["id"] == other_player
