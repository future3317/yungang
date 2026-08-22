from backend.content import Content
from backend.engine import GameEngine
from backend.mechanisms import ACTION_CARD_EFFECT_HANDLERS, NODE_EFFECT_HANDLERS


def test_event_chain_preserves_previous_event_before_revealing_next():
    engine = GameEngine()
    state = engine.new_game("event-chain-contract", ["p1"], scenario_id="sand_and_stone", solo_mode=False)
    state.shared.player_order = ["p1"]
    state.shared.active_player_id = "p1"
    state.shared.current_event_id = "sandstorm"
    state.shared.event_targets = ["yungang"]
    state.shared.event_instance = {"event_id": "sandstorm", "revealed_targets": ["yungang"], "resolution": [], "status": "forecast"}
    engine._end_turn(state, state.players["p1"])
    assert state.shared.round_summary["event_id"] == "sandstorm"
    assert state.shared.round_summary["event_targets"] == ["yungang"]
    assert any(item.get("event_id") == "sandstorm" for item in state.shared.event_history)
    assert state.shared.current_event_id != "sandstorm"


def test_all_action_cards_and_node_abilities_have_registered_effects():
    content = Content()
    for card in content.action_cards.values():
        effect_type = card.get("effect", {}).get("type")
        assert effect_type in ACTION_CARD_EFFECT_HANDLERS, card["id"]
    for site in content.sites.values():
        ability = site.get("node_ability") or {}
        if ability:
            assert ability.get("effect", {}).get("type") in NODE_EFFECT_HANDLERS, site["id"]


def test_panorama_reduction_uses_current_round_progress_not_historical_state():
    engine = GameEngine()
    state = engine.new_game("panorama-round-rule", ["p1"], scenario_id="panorama_unfolding")
    project = next(iter(state.projects.values()))
    route = next(iter(state.routes.values()))
    project.completed_stages = ["stage_already_completed"]
    route.status = "restored"
    state.shared.weathering_track = 3
    state.shared.scenario_round_baseline = {
        "project_completed_stages": {project.id: len(project.completed_stages)},
        "route_statuses": {route.id: route.status},
    }

    context = engine._scenario_round_context(state, {"round": state.shared.turn})

    assert context["completed_project_stages"] == 0
    assert context["restored_routes"] == 0
    assert engine._emit_scenario_rule(state, "round_end", context) == []
    assert state.shared.weathering_track == 3


def test_scenario_rules_apply_their_declared_runtime_effects():
    cases = [
        ("sand_and_stone", "after_restore"),
        ("civilization_confluence", "after_interpret_evidence"),
        ("market_reopening", "after_establish_connection"),
        ("panorama_unfolding", "round_end"),
        ("rainy_season", "round_end"),
        ("digital_archive", "after_explore"),
    ]

    for scenario_id, trigger in cases:
        engine = GameEngine()
        state = engine.new_game(f"scenario-rule-{scenario_id}", ["p1", "p2"], scenario_id=scenario_id)
        player = state.players["p1"]
        before_clues = state.shared.research_clues
        before_weathering = state.shared.weathering_track
        context = {"player_id": player.id, "site_id": player.location, "task": {"contributing_player_ids": ["p1", "p2"]}}

        if scenario_id == "sand_and_stone":
            state.shared.planning_marks = {"p2": [{"target_id": player.location, "turn": str(state.shared.turn)}]}
        elif scenario_id == "panorama_unfolding":
            project = next(iter(state.projects.values()))
            route = next(iter(state.routes.values()))
            project.completed_stages.append("stage_this_round")
            route.status = "restored"
            state.shared.scenario_round_baseline = {
                "project_completed_stages": {project.id: len(project.completed_stages) - 1},
                "route_statuses": {route.id: "strained"},
            }

        effects = engine._emit_scenario_rule(state, trigger, engine._scenario_round_context(state, context))

        assert effects, scenario_id
        if scenario_id == "sand_and_stone":
            assert state.shared.planning_marks["p2"][0]["target_id"] != player.location
        elif scenario_id in {"civilization_confluence", "digital_archive"}:
            assert state.shared.research_clues > before_clues
        elif scenario_id == "market_reopening":
            assert any(item.flags.get("next_move_discount") == 1 for item in state.players.values())
        elif scenario_id == "panorama_unfolding":
            assert state.shared.weathering_track == before_weathering - 1
        elif scenario_id == "rainy_season":
            assert state.shared.weathering_track == before_weathering + 1
