from copy import deepcopy

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
    state.shared.weathering_track = 2
    state.pending_choice = {"kind": "event", "event_id": "route_blocked", "options": []}
    engine._use_action_card(state, player, "action_09", target_id=route.id, force_event_response=True)
    assert player.ap == 2
    assert route.status == "strained"
    assert route.risk == 1
    assert state.shared.weathering_track == 1
    assert "action_09" in state.decks["action_discard"]
    assert player.action_hand == []
    assert "action_10" in state.decks["action"]


def test_event_choice_returns_refreshed_state_after_round_finalization():
    state = engine.new_game("event-choice-return", ["p1"], scenario_id="sand_and_stone")
    route = next(iter(state.routes.values()))
    state.shared.phase = "pending_choice"
    state.shared.event_targets = [route.id]
    state.shared.event_instance = {
        "event_id": "route_blocked",
        "revealed_targets": [route.id],
        "resolved_targets": [],
        "mitigation": [],
        "resolution": [],
        "status": "forecast",
    }
    state.pending_choice = {"kind": "event", "event_id": "route_blocked", "options": []}

    result = engine.apply(state, {"player_id": "p1", "action": "resolve_event", "target_id": "accept"})

    assert result is state
    assert result.pending_choice is None
    assert result.shared.phase == "player_action"
    assert result.action_options


def test_refresh_preview_does_not_crash_for_event_choice():
    state = engine.new_game("event-choice-preview", ["p1"], scenario_id="sand_and_stone")
    route = next(iter(state.routes.values()))
    state.shared.phase = "pending_choice"
    state.shared.event_targets = [route.id]
    state.shared.event_instance = {
        "event_id": "route_blocked",
        "revealed_targets": [route.id],
        "resolved_targets": [],
        "mitigation": [],
        "resolution": [],
        "status": "forecast",
    }
    state.pending_choice = {"kind": "event", "event_id": "route_blocked", "options": []}

    refreshed = engine.refresh(state)

    assert refreshed is state
    assert isinstance(refreshed.action_options, list)


def test_other_player_completing_planned_site_triggers_collaboration_reward():
    state = engine.new_game("planning-collaboration", ["p1", "p2"], scenario_id="sand_and_stone")
    player = state.players[state.shared.active_player_id]
    target = player.location
    card = state.market[0]
    before_ap = player.ap
    baseline = deepcopy(state)
    baseline.shared.planning_marks = {}
    state.shared.planning_marks = {"p2": [{"target_id": target, "turn": str(state.shared.turn)}]}

    baseline_result = engine.apply(baseline, {"player_id": player.id, "action": "explore", "target_id": target, "card_id": card})
    result = engine.apply(state, {"player_id": player.id, "action": "explore", "target_id": target, "card_id": card})

    mark = result.shared.planning_marks["p2"][0]
    assert mark["collaborated"] is True
    assert result.players[player.id].ap == baseline_result.players[player.id].ap + 1 == before_ap
    assert result.shared.research_clues == baseline_result.shared.research_clues + 1


def test_route_plan_collaboration_reduces_risk_beyond_route_survey():
    state = engine.new_game("planning-route-collaboration", ["p1", "p2"], scenario_id="sand_and_stone")
    player = state.players[state.shared.active_player_id]
    route = next(route for route in state.routes.values() if player.location in {route.from_site, route.to_site})
    route.risk = 2
    route.status = "strained"
    baseline = deepcopy(state)
    baseline.shared.planning_marks = {}
    state.shared.planning_marks = {"p2": [{"target_id": route.id, "turn": str(state.shared.turn)}]}
    request = {"player_id": player.id, "action": "survey_route", "target_id": route.to_site if route.from_site == player.location else route.from_site, "route_id": route.id}

    baseline_result = engine.apply(baseline, request)
    result = engine.apply(state, request)

    assert result.routes[route.id].risk == max(0, baseline_result.routes[route.id].risk - 1)
    assert result.shared.planning_marks["p2"][0]["collaborated"] is True


def test_refresh_keeps_intent_board_marks_until_round_settlement():
    state = engine.new_game("planning-board-persistence", ["p1", "p2"], scenario_id="sand_and_stone")
    target = next(iter(state.sites))
    state.shared.planning_marks = {"p2": [{"target_id": target, "turn": str(state.shared.turn)}]}

    engine.refresh(state)

    assert state.shared.phase == "player_action"
    assert state.shared.planning_marks["p2"][0]["target_id"] == target


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
    assert any(action.type == "move" for action in state.action_options)


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
    assert any(action.type == "form_interpretation" for action in state.action_options)


