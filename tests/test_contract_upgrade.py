from backend.engine import GameEngine


def test_action_options_are_the_ranked_player_contract():
    engine = GameEngine()
    state = engine.new_game("contract-options", ["p1"], solo_mode=False)
    assert state.action_options
    assert all(option.type != "contribute" for option in state.action_options)
    assert all(option.reason and option.recommendation_score >= 0 for option in state.action_options)
    assert state.goal_status.weathering_limit == state.shared.weathering_limit


def test_action_feedback_is_returned_by_the_server_state():
    engine = GameEngine()
    state = engine.new_game("contract-feedback", ["p1"], solo_mode=False)
    result = engine.apply(state, {"player_id": "p1", "action": "end_turn", "request_id": "feedback-1"})
    assert result.feedback_events
    assert "行动" in result.feedback_events[0].message or "交接" in result.feedback_events[0].message
    assert all({"metric", "label", "before", "after", "delta"}.issubset(change.model_fields) for change in result.feedback_events[0].changes)


def test_action_options_include_effect_preview_not_only_ap():
    engine = GameEngine()
    state = engine.new_game("contract-preview", ["p1"], solo_mode=False)
    player = state.players["p1"]
    site = state.sites[player.location]
    site.damage = 1
    engine.refresh(state)
    restore = next(option for option in state.action_options if option.type == "restore")
    assert restore.preview_delta.get("restoration_resource") == -1
    assert restore.preview_delta.get("damage") == -1


def test_target_route_preview_contains_declared_resource_and_risk_changes():
    engine = GameEngine()
    state = engine.new_game("contract-route-preview", ["p1"], solo_mode=False)
    player = state.players["p1"]
    route = next(route for route in state.routes.values() if player.location in {route.from_site, route.to_site})
    route.status = "strained"
    route.risk = 2
    state.shared.research_clues = 1
    engine.refresh(state)
    option = next(option for option in state.action_options if option.type == "restore_route")
    target = next(target for target in option.targets if target.payload.get("route_id") == route.id)
    assert target.preview_delta["research_clues"] == -1
    assert target.preview_delta["risk"] == -2


def test_round_summary_keeps_previous_event_targets():
    engine = GameEngine()
    state = engine.new_game("contract-summary", ["p1"], solo_mode=False)
    state.shared.event_targets = ["old-site"]
    state.shared.event_instance = {"resolution": [{"label": "旧事件"}]}
    summary = engine._build_round_summary(state, {"round": 1, "event_id": "old-event", "event_targets": ["old-site"], "planning_marks": {"p1": [{"target_id": "old-site"}]}, "weathering_track": 1, "restoration_resource": 4})
    state.shared.event_targets = ["new-site"]
    assert summary["event_id"] == "old-event"
    assert summary["event_targets"] == ["old-site"]
    assert summary["planning_mark_count"] == 1
