import pytest

from backend.engine import GameEngine


def _state_with_card(card_id: str):
    engine = GameEngine()
    state = engine.new_game(f"card-{card_id}", ["p1", "p2"], solo_mode=False)
    player = state.players["p1"]
    player.action_hand = [card_id]
    player.ap = 5
    state.decks["action"] = []
    state.shared.phase = "player_action"
    state.shared.current_event_id = "sandstorm"
    return engine, state, player


def _adjacent_route(state, player, status="strained", risk=2):
    route = next(route for route in state.routes.values() if player.location in {route.from_site, route.to_site})
    route.status = status
    route.risk = risk
    return route


@pytest.mark.parametrize("card_id", [f"action_{index:02d}" for index in range(1, 17)])
def test_every_strategy_card_applies_its_declared_effect(card_id):
    engine, state, player = _state_with_card(card_id)
    route = _adjacent_route(state, player, "restored" if card_id == "action_03" else "blocked" if card_id == "action_09" else "strained")
    if card_id in {"action_02", "action_10"}:
        state.shared.research_clues = 1
    if card_id == "action_03":
        route.status = "restored"
    if card_id == "action_07":
        player.hand = [next(iter(engine.content.cards))]
        state.players["p2"].location = next(site for site in state.sites if site != player.location)
    if card_id in {"action_11", "action_15"}:
        state.players["p2"].location = player.location
    if card_id == "action_09":
        state.pending_choice = {"kind": "event", "event_id": "sandstorm", "options": []}
        state.shared.phase = "pending_choice"
        state.shared.weathering_track = 2
    target = route.id if card_id not in {"action_04", "action_08", "action_12", "action_16"} else None
    target_ids = ["p1", "p2"] if card_id == "action_12" else None
    if card_id == "action_16":
        target = "p1"
    if card_id == "action_07":
        target = "p2"
    if card_id in {"action_11", "action_15"}:
        target = "p2"
        state.shared.restoration_resource = 2
        state.players["p2"].ap = 1
    before = {
        "ap": player.ap,
        "weathering": state.shared.weathering_track,
        "clues": state.shared.research_clues,
        "restoration": state.shared.restoration_resource,
        "route_risk": route.risk,
        "route_status": route.status,
        "p2_ap": state.players["p2"].ap,
        "p2_supplies": state.players["p2"].supplies,
    }
    engine._use_action_card(state, player, card_id, target_id=target, target_ids=target_ids, force_event_response=card_id == "action_09")
    assert player.ap == before["ap"] - 1
    if card_id in {"action_01", "action_05", "action_06", "action_09", "action_13", "action_14"}:
        assert route.risk < before["route_risk"]
    if card_id in {"action_02", "action_03", "action_10"}:
        assert route.status in {"restored", "illuminated"}
    if card_id in {"action_01", "action_05", "action_09", "action_13", "action_14"}:
        expected_clues = 1 if card_id in {"action_01", "action_13", "action_14"} else 0
        assert state.shared.research_clues == before["clues"] + expected_clues
    if card_id == "action_04":
        assert player.flags["prepared_event_id"] == "sandstorm"
        assert state.shared.weathering_track == before["weathering"]
    if card_id == "action_07":
        assert player.flags["remote_exchange_player_id"] == "p2"
    if card_id == "action_08":
        assert player.flags["reserved_ap"] == 1
    if card_id == "action_09":
        assert state.shared.weathering_track == before["weathering"] - 1
    if card_id == "action_10":
        assert player.flags["free_move"] is True
        assert state.shared.restoration_resource == before["restoration"]
    if card_id == "action_11":
        assert state.players["p2"].supplies == before["p2_supplies"] + 1
        assert state.shared.restoration_resource == before["restoration"] - 1
    if card_id == "action_12":
        assert state.players["p2"].flags["prepared_event_id"] == "sandstorm"
    if card_id == "action_15":
        assert state.players["p2"].ap == before["p2_ap"] + 1
        assert state.shared.restoration_resource == before["restoration"]
    if card_id == "action_16":
        assert player.flags["prepared_event_id"] == "sandstorm"
    assert card_id not in player.action_hand
    assert card_id in state.decks["action_discard"]


