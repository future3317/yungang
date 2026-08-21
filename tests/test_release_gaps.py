from backend.app import app, engine, repo
from fastapi.testclient import TestClient


client = TestClient(app)


def test_discarded_evidence_enters_discard_pile_before_explore():
    state = engine.new_game("discard-semantics", ["p1"], solo_mode=False)
    player = state.players["p1"]
    discarded = state.decks["culture"].pop(0)
    player.hand = [discarded]
    next_card = state.market[0]
    state.pending_choice = {"kind": "discard", "next_card_id": next_card}
    engine._resolve_choice(state, {"action": "discard", "card_id": discarded})
    assert discarded not in player.hand
    assert discarded in state.decks["discard"]
    assert next_card in player.hand


def test_event_response_action_card_keeps_timing_and_declared_mitigation():
    state = engine.new_game("event-card-semantics", ["p1"], solo_mode=False)
    player = state.players["p1"]
    route = next(route for route in state.routes.values() if player.location in {route.from_site, route.to_site})
    route.status = "blocked"
    route.risk = 2
    player.action_hand = ["action_09"]
    state.decks["action"] = ["action_10"]
    state.shared.phase = "pending_choice"
    state.shared.threat = 2
    state.pending_choice = {"kind": "event", "event_id": "route_blocked", "options": []}
    engine._use_action_card(state, player, "action_09", target_id=route.id, force_event_response=True)
    assert player.ap == 2
    assert route.status == "strained"
    assert route.risk == 1
    assert state.shared.threat == 1
    assert "action_09" in state.decks["action_discard"]
    assert player.action_hand


def test_room_session_cannot_be_read_through_legacy_game_endpoint():
    created = client.post("/api/rooms", json={"play_mode": "multi_device", "name": "测试者", "role_id": "pingcheng_artisan", "scenario_id": "sand_and_stone", "difficulty_id": "normal", "max_players": 2})
    assert created.status_code == 200
    room = created.json()["room"]
    token = created.json()["seat_token"]
    joined = client.post(f"/api/rooms/{room['room_id']}/join", json={"name": "同行者", "role_id": "western_dancer"})
    assert joined.status_code == 200
    assert client.post(f"/api/rooms/{room['room_id']}/ready", headers={"X-Seat-Token": token}, json={"ready": True}).status_code == 200
    other_token = joined.json()["seat_token"]
    assert client.post(f"/api/rooms/{room['room_id']}/ready", headers={"X-Seat-Token": other_token}, json={"ready": True}).status_code == 200
    started = client.post(f"/api/rooms/{room['room_id']}/start", headers={"X-Seat-Token": token})
    assert started.status_code == 200
    session_id = started.json()["session_id"]
    assert client.get(f"/api/games/{session_id}").status_code == 403
    assert repo.get(session_id) is not None


def test_protection_objective_requires_visiting_stable_sites():
    state = engine.new_game("objective-protection", ["p1"], scenario_id="sand_and_stone")
    objective = state.objectives["objective_protect_core"]
    assert objective.progress == 0
    assert objective.completed is False

    stable_site = next(iter(state.sites.values()))
    stable_site.damage = 0
    engine._update_site(stable_site)
    state.sites[stable_site.id].discovered = True
    engine.refresh(state)
    assert objective.progress == 1
    assert objective.completed is False


def test_round_change_enters_player_action_without_manual_planning_step():
    state = engine.new_game("round-action-flow", ["p1", "p2"], scenario_id="sand_and_stone")
    state.shared.current_event_id = None
    state.shared.active_player_id = "p2"
    state.shared.planning_marks = {"p1": [{"target_id": next(iter(state.sites)), "turn": "1"}]}
    engine._end_turn(state, state.players["p2"])
    assert state.shared.phase == "player_action"
    assert not state.shared.planning_marks
    assert any(action["type"] == "move" for action in state.legal_actions)


def test_ready_interpretation_is_available_while_ap_remains():
    state = engine.new_game("interpretation-ready", ["p1"], scenario_id="sand_and_stone")
    player = state.players["p1"]
    task = state.tasks[engine.content.sites[player.location]["active_task_id"]]
    card = next(card_id for card_id, definition in engine.content.cards.items() if definition.get("domain") in task["required_domains"])
    task["required_card_count"] = 1
    task["required_origin_diversity"] = 1
    task["required_domains"] = [engine.content.cards[card]["domain"]]
    task["combo_requirement"] = {}
    player.hand = [card]
    player.ap = 2
    engine._interpret_evidence(state, player, player.location, card, "support")
    engine.refresh(state)
    assert any(action["type"] == "form_interpretation" for action in state.legal_actions)