def test_interpretation_evaluator_is_single_source_for_progress_and_legality():
    state = engine.new_game("interpretation-evaluator", ["p1"], scenario_id="sand_and_stone")
    player = state.players["p1"]
    task = state.tasks[engine.content.sites[player.location]["active_task_id"]]
    task["required_card_count"] = 2
    task["required_origin_diversity"] = 2
    task["required_domains"] = []
    task["combo_requirement"] = {}
    cards = list(engine.content.cards)[:2]
    task["interpretation"]["placements"] = [
        {"card_id": cards[0], "relation": "support", "origin_tags": ["中原"], "combo_tags": []},
        {"card_id": cards[1], "relation": "conflict", "origin_tags": ["西域"], "combo_tags": []},
    ]
    evaluation = engine._evaluate_interpretation(task)
    assert evaluation["cards"] == 1
    assert evaluation["origins"] == ["中原"]
    assert evaluation["can_form"] is False
    assert "还需要" in evaluation["reason"]
    state = engine.refresh(state)
    progress = state.tasks[task["id"]]["progress"]["interpretation"]
    assert progress == engine._evaluate_interpretation(state.tasks[task["id"]])


def test_intervention_preview_delta_matches_real_execution():
    state = engine.new_game("intervention-preview-contract", ["p1"], scenario_id="sand_and_stone")
    player = state.players["p1"]
    task = state.tasks[engine.content.sites[player.location]["active_task_id"]]
    card = next(card_id for card_id, definition in engine.content.cards.items() if definition.get("domain") in task["required_domains"])
    task["required_card_count"] = 1
    task["required_origin_diversity"] = 1
    task["required_domains"] = [engine.content.cards[card]["domain"]]
    task["combo_requirement"] = {}
    player.hand = [card]

    engine.apply(state, {"player_id": player.id, "action": "interpret_evidence", "target_site_id": player.location, "target_id": "support", "card_id": card})
    engine.apply(state, {"player_id": player.id, "action": "form_interpretation", "target_id": player.location})
    option = next(item for item in state.action_options if item.type == "choose_intervention" and item.enabled and item.targets)
    target = option.targets[0]
    request = {"player_id": player.id, "action": "choose_intervention", "target_site_id": player.location, "target_id": target.payload["target_id"]}
    before = engine._preview_snapshot(state, request)
    actual = engine.apply(deepcopy(state), request)
    after = engine._preview_snapshot(actual, request)
    expected = {key: after[key] - value for key, value in before.items() if isinstance(value, (int, float)) and after.get(key) != value}

    assert option.targets[0].preview_delta == expected


def test_strategy_cards_remain_visible_when_their_timing_is_not_available():
    state = engine.new_game("strategy-card-readable-timing", ["p1"], solo_mode=False)
    player = state.players["p1"]
    card_id = next(iter(engine.content.action_cards))
    player.action_hand = [card_id]
    definition = engine.content.action_cards[card_id]
    original_timing = definition.get("timing")
    try:
        definition["timing"] = "事件响应"
        state.pending_choice = None
        engine.refresh(state)

        option = next(item for item in state.action_options if item.type == "use_action_card")
        assert option.label == definition["name"]
        assert option.enabled is False
        assert "事件响应" in (option.disabled_reason or "")
        assert player.action_hand == [card_id]
    finally:
        if original_timing is None:
            definition.pop("timing", None)
        else:
            definition["timing"] = original_timing


def test_interpretation_requires_declared_distinct_contributors():
    state = engine.new_game("interpretation-contributors", ["p1", "p2"], solo_mode=False)
    player = state.players["p1"]
    task = state.tasks[engine.content.sites[player.location]["active_task_id"]]
    card = next(card_id for card_id, definition in engine.content.cards.items() if definition.get("domain") in task["required_domains"])
    task["required_card_count"] = 1
    task["required_origin_diversity"] = 1
    task["required_domains"] = [engine.content.cards[card]["domain"]]
    task["combo_requirement"] = {"minimum_distinct_players": 2}
    task["interpretation"]["placements"] = [{"card_id": card, "relation": "support", "player_id": "p1"}]

    evaluation = engine._evaluate_interpretation(task)

    assert evaluation["contributors"] == ["p1"]
    assert evaluation["missing_contributors"] == 1
    assert evaluation["can_form"] is False
    assert "1 位不同同行者" in evaluation["reason"]


def test_event_response_keeps_non_response_strategy_cards_readable():
    state = engine.new_game("event-card-readable-response", ["p1"], solo_mode=False)
    player = state.players["p1"]
    card_id = next(iter(engine.content.action_cards))
    player.action_hand = [card_id]
    definition = engine.content.action_cards[card_id]
    original_timing = definition.get("timing")
    try:
        definition["timing"] = "事件预告"
        state.pending_choice = {"kind": "event", "options": []}
        engine.refresh(state)
        option = next(item for item in state.action_options if item.type == "use_action_card")
        assert option.label == definition["name"]
        assert option.enabled is False
        assert "事件预告" in (option.disabled_reason or "")
    finally:
        if original_timing is None:
            definition.pop("timing", None)
        else:
            definition["timing"] = original_timing
