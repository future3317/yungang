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
