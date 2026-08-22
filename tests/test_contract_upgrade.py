from backend.engine import GameEngine
from backend.models import ProjectStatus, ResultState, SiteStatus, ViewerState
import pytest


def test_action_options_are_the_ranked_player_contract():
    engine = GameEngine()
    state = engine.new_game("contract-options", ["p1"], solo_mode=False)
    assert state.action_options
    assert all(option.type != "contribute" for option in state.action_options)
    assert all(option.reason and option.recommendation_score >= 0 for option in state.action_options)
    assert state.goal_status.weathering_limit == state.shared.weathering_limit
    assert all(condition.related_labels for condition in state.goal_status.victory_conditions if condition.related_ids)


def test_action_options_expose_human_readable_requirements():
    engine = GameEngine()
    state = engine.new_game("action-requirements", ["p1"], solo_mode=False)

    move = next(option for option in state.action_options if option.type == "move")
    explore = next(option for option in state.action_options if option.type == "explore")
    end_turn = next(option for option in state.action_options if option.type == "end_turn")

    assert any("路线" in requirement and "通行" in requirement for requirement in move.requirements)
    assert any("手牌" in requirement for requirement in explore.requirements)
    assert any("结束当前行动" in requirement for requirement in end_turn.requirements)


@pytest.mark.parametrize(
    ("reason", "setup"),
    [
        ("too_many_closed_sites", lambda state: [setattr(site, "status", SiteStatus.CLOSED) for site in list(state.sites.values())[:2]]),
        ("weathering_track_reached_limit", lambda state: setattr(state.shared, "weathering_track", state.shared.weathering_limit)),
        ("round_limit_reached", lambda state: setattr(state.shared, "turn", state.shared.max_rounds + 1)),
    ],
)
def test_each_failure_path_writes_a_specific_result(reason, setup):
    engine = GameEngine()
    state = engine.new_game(f"result-{reason}", ["p1"], scenario_id="sand_and_stone")
    setup(state)

    engine._check_outcome(state)

    assert state.shared.outcome == "defeat"
    assert state.shared.outcome_reason == reason
    assert state.result is not None
    assert state.result.outcome_reason == reason


def test_success_path_writes_a_specific_result():
    engine = GameEngine()
    state = engine.new_game("result-victory", ["p1"], scenario_id="sand_and_stone")
    core = state.projects[state.scenario_id and engine.content.scenarios[state.scenario_id]["core_project_id"]]
    core.status = ProjectStatus.COMPLETED
    for project in state.projects.values():
        project.status = ProjectStatus.COMPLETED
    for site in state.sites.values():
        site.discovered = True
        site.status = SiteStatus.STABLE

    engine._check_outcome(state)

    assert state.shared.outcome == "victory"
    assert state.shared.outcome_reason == "core_project_and_objectives_completed"
    assert state.result is not None


def test_feedback_includes_target_site_state_changes():
    engine = GameEngine()
    state = engine.new_game("feedback-target-state", ["p1"], scenario_id="sand_and_stone")
    player = state.players[state.shared.active_player_id]
    site = state.sites[player.location]
    site.damage = 2
    site.status = SiteStatus.AT_RISK
    state.shared.restoration_resource = 1

    result = engine.apply(state, {"player_id": player.id, "action": "restore", "target_site_id": site.id})
    changes = {change.metric: change for event in result.feedback_events for change in event.changes}

    assert changes["site_damage"].before == 2
    assert changes["site_damage"].after == 1
    assert changes["site_damage"].delta == -1


def test_each_player_can_declare_only_one_planning_target_per_round():
    engine = GameEngine()
    state = engine.new_game("planning-one-target", ["p1", "p2"], scenario_id="sand_and_stone")
    player = state.players["p1"]
    first, second = list(state.sites)[:2]
    state.shared.phase = "player_action"

    engine._plan(state, player, first)

    with pytest.raises(ValueError, match="planning_limit_reached"):
        engine._plan(state, player, second)


def test_unconnected_site_plan_does_not_change_site_state():
    engine = GameEngine()
    state = engine.new_game("planning-no-free-site", ["p1", "p2"], scenario_id="sand_and_stone")
    target = next(iter(state.sites.values()))
    before_influence = target.influence
    state.shared.planning_marks = {"p2": [{"target_id": target.id, "turn": str(state.shared.turn)}]}

    effects = engine._settle_planning_marks(state, "p1")

    assert target.influence == before_influence
    assert effects == []


def test_unconnected_route_plan_does_not_change_route_state():
    engine = GameEngine()
    state = engine.new_game("planning-no-free-route", ["p1", "p2"], scenario_id="sand_and_stone")
    target = next(iter(state.routes.values()))
    before_risk = target.risk
    state.shared.planning_marks = {"p2": [{"target_id": target.id, "turn": str(state.shared.turn)}]}

    effects = engine._settle_planning_marks(state, "p1")

    assert target.risk == before_risk
    assert effects == []


