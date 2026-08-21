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


@pytest.mark.parametrize(
    ("card_id", "effect_check"),
    [
        ("action_01", lambda engine, state, player, route: (setattr(route, "risk", 1), setattr(state.shared, "research_clues", 1))),
        ("action_02", lambda engine, state, player, route: setattr(route, "status", "restored")),
        ("action_03", lambda engine, state, player, route: setattr(route, "status", "illuminated")),
        ("action_04", lambda engine, state, player, route: state.players["p1"].flags.__setitem__("prepared_event_id", "sandstorm")),
        ("action_05", lambda engine, state, player, route: setattr(route, "risk", 1)),
        ("action_06", lambda engine, state, player, route: setattr(route, "risk", 0)),
        ("action_07", lambda engine, state, player, route: player.flags.__setitem__("remote_exchange_player_id", "p2")),
        ("action_08", lambda engine, state, player, route: player.flags.__setitem__("reserved_ap", 1)),
        ("action_09", lambda engine, state, player, route: setattr(state.shared, "threat", 1)),
        ("action_10", lambda engine, state, player, route: setattr(route, "status", "restored")),
        ("action_11", lambda engine, state, player, route: setattr(state.players["p2"], "supplies", 1)),
        ("action_12", lambda engine, state, player, route: state.players["p2"].flags.__setitem__("prepared_event_id", "sandstorm")),
        ("action_13", lambda engine, state, player, route: setattr(route, "risk", 1)),
        ("action_14", lambda engine, state, player, route: setattr(state.shared, "research_clues", 1)),
        ("action_15", lambda engine, state, player, route: setattr(state.players["p2"], "supplies", 1)),
        ("action_16", lambda engine, state, player, route: player.flags.__setitem__("prepared_event_id", "sandstorm")),
    ],
)
def test_every_strategy_card_applies_its_declared_effect(card_id, effect_check):
    engine, state, player = _state_with_card(card_id)
    route = _adjacent_route(state, player, "restored" if card_id == "action_03" else "blocked" if card_id == "action_09" else "strained")
    if card_id in {"action_02", "action_10"}:
        state.shared.research_clues = 0
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
        state.shared.threat = 2
    target = route.id if card_id not in {"action_04", "action_08", "action_12", "action_16"} else None
    target_ids = ["p1", "p2"] if card_id == "action_12" else None
    if card_id == "action_16":
        target = "p1"
    if card_id == "action_07":
        target = "p2"
    if card_id in {"action_11", "action_15"}:
        target = "p2"
        state.shared.restoration_resource = 2
    engine._use_action_card(state, player, card_id, target_id=target, target_ids=target_ids, force_event_response=card_id == "action_09")
    effect_check(engine, state, player, route)
    assert card_id not in player.action_hand
    assert card_id in state.decks["action_discard"]


def test_reserve_ap_is_available_on_this_player_next_turn():
    engine, state, player = _state_with_card("action_08")
    engine._use_action_card(state, player, "action_08")
    assert player.ap == 4
    engine._end_turn(state, player)
    assert player.ap == player.max_ap + 1


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
