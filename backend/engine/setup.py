from __future__ import annotations

from typing import Any

from ..content import Content
from ..domain.rng import DeterministicRng
from ..mechanisms import EVENT_MODIFIER_ACTIONS, SCENARIO_RULE_EFFECT_HANDLERS
from ..models import (
    ActionType,
    GameState,
    ObjectiveState,
    PlayerState,
    ProjectState,
    RouteState,
    SiteState,
)


class SetupMixin:
    def __init__(self, content: Content | None = None):
        self.content = content or Content()

    def _effective_rules(self, scenario: dict[str, Any], difficulty: dict[str, Any], solo: bool) -> dict[str, Any]:
        normal = self.content.difficulty.get("normal", {})
        rules = {
            "max_rounds": int(scenario.get("max_rounds", normal.get("max_rounds", 8))),
            "restoration_resource": int(scenario.get("restoration_resource", normal.get("restoration_resource", 6))),
            "event_weight": float(difficulty.get("event_weight", 1)),
            "node_damage_base": int(difficulty.get("node_damage_base", 0)),
            "event_preview_count": int(difficulty.get("event_preview_count", 1)),
            "solo_ap_bonus": int(difficulty.get("solo_ap_bonus", 0)) if solo else 0,
            "planning_marks_per_round": int(scenario.get("planning_marks_per_round", 1)),
            "influence_goal": int(scenario.get("influence_goal", 10)),
            "guidance_level": "full" if difficulty.get("id") == "guided" else "standard",
            "show_recommendation_reasons": difficulty.get("id") == "guided",
            "show_event_target_details": difficulty.get("id") == "guided",
        }
        rules["max_rounds"] += int(difficulty.get("max_rounds", normal.get("max_rounds", 8))) - int(normal.get("max_rounds", 8))
        rules["restoration_resource"] += int(difficulty.get("restoration_resource", normal.get("restoration_resource", 6))) - int(normal.get("restoration_resource", 6))
        if solo:
            solo_rules = scenario.get("solo_rules", {})
            rules["max_rounds"] += int(solo_rules.get("max_rounds_bonus", 0))
            rules["planning_marks_per_round"] = int(solo_rules.get("planning_marks_per_round", 1))
            rules["route_action_discount"] = int(solo_rules.get("route_action_discount", 0))
        return rules

    def _allowed_action_types(self, state: GameState) -> set[str] | None:
        """Return the action types a tutorial scenario allows for the current round.

        Returns ``None`` for non-tutorial scenarios, leaving all generated actions
        available.
        """
        scenario = self.content.scenarios.get(state.scenario_id or state.shared.scenario_id, {})
        if not scenario.get("tutorial"):
            return None
        first_allowed = scenario.get("first_turn_allowed_actions") or []
        unlock_schedule = scenario.get("tutorial_unlock_schedule", [])
        player_count = max(1, len(state.shared.player_order))
        round_number = (state.shared.turn - 1) // player_count + 1
        base = {ActionType.END_TURN.value, *(str(action) for action in first_allowed)}
        if round_number <= 1:
            return base
        category_actions = {
            "events": {ActionType.PREPARE.value, ActionType.RESOLVE_EVENT.value},
            "routes": {ActionType.SURVEY_ROUTE.value, ActionType.RESTORE_ROUTE.value, ActionType.ESTABLISH_CONNECTION.value},
            "action_cards": {ActionType.USE_ACTION_CARD.value, ActionType.PLAY_CARD.value},
        }
        allowed = set(base)
        for entry in unlock_schedule:
            if round_number >= entry.get("from_round", 1):
                for category in entry.get("unlock", []):
                    allowed.update(category_actions.get(category, set()))
        return allowed

    def _event_action_cost(self, state: GameState, action_type: str, base_cost: int) -> int:
        """Apply only the active event's declared modifier to one action."""
        event_id = state.shared.current_event_id
        event = self.content.events.get(event_id, {}) if event_id else {}
        modifiers = list(event.get("modifiers", []))
        modifiers.extend(state.shared.event_instance.get("modifiers", []))
        cost = int(base_cost)
        for modifier in modifiers:
            if modifier.get("action") != action_type and action_type not in EVENT_MODIFIER_ACTIONS.get(modifier.get("type"), set()):
                continue
            cost += int(modifier.get("amount", 0))
        return max(0, cost)

    def _emit_scenario_rule(self, state: GameState, trigger: str, context: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        scenario = self.content.scenarios.get(state.scenario_id or state.shared.scenario_id, {})
        rule = scenario.get("scenario_rule") or {}
        entries = [{"trigger": rule.get("trigger"), "effect": rule.get("effect")}]
        entries.extend(rule.get("additional_effects", []))
        applied_effects = []
        for index, entry in enumerate(entries):
            if entry.get("trigger") != trigger:
                continue
            use_key = f"{state.shared.turn}:{index}:{trigger}"
            if use_key in state.shared.scenario_rule_uses:
                continue
            effect = entry.get("effect") or {}
            handler = getattr(self, SCENARIO_RULE_EFFECT_HANDLERS.get(effect.get("type"), ""), None)
            if handler:
                applied = handler(state, context or {}, effect)
                if applied is False:
                    continue
                state.shared.scenario_rule_uses.append(use_key)
                applied_effects.append({"type": effect.get("type"), "amount": effect.get("amount", 0), "trigger": trigger})
        return applied_effects

    def _scenario_move_planning_mark_adjacent(self, state: GameState, context: dict[str, Any], effect: dict[str, Any]) -> bool:
        origin = context.get("site_id")
        if not origin:
            return False
        adjacent = []
        for route in state.routes.values():
            if origin not in {route.from_site, route.to_site} or route.status not in {"open", "restored", "illuminated"}:
                continue
            adjacent.append(route.to_site if route.from_site == origin else route.from_site)
        for marks in state.shared.planning_marks.values():
            for mark in marks:
                if mark.get("target_id") == origin and adjacent:
                    mark["target_id"] = sorted(adjacent)[0]
                    return True
        return False

    def _scenario_gain_clue_if_distinct_players(self, state: GameState, context: dict[str, Any], effect: dict[str, Any]) -> bool:
        task = context.get("task") or {}
        if len(task.get("contributing_player_ids", [])) >= 2:
            state.shared.research_clues += int(effect.get("amount", 1))
            return True
        return False

    def _scenario_next_player_move_discount(self, state: GameState, context: dict[str, Any], effect: dict[str, Any]) -> bool:
        order = state.shared.player_order
        player_id = context.get("player_id") or state.shared.active_player_id
        if player_id in order:
            next_player = state.players[order[(order.index(player_id) + 1) % len(order)]]
            next_player.flags["next_move_discount"] = int(effect.get("amount", 1))
            return True
        return False

    def _scenario_reduce_weathering_if_stage_and_route(self, state: GameState, context: dict[str, Any], effect: dict[str, Any]) -> bool:
        if context.get("completed_project_stages", 0) > 0 and context.get("restored_routes", 0) > 0:
            state.shared.weathering_track = max(0, state.shared.weathering_track - int(effect.get("amount", 1)))
            return True
        return False

    def _scenario_increase_weathering(self, state: GameState, context: dict[str, Any], effect: dict[str, Any]) -> bool:
        state.shared.weathering_track += int(effect.get("amount", 1))
        state.shared.weathering_track += int(effect.get("weathering_amount", 0))
        return True

    def _scenario_gain_clue(self, state: GameState, context: dict[str, Any], effect: dict[str, Any]) -> bool:
        state.shared.research_clues += int(effect.get("amount", 1))
        return True

    def _scenario_event_diversity_pressure(self, state: GameState, context: dict[str, Any], effect: dict[str, Any]) -> bool:
        event_ids = {item.get("event_id") for item in state.shared.event_history[-3:]}
        if len(event_ids) >= int(effect.get("minimum_events", 2)):
            state.shared.weathering_track += int(effect.get("amount", 1))
            return True
        return False

    def new_game(self, session_id: str = "demo", player_ids: list[str] | None = None, difficulty_id: str = "normal", scenario_id: str = "sand_and_stone", seed: int | None = None, player_configs: list[dict[str, Any]] | None = None, solo_mode: bool | None = None) -> GameState:
        ids = player_ids or ["p1", "p2"]
        if not 1 <= len(ids) <= 4:
            raise ValueError("game_needs_one_to_four_players")
        difficulty = self.content.difficulty.get(difficulty_id, self.content.difficulty.get("normal", {}))
        scenario = self.content.scenarios.get(scenario_id, next(iter(self.content.scenarios.values()), {}))
        scenario_id = scenario.get("id", scenario_id)
        rng = DeterministicRng(seed)
        solo = len(ids) == 1 if solo_mode is None else solo_mode
        effective_rules = self._effective_rules(scenario, difficulty, solo)
        if solo and not player_configs and len(ids) == 1:
            controlled_roles = int(scenario.get("solo_rules", {}).get("controlled_roles", 2))
            ids = [ids[0], *[f"{ids[0]}-ally-{index}" for index in range(2, controlled_roles + 1)]]
        configs = {item["player_id"]: item for item in (player_configs or [])}
        role_ids = list(self.content.roles)
        players = {}
        for index, pid in enumerate(ids):
            config = configs.get(pid, {})
            role_id = config.get("role_id") or role_ids[index % len(role_ids)]
            role = self.content.roles[role_id]
            bonus = effective_rules["solo_ap_bonus"]
            players[pid] = PlayerState(
                id=pid,
                name=config.get("name") or role["name"],
                role_id=role_id,
                location=config.get("start_site_id") or role.get("start_site_id", "yungang"),
                ap=3 + bonus,
                max_ap=3 + bonus,
            )

        enabled_site_ids = set(scenario.get("enabled_site_ids", self.content.sites))
        enabled_site_ids.update(role.get("start_site_id", "yungang") for role in self.content.roles.values())
        sites = {}
        for sid, definition in self.content.sites.items():
            if sid not in enabled_site_ids:
                continue
            maximum = definition.get("max_damage", 3)
            damage = scenario.get("initial_damage", {}).get(sid, definition.get("start_damage", 0)) + effective_rules["node_damage_base"]
            damage = min(maximum, damage)
            sites[sid] = SiteState(
                id=sid,
                damage=damage,
                max_damage=maximum,
                durability=max(0, maximum - damage),
                max_durability=maximum,
                domains=definition.get("domains", []),
            )

        tasks = {
            tid: {
                **task,
                "contributed_cards": [],
                "contribution_records": [],
                "interpretation": {"placements": [], "formed": False, "intervention": None, "confidence": 0},
                "completed": False,
            }
            for tid, task in self.content.tasks.items()
            if task.get("site_id") in sites
        }
        routes = {
            route["id"]: RouteState(
                id=route["id"],
                from_site=route["from"],
                to_site=route["to"],
                cost=route.get("cost", 1),
                status=route.get("status", "open"),
                risk=route.get("risk", 0),
                connection_level=route.get("connection_level", 0),
                active_project_id=route.get("active_project_id"),
                tags=route.get("tags", []),
                waypoints=route.get("waypoints", []),
                road_class=route.get("road_class", "local"),
                terrain=route.get("terrain", "plain"),
                label_position=route.get("label_position"),
                name=route.get("name"),
                strategic_role=route.get("strategic_role"),
                risk_profile=route.get("risk_profile"),
                ui_hint=route.get("ui_hint"),
                event_tags=route.get("event_tags", []),
            )
            for route in self.content.routes
            if route["from"] in sites and route["to"] in sites
        }
        route_ids = list(routes)
        rng.shuffle(route_ids)
        starting_sites = {player.location for player in players.values()}
        protected_route_ids = {
            route_id for route_id, route in routes.items()
            if "yungang" in {route.from_site, route.to_site}
            and (route.from_site in starting_sites or route.to_site in starting_sites)
        }
        blockable_route_ids = [route_id for route_id in route_ids if route_id not in protected_route_ids]
        blockable_route_ids.extend(route_id for route_id in route_ids if route_id in protected_route_ids)
        for route_id in blockable_route_ids[: scenario.get("blocked_route_count", 0)]:
            routes[route_id].status = "blocked"
        enabled_project_ids = set(scenario.get("enabled_project_ids", self.content.projects))
        projects = {
            project_id: ProjectState(
                id=project_id,
                site_id=project["site_id"],
                name=project["name"],
                stages=[{**stage, "reward": stage.get("reward") or self._default_stage_reward(stage)} for stage in project.get("stages", [])],
            )
            for project_id, project in self.content.projects.items()
            if project_id in enabled_project_ids and project.get("site_id") in sites
        }
        objectives = {
            objective_id: ObjectiveState(id=objective_id, name=objective["name"], type=objective["type"], target=objective.get("target", 1))
            for objective_id, objective in self.content.objectives.items()
            if not scenario.get("objective_ids") or objective_id in scenario["objective_ids"]
        }
        card_pool = scenario.get("card_pool", {})
        culture_deck = [card_id for card_id, copies in card_pool.items() for _ in range(int(copies))] if card_pool else list(self.content.cards)
        event_deck = self._event_deck_for_scenario(scenario, rng)
        rng.shuffle(culture_deck)
        state = GameState(
            session_id=session_id,
            difficulty_id=difficulty_id,
            players=players,
            sites=sites,
            tasks=tasks,
            shared={
                "max_rounds": effective_rules["max_rounds"],
                "active_player_id": ids[0],
                "player_order": ids,
                "restoration_resource": effective_rules["restoration_resource"],
                "scenario_id": scenario_id,
                "research_clues": scenario.get("starting_clues", 0),
                "phase": "player_action",
                "weathering_track": scenario.get("starting_weathering", 0),
                "weathering_limit": scenario.get("weathering_limit", 5),
                "effective_rules": effective_rules,
                "solo_mode": solo,
                "controlled_character_ids": ids if solo else [],
            },
            decks={
                "culture": culture_deck,
                "events": event_deck,
                "discard": [],
                "archive": [],
                "action": [card_id for card_id in scenario.get("action_card_pool", self.content.action_cards) for _ in range(int(scenario.get("action_card_pool", {}).get(card_id, 1)))],
            },
            scenario_id=scenario_id,
            seed=rng.seed,
            rng_state=rng.state,
            rng_position=rng.position,
            routes=routes,
            projects=projects,
            objectives=objectives,
        )
        for player in state.players.values():
            self._draw_action_card(state, player)
        for site in state.sites.values():
            project = next((item for item in state.projects.values() if item.site_id == site.id), None)
            site.active_project_id = project.id if project else None
            self._update_site(site)
        state.shared.scenario_round_baseline = self._capture_scenario_round_baseline(state)
        self._refill_market(state)
        self._reveal_event(state)
        self._record_journal(state, "new_game", state.shared.active_player_id, "旅程开始：先观察事件预告，再决定本回合的节点行动。")
        return self.refresh(state)