def test_unconnected_project_plan_does_not_change_project_state():
    engine = GameEngine()
    state = engine.new_game("planning-no-free-project", ["p1", "p2"], scenario_id="sand_and_stone")
    target = next(iter(state.projects.values()))
    before_progress = target.progress
    before_stage = target.stage_index
    state.shared.planning_marks = {"p2": [{"target_id": target.id, "turn": str(state.shared.turn)}]}

    effects = engine._settle_planning_marks(state, "p1")

    assert target.progress == before_progress
    assert target.stage_index == before_stage
    assert effects == []


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


def test_round_summary_records_target_before_after_state():
    game_engine = GameEngine()
    state = game_engine.new_game("round-summary-entities", ["p1"])
    site = next(iter(state.sites.values()))
    snapshot = {
        "round": 1,
        "event_id": "sandstorm",
        "event_targets": [site.id],
        "planning_marks": {},
        "weathering_track": state.shared.weathering_track,
        "restoration_resource": state.shared.restoration_resource,
        "influence": state.shared.influence,
        "site_states": {site.id: {"damage": site.damage, "status": site.status.value}},
    }
    site.damage += 1
    game_engine._update_site(site)
    summary = game_engine._build_round_summary(state, snapshot)
    assert summary["site_changes"][0]["label"] == game_engine.content.sites[site.id]["name"]
    assert summary["site_changes"][0]["before"] + 1 == summary["site_changes"][0]["after"]


def test_action_option_scores_each_target_and_promotes_best_target():
    engine = GameEngine()
    state = engine.new_game("target-recommendation", ["p1"], solo_mode=False)
    player = state.players["p1"]
    candidates = [site for site in state.sites.values() if site.id != player.location][:2]
    assert len(candidates) == 2
    candidates[0].damage = candidates[0].max_damage - 1
    candidates[1].damage = 0
    actions = [
        {"type": "move", "target_id": site.id, "label": f"前往 {site.id}", "cost": 1}
        for site in candidates
    ]

    options = engine._build_action_options(actions, state)
    move = next(option for option in options if option.type == "move")
    assert len(move.targets) >= 2
    assert all(target.recommendation_score >= 0 and target.reason for target in move.targets)
    assert move.recommendation_score == max(target.recommendation_score for target in move.targets)
    assert max(target.recommendation_score for target in move.targets) > min(target.recommendation_score for target in move.targets)
    high_risk = next(target for target in move.targets if target.payload["target_id"] == candidates[0].id)
    assert "接近关闭" in high_risk.reason or high_risk.recommendation_score > next(target for target in move.targets if target.payload["target_id"] == candidates[1].id).recommendation_score


def test_action_option_keeps_specific_name_above_action_category():
    engine = GameEngine()
    state = engine.new_game("action-label-contract", ["p1"], solo_mode=False)

    skill = next(option for option in state.action_options if option.type == "use_skill")
    assert skill.label == "精修"
    assert skill.category_label == "角色技能"
    assert skill.action_label == "使用角色技能"


def test_project_stage_exposes_the_reward_that_will_be_granted():
    engine = GameEngine()
    state = engine.new_game("project-stage-reward-contract", ["p1"], solo_mode=False)
    project = next(iter(state.projects.values()))
    stage = project.stages[project.stage_index]

    assert stage["reward"]
    if stage["action_type"] == "explore":
        assert stage["reward"].get("research_clues") == 1


def test_recommendation_explains_when_the_active_role_fits_the_action():
    engine = GameEngine()
    state = engine.new_game("role-fit-recommendation", ["p1"], solo_mode=False)
    site = state.sites[state.players["p1"].location]
    site.damage = 1
    engine.refresh(state)
    restore = next(option for option in state.action_options if option.type == "restore")

    assert "精修" in restore.reason


def test_result_state_is_structured_and_survives_game_serialization():
    engine = GameEngine()
    state = engine.new_game("contract-result-state", ["p1"], solo_mode=False)
    state.result = ResultState(
        outcome="victory",
        outcome_reason="core_project_and_objectives_completed",
        outcome_summary="完成共同目标。",
        completed_objectives=["objective_protect_core"],
        completed_projects=["project_01"],
        seed=state.seed,
    )

    restored = type(state).model_validate_json(state.model_dump_json())

    assert restored.result.outcome == "victory"
    assert restored.result.completed_projects == ["project_01"]


def test_viewer_state_is_structured_for_room_replay():
    engine = GameEngine()
    state = engine.new_game("contract-viewer-state", ["p1"], solo_mode=False)
    state.viewer = ViewerState(
        seat_id="seat-1",
        player_id="p1",
        controlled_player_ids=["p1"],
        can_act=True,
        play_mode="multi_device",
        room_id="room-contract",
        room_status="in_progress",
        seats=[{"seat_id": "seat-1", "player_id": "p1", "name": "石刻旅人", "role_id": "pingcheng_artisan", "ready": True, "connected": True}],
    )

    restored = type(state).model_validate_json(state.model_dump_json())

    assert restored.viewer.play_mode == "multi_device"
    assert restored.viewer.room_id == "room-contract"
    assert restored.viewer.seats[0].role_id == "pingcheng_artisan"
