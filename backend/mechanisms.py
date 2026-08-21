from __future__ import annotations

from typing import Any


TRIGGER_HANDLERS = {
    "first_new_domain_contribution_per_round": "node_trigger",
    "after_architecture_contribution": "node_trigger",
    "second_distinct_player_action_per_round": "node_trigger",
    "task_completed": "node_trigger",
    "first_exchange_per_round": "node_trigger",
    "first_explore": "node_trigger",
    "after_explore": "node_trigger",
    "once_per_round": "node_trigger",
    "statue_architecture_combo": "node_trigger",
    "once_per_round_pattern_contribution": "node_trigger",
    "first_move_from_site_per_round": "node_trigger",
    "on_arrival": "node_trigger",
    "frontier_trade_combo": "node_trigger",
    "round_start": "node_trigger",
    "first_route_action_per_round": "node_trigger",
    "after_interpret_evidence": "node_trigger",
    "after_exchange": "node_trigger",
    "after_route_action": "node_trigger",
    "use_node_ability": "node_trigger",
}

CULTURE_EFFECT_HANDLERS = {
    "gain_ap": "_effect_gain_ap",
    "gain_clue": "_effect_gain_clue",
    "next_contribute_bonus": "_effect_next_contribute_bonus",
    "free_move": "_effect_free_move",
    "restore_and_influence": "_effect_restore_and_influence",
    "reduce_threat": "_effect_reduce_threat",
    "influence": "_effect_influence",
    "gain_influence": "_effect_gain_influence",
}

NODE_EFFECT_HANDLERS = {
    "gain_influence": "_effect_gain_influence",
    "restore_discount": "_effect_restore_discount",
    "gain_clue": "_effect_gain_clue",
    "preview_event": "_effect_preview_event",
    "exchange_discount": "_effect_exchange_discount",
    "reserve_market_card": "_effect_reserve_market_card",
    "next_contribute_bonus": "_effect_next_contribute_bonus",
    "inspect_archive": "_effect_inspect_archive",
    "clue_to_restoration": "_effect_clue_to_restoration",
    "project_progress": "_effect_project_progress",
    "temporary_origin_tag": "_effect_temporary_origin_tag",
    "ignore_route_risk": "_effect_ignore_route_risk",
    "free_exchange": "_effect_free_exchange",
    "reduce_threat": "_effect_reduce_threat",
    "preview_event_target": "_effect_preview_event_target",
    "route_action_discount": "_effect_route_action_discount",
    "inspect_adjacent_routes": "_effect_inspect_adjacent_routes",
    "trigger_role_upgrade": "_effect_trigger_role_upgrade",
}

EVENT_EFFECT_HANDLERS = {
    "damage_open_sites": "_event_damage_open_sites",
    "all_influence": "_event_all_influence",
    "gain_resource": "_event_gain_resource",
    "threat": "_event_threat",
}

ACTION_CARD_EFFECT_HANDLERS = {
    "survey_route": "_action_card_survey_route",
    "restore_route": "_action_card_restore_route",
    "establish_connection": "_action_card_establish_connection",
    "prepare_event": "_action_card_prepare_event",
    "survey_multiple_routes": "_action_card_survey_multiple_routes",
    "reduce_route_risk": "_action_card_reduce_route_risk",
    "remote_exchange_or_connect": "_action_card_remote_exchange_or_connect",
    "reserve_ap": "_action_card_reserve_ap",
    "survey_and_mitigate": "_action_card_survey_and_mitigate",
    "restore_and_move": "_action_card_restore_and_move",
    "transfer_resource": "_action_card_transfer_resource",
    "team_prepare": "_action_card_team_prepare",
}

SCENARIO_RULE_TRIGGERS = {"after_restore", "after_interpret_evidence", "after_establish_connection", "after_explore", "round_end"}
SCENARIO_RULE_EFFECT_HANDLERS = {
    "move_planning_mark_adjacent": "_scenario_move_planning_mark_adjacent",
    "gain_clue_if_distinct_players": "_scenario_gain_clue_if_distinct_players",
    "next_player_move_discount": "_scenario_next_player_move_discount",
    "reduce_weathering_if_stage_and_route": "_scenario_reduce_weathering_if_stage_and_route",
    "increase_weathering": "_scenario_increase_weathering",
    "gain_clue": "_scenario_gain_clue",
    "event_diversity_pressure": "_scenario_event_diversity_pressure",
}