def test_reserve_ap_is_available_on_this_player_next_turn():
    engine, state, player = _state_with_card("action_08")
    engine._use_action_card(state, player, "action_08")
    assert player.ap == 4
    engine._end_turn(state, player)
    assert player.ap == player.max_ap + 1


@pytest.mark.parametrize("card_id", [f"action_{index:02d}" for index in range(1, 17)])
def test_every_strategy_card_rejects_wrong_timing(card_id):
    engine, state, player = _state_with_card(card_id)
    state.shared.phase = "planning"
    with pytest.raises(ValueError, match="action_card_wrong_timing"):
        engine._use_action_card(state, player, card_id)


@pytest.mark.parametrize("card_id", ["action_01", "action_02", "action_03", "action_05", "action_06", "action_09", "action_10", "action_13", "action_14"])
def test_route_strategy_cards_reject_invalid_target(card_id):
    engine, state, player = _state_with_card(card_id)
    state.shared.phase = "pending_choice" if card_id == "action_09" else "player_action"
    if card_id == "action_09":
        state.pending_choice = {"kind": "event", "event_id": "sandstorm", "options": []}
    with pytest.raises(ValueError, match="(no_valid_action_card_target|invalid_action_card_target)"):
        engine._use_action_card(state, player, card_id, target_id="not-a-route", force_event_response=card_id == "action_09")


def test_project_progress_effect_advances_stage_state_consistently():
    engine = GameEngine()
    state = engine.new_game("project-effect", ["p1"])
    player = state.players["p1"]
    project = state.projects[state.sites[player.location].active_project_id]
    stage = project.stages[project.stage_index]
    stage["required_progress"] = 1
    stage["requirements"] = {}
    engine._apply_node_effect(state, player, player.location, {"type": "project_progress", "amount": 1})
    assert project.stage_progress[stage.get("id", "0")] == 1
    assert project.stage_index == 1 or project.status == "completed"


def test_project_progress_effect_grants_the_completed_stage_reward():
    engine = GameEngine()
    state = engine.new_game("project-effect-reward", ["p1"])
    player = state.players["p1"]
    project = state.projects[state.sites[player.location].active_project_id]
    stage = project.stages[project.stage_index]
    stage["required_progress"] = 1
    stage["requirements"] = {}
    stage["reward"] = {"research_clues": 2}
    before_clues = state.shared.research_clues

    engine._apply_node_effect(state, player, player.location, {"type": "project_progress", "amount": 1})

    assert state.shared.research_clues == before_clues + 2


def test_using_strategy_card_does_not_draw_again_until_the_next_round():
    engine = GameEngine()
    state = engine.new_game("action-card-no-refill", ["p1"], solo_mode=False)
    player = state.players["p1"]
    player.action_hand = ["action_08"]
    player.ap = 5
    state.decks["action"] = ["action_01"]
    state.shared.phase = "player_action"
    state.shared.current_event_id = "sandstorm"

    engine._use_action_card(state, player, "action_08")

    assert player.action_hand == []
    assert state.decks["action"] == ["action_01"]
    assert engine._draw_action_card(state, player) is False
    assert player.action_hand == []

    state.shared.turn += 1
    assert engine._draw_action_card(state, player) is True
    assert player.action_hand == ["action_01"]


def test_strategy_card_option_does_not_advertise_card_id_as_route_target():
    engine, state, player = _state_with_card("action_02")
    for route in state.routes.values():
        route.status = "open"
    state = engine.refresh(state)

    option = next(item for item in state.action_options if item.type == "use_action_card" and item.payload.get("card_id") == "action_02")
    assert option.enabled is False
    assert option.targets == []