EFFECT_HANDLERS = {
    **CULTURE_EFFECT_HANDLERS,
    **NODE_EFFECT_HANDLERS,
    **EVENT_EFFECT_HANDLERS,
    **ACTION_CARD_EFFECT_HANDLERS,
    "fine_repair_threat_bonus": "_upgrade_effect",
    "project_restore_discount": "_upgrade_effect",
    "harmony_origin_bonus": "_upgrade_effect",
    "post_contribution_clue": "_upgrade_effect",
    "sprint_survey": "_upgrade_effect",
    "route_action_discount": "_upgrade_effect",
    "market_look_bonus": "_upgrade_effect",
    "archive_retrieve": "_upgrade_effect",
}

ACTION_TYPES = {
    "move", "explore", "restore", "interpret_evidence", "form_interpretation", "choose_intervention", "exchange", "use_skill", "play_card",
    "use_action_card", "use_node_ability", "use_upgrade", "end_turn", "end_planning", "resolve_event", "select_market_card",
    "discard", "survey_route", "restore_route", "establish_connection", "prepare", "select_upgrade", "plan",
}


def validate_content_mechanisms(files: dict[str, Any]) -> None:
    unknown_effects: set[str] = set()
    unknown_triggers: set[str] = set()
    unknown_actions: set[str] = set()

    def items(value: Any, key: str) -> list[dict[str, Any]]:
        return value if isinstance(value, list) else value.get(key, [])

    for site in items(files.get("sites", []), "sites"):
        ability = site.get("node_ability") or {}
        if ability.get("trigger") and ability["trigger"] not in TRIGGER_HANDLERS:
            unknown_triggers.add(str(ability["trigger"]))
        if (ability.get("effect") or {}).get("type") not in NODE_EFFECT_HANDLERS:
            if (ability.get("effect") or {}).get("type"):
                unknown_effects.add(str(ability["effect"]["type"]))
    for card in items(files.get("culture_cards", []), "cards"):
        typ = (card.get("effect") or {}).get("type")
        if typ and typ not in CULTURE_EFFECT_HANDLERS:
            unknown_effects.add(str(typ))
    for card in items(files.get("action_cards", []), "cards"):
        typ = (card.get("effect") or {}).get("type")
        if typ and typ not in ACTION_CARD_EFFECT_HANDLERS:
            unknown_effects.add(str(typ))
    for event in items(files.get("events", []), "events"):
        typ = (event.get("effect") or {}).get("type")
        if typ and typ not in EVENT_EFFECT_HANDLERS:
            unknown_effects.add(str(typ))
    for upgrade in items(files.get("role_upgrades", []), "role_upgrades"):
        typ = (upgrade.get("effect") or {}).get("type")
        if typ and typ not in EFFECT_HANDLERS:
            unknown_effects.add(str(typ))
    for project in items(files.get("projects", []), "projects"):
        for stage in project.get("stages", []):
            action_type = stage.get("action_type")
            if action_type and action_type not in ACTION_TYPES:
                unknown_actions.add(str(action_type))
    for scenario in items(files.get("scenarios", []), "scenarios"):
        rule = scenario.get("scenario_rule") or {}
        if not isinstance(rule, dict):
            unknown_triggers.add(f"scenario_rule:{scenario.get('id')}:not_object")
            continue
        entries = [{"trigger": rule.get("trigger"), "effect": rule.get("effect")}]
        entries.extend(rule.get("additional_effects", []))
        for entry in entries:
            if entry.get("trigger") not in SCENARIO_RULE_TRIGGERS:
                unknown_triggers.add(str(entry.get("trigger")))
            effect_type = (entry.get("effect") or {}).get("type")
            if effect_type not in SCENARIO_RULE_EFFECT_HANDLERS:
                unknown_effects.add(str(effect_type))
    if unknown_effects or unknown_triggers or unknown_actions:
        parts = []
        if unknown_effects:
            parts.append(f"effects={sorted(unknown_effects)}")
        if unknown_triggers:
            parts.append(f"triggers={sorted(unknown_triggers)}")
        if unknown_actions:
            parts.append(f"action_types={sorted(unknown_actions)}")
        raise ValueError("unsupported_content_mechanism:" + "; ".join(parts))
