from __future__ import annotations

from collections import deque
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from .content import Content
from .domain.rng import DeterministicRng
from .mechanisms import ACTION_CARD_EFFECT_HANDLERS, CULTURE_EFFECT_HANDLERS, EVENT_EFFECT_HANDLERS, EVENT_MODIFIER_ACTIONS, NODE_EFFECT_HANDLERS, SCENARIO_RULE_EFFECT_HANDLERS, TRIGGER_HANDLERS
from .models import ActionOption, ActionType, EventHistoryRecord, FeedbackChange, FeedbackEvent, ActionTarget, GameOutcome, GameState, GoalStatus, JournalEntry, ObjectiveState, PlayerState, ProjectState, ResultState, RouteState, SiteState, SiteStatus


class GameEngine:
    def __init__(self, content: Content | None = None):
        self.content = content or Content()

    def _effective_rules(self, scenario, difficulty, solo):
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

    def _event_action_cost(self, state, action_type, base_cost):
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

    def _emit_scenario_rule(self, state, trigger, context=None):
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

    def _scenario_move_planning_mark_adjacent(self, state, context, effect):
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

    def _scenario_gain_clue_if_distinct_players(self, state, context, effect):
        task = context.get("task") or {}
        if len(task.get("contributing_player_ids", [])) >= 2:
            state.shared.research_clues += int(effect.get("amount", 1))
            return True
        return False

    def _scenario_next_player_move_discount(self, state, context, effect):
        order = state.shared.player_order
        player_id = context.get("player_id") or state.shared.active_player_id
        if player_id in order:
            next_player = state.players[order[(order.index(player_id) + 1) % len(order)]]
            next_player.flags["next_move_discount"] = int(effect.get("amount", 1))
            return True
        return False

    def _scenario_reduce_weathering_if_stage_and_route(self, state, context, effect):
        if context.get("completed_project_stages", 0) > 0 and context.get("restored_routes", 0) > 0:
            state.shared.weathering_track = max(0, state.shared.weathering_track - int(effect.get("amount", 1)))
            return True
        return False

    def _scenario_increase_weathering(self, state, context, effect):
        state.shared.weathering_track += int(effect.get("amount", 1))
        state.shared.weathering_track += int(effect.get("weathering_amount", 0))
        return True

    def _scenario_gain_clue(self, state, context, effect):
        state.shared.research_clues += int(effect.get("amount", 1))
        return True

    def _scenario_event_diversity_pressure(self, state, context, effect):
        event_ids = {item.get("event_id") for item in state.shared.event_history[-3:]}
        if len(event_ids) >= int(effect.get("minimum_events", 2)):
            state.shared.weathering_track += int(effect.get("amount", 1))
            return True
        return False

    def new_game(self, session_id="demo", player_ids=None, difficulty_id="normal", scenario_id="sand_and_stone", seed=None, player_configs=None, solo_mode=None):
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
            players[pid] = PlayerState(id=pid, name=config.get("name") or role["name"], role_id=role_id, location=config.get("start_site_id") or role.get("start_site_id", "yungang"), ap=3 + bonus, max_ap=3 + bonus)

        enabled_site_ids = set(scenario.get("enabled_site_ids", self.content.sites))
        enabled_site_ids.update(role.get("start_site_id", "yungang") for role in self.content.roles.values())
        sites = {}
        for sid, definition in self.content.sites.items():
            if sid not in enabled_site_ids:
                continue
            maximum = definition.get("max_damage", 3)
            damage = scenario.get("initial_damage", {}).get(sid, definition.get("start_damage", 0)) + effective_rules["node_damage_base"]
            damage = min(maximum, damage)
            sites[sid] = SiteState(id=sid, damage=damage, max_damage=maximum, durability=max(0, maximum - damage), max_durability=maximum, domains=definition.get("domains", []))

        tasks = {tid: {**task, "contributed_cards": [], "contribution_records": [], "interpretation": {"placements": [], "formed": False, "intervention": None, "confidence": 0}, "completed": False} for tid, task in self.content.tasks.items() if task.get("site_id") in sites}
        routes = {route["id"]: RouteState(id=route["id"], from_site=route["from"], to_site=route["to"], cost=route.get("cost", 1), status=route.get("status", "open"), risk=route.get("risk", 0), connection_level=route.get("connection_level", 0), active_project_id=route.get("active_project_id"), tags=route.get("tags", []), waypoints=route.get("waypoints", []), road_class=route.get("roadClass", route.get("road_class", "local")), terrain=route.get("terrain", "plain"), label_position=route.get("labelPosition", route.get("label_position")), name=route.get("name"), strategic_role=route.get("strategic_role"), risk_profile=route.get("risk_profile"), ui_hint=route.get("ui_hint"), event_tags=route.get("event_tags", [])) for route in self.content.routes if route["from"] in sites and route["to"] in sites}
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
        objectives = {objective_id: ObjectiveState(id=objective_id, name=objective["name"], type=objective["type"], target=objective.get("target", 1)) for objective_id, objective in self.content.objectives.items() if not scenario.get("objective_ids") or objective_id in scenario["objective_ids"]}
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
            shared={"max_rounds": effective_rules["max_rounds"], "active_player_id": ids[0], "player_order": ids, "restoration_resource": effective_rules["restoration_resource"], "scenario_id": scenario_id, "research_clues": scenario.get("starting_clues", 0), "phase": "player_action", "weathering_track": scenario.get("starting_weathering", 0), "weathering_limit": scenario.get("weathering_limit", 5), "effective_rules": effective_rules, "solo_mode": solo, "controlled_character_ids": ids if solo else []},
            decks={"culture": culture_deck, "events": event_deck, "discard": [], "archive": [], "action": [card_id for card_id in scenario.get("action_card_pool", self.content.action_cards) for _ in range(int(scenario.get("action_card_pool", {}).get(card_id, 1)))]},
            scenario_id=scenario_id,
            seed=rng.seed,
            rng_state=rng.state,
            rng_position=rng.position,
            routes=routes,
            projects=projects,
            objectives=objectives,
        )
        for player in state.players.values(): self._draw_action_card(state, player)
        for site in state.sites.values():
            project = next((item for item in state.projects.values() if item.site_id == site.id), None)
            site.active_project_id = project.id if project else None
            self._update_site(site)
        state.shared.scenario_round_baseline = self._capture_scenario_round_baseline(state)
        self._refill_market(state)
        self._reveal_event(state)
        state.shared.log.append("\u65c5\u7a0b\u5f00\u59cb\uff1a\u5148\u89c2\u5bdf\u4e8b\u4ef6\u9884\u544a\uff0c\u518d\u51b3\u5b9a\u672c\u56de\u5408\u7684\u8282\u70b9\u884c\u52a8\u3002")
        return self.refresh(state)

    def refresh(self, state: GameState):
        self._ensure_runtime_state(state)
        for task in state.tasks.values():
            self._ensure_interpretation(task)
            task["progress"] = self._task_progress(task)
        if state.shared.outcome:
            state.legal_actions = []
            state.action_options = []
            return state
        active = state.players[state.shared.active_player_id]
        if state.pending_choice:
            kind = state.pending_choice.get("kind")
            if kind == "event":
                state.legal_actions = [{"type": ActionType.RESOLVE_EVENT.value, "target_id": option["id"], "label": option["label"]} for option in state.pending_choice["options"]]
                active_player = state.players[state.shared.active_player_id]
                state.legal_actions.extend({
                    "type": ActionType.USE_ACTION_CARD.value,
                    "card_id": card,
                    "label": f"使用策略：{self.content.action_cards[card]['name']}",
                    "cost": int(self.content.action_cards[card].get("cost", 1)),
                    "enabled": self._action_card_timing_allowed(state, self.content.action_cards[card]),
                    "disabled_reason": f"当前不能使用 · 时机：{self.content.action_cards[card].get('timing', '当前行动阶段')}",
                } for card in active_player.action_hand)
            elif kind == "view_select":
                state.legal_actions = [{"type": ActionType.SELECT_MARKET_CARD.value, "card_id": card, "label": f"\u9009\u62e9 {self.content.cards[card]['name']}"} for card in state.pending_choice["cards"]]
            elif kind == "discard":
                if state.pending_choice.get("next_action_card_id"):
                    state.legal_actions = [{"type": ActionType.DISCARD.value, "card_id": card, "label": f"\u5f03\u7f6e {self.content.action_cards.get(card, {}).get('name', card)}"} for card in active.action_hand]
                else:
                    state.legal_actions = [{"type": ActionType.DISCARD.value, "card_id": card, "label": f"\u653e\u4e0b {self.content.cards[card]['name']}"} for card in active.hand]
            elif kind == "role_upgrade":
                state.legal_actions = [{"type": ActionType.SELECT_UPGRADE.value, "upgrade_id": option["id"], "label": option["name"]} for option in state.pending_choice["options"]]
            elif kind == "action_card":
                card_id = state.pending_choice["card_id"]
                state.legal_actions = [{"type": ActionType.USE_ACTION_CARD.value, "card_id": card_id, "target_id": option["id"], "label": option["label"], "cost": int(self.content.action_cards.get(card_id, {}).get("cost", 1))} for option in state.pending_choice["options"]]
            elif kind in {"archive_select", "archive_retrieve"}:
                state.legal_actions = [{"type": ActionType.SELECT_MARKET_CARD.value, "card_id": card, "label": f"选择 {self.content.cards.get(card, {}).get('name', card)}"} for card in state.pending_choice.get("cards", [])]
            state.action_options = self._build_action_options(state.legal_actions, state)
            return state

        # The intent board is part of the normal action phase. Older persisted
        # states may still carry the removed planning phase, but their marks
        # must survive until the end-of-round settlement.
        if state.shared.phase == "planning":
            state.shared.phase = "player_action"
        has_current_plan = any(str(mark.get("turn")) == str(state.shared.turn) for mark in state.shared.planning_marks.get(active.id, []))
        actions: list[dict[str, Any]] = [{"type": ActionType.END_TURN.value, "label": "\u7ed3\u675f\u56de\u5408"}]
        if not has_current_plan:
            actions.append({"type": ActionType.PLAN.value, "label": "\u653e\u7f6e\u89c4\u5212\u6807\u8bb0", "cost": 0})
        site = state.sites[active.location]
        if not has_current_plan:
            actions.extend({"type": ActionType.PLAN.value, "target_id": site_id, "label": self.content.sites[site_id]["name"], "cost": 0} for site_id in state.sites)
            actions.extend({"type": ActionType.PLAN.value, "target_id": route_id, "label": f"路线：{next((item.get('name') for item in self.content.routes if item['id'] == route_id), route_id)}", "cost": 0} for route_id in state.routes)
            actions.extend({"type": ActionType.PLAN.value, "target_id": project_id, "label": f"项目：{state.projects[project_id].name}", "cost": 0} for project_id in state.projects)
        if site.status != SiteStatus.CLOSED and active.ap > 0:
            for route in self.content.routes:
                if active.location not in {route["from"], route["to"]}:
                    continue
                target = route["to"] if route["from"] == active.location else route["from"]
                if not self._open(state, target):
                    continue
                route_state = state.routes.get(route["id"])
                if route_state and self._route_open(state, route["id"]):
                    base_cost = 0 if active.flags.get("free_move") else route_state.cost
                    actions.append({"type": ActionType.MOVE.value, "target_id": target, "label": f"\u524d\u5f80 {self.content.sites[target]['name']}", "cost": self._event_action_cost(state, "move", base_cost), "route_id": route["id"]})
            if active.flags.get("sprint_move"):
                for target in self._reachable(state, active.location, 2):
                    if target != active.location and not any(item.get("target_id") == target for item in actions):
                        actions.append({"type": ActionType.MOVE.value, "target_id": target, "label": f"\u75be\u884c\u81f3 {self.content.sites[target]['name']}", "cost": 1})
            if active.ap >= 1:
                actions.extend({"type": ActionType.EXPLORE.value, "target_id": active.location, "card_id": card, "label": f"\u63a2\u7d22\u5e76\u9009\u62e9 {self.content.cards[card]['name']}", "cost": 1} for card in state.market)
            if active.ap >= 1 and state.shared.restoration_resource > 0 and site.damage > 0:
                actions.append({"type": ActionType.RESTORE.value, "target_id": active.location, "label": "\u5171\u540c\u4fee\u62a4\u5f53\u524d\u8282\u70b9", "cost": self._event_action_cost(state, "restore", 1)})
            for route in self.content.routes:
                if active.location not in {route["from"], route["to"]}:
                    continue
                target = route["to"] if route["from"] == active.location else route["from"]
                route_state = state.routes.get(route["id"])
                if not route_state:
                    continue
                if route_state.status in {"strained", "blocked"}:
                    actions.append({"type": ActionType.SURVEY_ROUTE.value, "route_id": route["id"], "target_id": target, "label": f"\u52d8\u5bdf\u8def\u7ebf · {self.content.sites[target]['name']}", "cost": self._event_action_cost(state, "survey_route", 1)})
                if route_state.status in {"strained", "blocked"} and state.shared.research_clues > 0:
                    actions.append({"type": ActionType.RESTORE_ROUTE.value, "route_id": route["id"], "target_id": target, "label": f"\u4fee\u62a4\u8def\u7ebf · {self.content.sites[target]['name']}", "cost": self._event_action_cost(state, "restore_route", 1)})
                if route_state.status == "restored" and route_state.connection_level < 1:
                    actions.append({"type": ActionType.ESTABLISH_CONNECTION.value, "route_id": route["id"], "target_id": target, "label": f"\u5efa\u7acb\u8fde\u63a5 · {self.content.sites[target]['name']}", "cost": self._event_action_cost(state, "establish_connection", 1)})
            if state.shared.current_event_id and state.shared.current_event_id not in state.shared.prepared_event_ids:
                actions.append({"type": ActionType.PREPARE.value, "label": "\u51c6\u5907\u5e94\u5bf9\u4e8b\u4ef6", "cost": 1})
            task = state.tasks.get(self.content.sites[active.location].get("active_task_id"))
            if task and not task["completed"]:
                interpretation = self._ensure_interpretation(task)
                placed = {item["card_id"] for item in interpretation["placements"]}
                if not interpretation["formed"] and active.ap >= 1:
                    for card in active.hand:
                        if card not in placed and self._card_can_contribute(card, task):
                            for relation, label in (("support", "支持"), ("conflict", "冲突"), ("pending", "待确认")):
                                actions.append({"type": ActionType.INTERPRET_EVIDENCE.value, "target_id": relation, "target_site_id": active.location, "card_id": card, "label": f"将 {self.content.cards[card]['name']} 归入{label}", "cost": self._event_action_cost(state, "interpret_evidence", 1)})
                if not interpretation["formed"] and self._interpretation_ready(task):
                    actions.append({"type": ActionType.FORM_INTERPRETATION.value, "target_id": active.location, "label": "形成当前解释", "cost": 0})
                if interpretation["formed"] and not interpretation["intervention"]:
                    actions.extend({"type": ActionType.CHOOSE_INTERVENTION.value, "target_id": choice, "target_site_id": active.location, "label": label, "cost": 0} for choice, label in (("act_now", "立即处理"), ("minimal", "最小干预"), ("record", "先记录")))
            actions.extend({"type": ActionType.PLAY_CARD.value, "card_id": card, "label": f"\u4f7f\u7528 {self.content.cards[card]['name']}"} for card in active.hand)
            actions.extend({
                "type": ActionType.USE_ACTION_CARD.value,
                "card_id": card,
                "label": f"\u4f7f\u7528\u7b56\u7565\uff1a{self.content.action_cards[card]['name']}",
                "cost": int(self.content.action_cards[card].get("cost", 1)),
                "enabled": self._action_card_timing_allowed(state, self.content.action_cards[card]),
                "disabled_reason": f"\u5f53\u524d\u4e0d\u80fd\u4f7f\u7528 \u00b7 \u65f6\u673a\uff1a{self.content.action_cards[card].get('timing', '\u5f53\u524d\u884c\u52a8\u9636\u6bb5')}",
            } for card in active.action_hand)
            ability = self.content.sites[active.location].get("node_ability", {})
            ability_key = f"{active.location}:use_node_ability:{state.shared.turn}"
            if ability.get("trigger") == "once_per_round" and ability_key not in state.shared.node_ability_uses:
                actions.append({"type": ActionType.USE_NODE_ABILITY.value, "label": ability.get("name", "使用地点能力"), "cost": int(ability.get("cost", 1))})
            if self._has_upgrade_effect(active, "archive_retrieve") and active.flags.get("archive_retrieve_round") != state.shared.turn:
                if any(self.content.cards.get(card, {}).get("domain") in {self.content.cards[item].get("domain") for item in active.hand} for card in state.decks.get("archive", [])):
                    actions.append({"type": ActionType.USE_UPGRADE.value, "upgrade_id": "archive_retrieve", "label": "档案回收", "cost": 1})
            for other_id, other in state.players.items():
                if other_id != active.id and (other.location == active.location or active.flags.get("remote_exchange_player_id") == other_id):
                    exchange_cost = 0 if active.flags.get("free_exchange") or active.flags.get("exchange_discount") or active.flags.get("remote_exchange_player_id") == other_id else self._event_action_cost(state, "exchange", 1)
                    actions.extend({"type": ActionType.EXCHANGE.value, "target_id": other_id, "card_id": card, "label": f"\u4ea4\u7ed9 {other.name}：{self.content.cards[card]['name']}", "cost": exchange_cost} for card in active.hand)
        role = self.content.roles[active.role_id]
        if active.ap >= role.get("ability", {}).get("ap_cost", 1) and not active.skill_used:
            actions.append({"type": ActionType.USE_SKILL.value, "label": role["ability"]["name"], "skill": role["ability"]["action"], "cost": role["ability"].get("ap_cost", 1)})
        actions = [action for action in actions if action["type"] != ActionType.PLAN.value or action.get("target_id")]
        state.legal_actions = actions
        state.action_options = self._build_action_options(actions, state)
        self._update_objectives(state)
        return state

    def apply(self, state: GameState, req: dict[str, Any]):
        request_id = req.get("request_id")
        if request_id and request_id in state.processed_request_ids:
            return state
        self._ensure_runtime_state(state)
        if state.shared.outcome:
            raise ValueError("game_is_over")
        if state.pending_choice:
            pid = req.get("player_id", state.shared.active_player_id)
            before = self._metric_snapshot(state, pid)
            before_weathering = state.shared.weathering_track
            result = self._resolve_choice(state, req)
            after = self._metric_snapshot(result, pid)
            changes = self._feedback_changes(before, after)
            self._record_journal(state, req.get("action", "choice"), pid, "共同决定已结算", changes)
            self._remember_request(state, request_id)
            result.feedback_events = [FeedbackEvent(message="共同决定已结算，事件、证据或角色状态已经更新。", changes=changes)]
            return result
        pid, action = req["player_id"], req["action"]
        site_id = req.get("target_site_id")
        if not site_id and action in {ActionType.RESTORE.value, ActionType.USE_NODE_ABILITY.value}:
            site_id = state.players[pid].location
        route_id = req.get("route_id")
        before = self._metric_snapshot(state, pid, site_id=site_id, route_id=route_id)
        if pid != state.shared.active_player_id:
            raise ValueError("not_active_player")
        player = state.players[pid]
        target = req.get("target_site_id") or req.get("target_id")
        if action == ActionType.MOVE.value: self._move(state, player, target)
        elif action == ActionType.EXPLORE.value: self._request_explore(state, player, req.get("card_id"))
        elif action == ActionType.INTERPRET_EVIDENCE.value: self._interpret_evidence(state, player, req.get("target_site_id") or player.location, req.get("card_id"), req.get("target_id"))
        elif action == ActionType.FORM_INTERPRETATION.value: self._form_interpretation(state, player, target or player.location)
        elif action == ActionType.CHOOSE_INTERVENTION.value: self._choose_intervention(state, player, req.get("target_site_id") or player.location, req.get("target_id"))
        elif action == ActionType.RESTORE.value: self._restore(state, player, target)
        elif action == ActionType.EXCHANGE.value: self._exchange(state, player, target, req.get("card_id"))
        elif action == ActionType.USE_SKILL.value: self._skill(state, player)
        elif action == ActionType.PLAY_CARD.value: self._play_card(state, player, req.get("card_id"))
        elif action == ActionType.USE_ACTION_CARD.value: self._use_action_card(state, player, req.get("card_id"), req.get("target_id") or req.get("route_id"), req.get("target_ids"))
        elif action == ActionType.USE_NODE_ABILITY.value: self._use_node_ability(state, player, target or player.location)
        elif action == ActionType.USE_UPGRADE.value: self._use_upgrade(state, player, req.get("upgrade_id"))
        elif action == ActionType.SURVEY_ROUTE.value: self._survey_route(state, player, req.get("route_id"))
        elif action == ActionType.RESTORE_ROUTE.value: self._restore_route(state, player, req.get("route_id"))
        elif action == ActionType.ESTABLISH_CONNECTION.value: self._establish_connection(state, player, req.get("route_id"))
        elif action == ActionType.PREPARE.value: self._prepare(state, player)
        elif action == ActionType.END_TURN.value: self._end_turn(state, player)
        elif action == ActionType.PLAN.value: self._plan(state, player, target)
        elif action == ActionType.END_PLANNING.value: self._end_planning(state, player)
        else: raise ValueError("unknown_action")
        if action not in {ActionType.PLAN.value, ActionType.END_TURN.value, ActionType.END_PLANNING.value}:
            self._resolve_planning_collaboration(state, player, action, req)
        state.revision += 1
        self._remember_request(state, request_id)
        if not req.get("_preview"):
            self._check_outcome(state)
        result = state if req.get("_preview") else self.refresh(state)
        after_player = result.players.get(pid)
        after = self._metric_snapshot(result, pid, site_id=site_id, route_id=route_id)
        changes = self._feedback_changes(before, after)
        self._record_journal(state, action, pid, self._journal_message(action, target, req), changes)
        result.feedback_events = [FeedbackEvent(message=self._feedback_message(action), changes=changes)]
        return result

    def _journal_message(self, action: str, target: str | None, req: dict[str, Any]) -> str:
        labels = {"move": "移动", "explore": "寻访文化线索", "interpret_evidence": "研判证据", "form_interpretation": "形成解释", "choose_intervention": "选择干预", "restore": "修护节点", "exchange": "交换证据", "use_skill": "使用角色技能", "play_card": "使用文化牌", "use_action_card": "使用策略牌", "survey_route": "勘察路线", "restore_route": "修护路线", "establish_connection": "建立区域连接", "prepare": "准备事件", "end_turn": "结束回合", "plan": "放置规划标记", "end_planning": "开始行动"}
        target_label = target
        if target:
            target_label = self.content.sites.get(target, {}).get("name") or self.content.projects.get(target, {}).get("name")
            if not target_label:
                route = next((item for item in self.content.routes if item.get("id") == target), None)
                if route:
                    source = self.content.sites.get(route.get("from"), {}).get("name", route.get("from"))
                    destination = self.content.sites.get(route.get("to"), {}).get("name", route.get("to"))
                    target_label = route.get("name") or f"{source}—{destination}"
            if not target_label:
                target_label = "同行者" if str(target).startswith(("player-", "seat-")) else target
        return labels.get(action, "完成一项行动") + (f"（目标：{target_label}）" if target_label else "")

    @staticmethod
    def _feedback_message(action: str) -> str:
        return {
            "move": "已抵达新地点，新的线索与风险已经显影。",
            "explore": "文化线索已进入手牌，可用于当前地点的互证。",
            "interpret_evidence": "证据已归入研究台，关系判断已记录。",
            "form_interpretation": "当前解释已经形成，可以选择如何回应。",
            "choose_intervention": "干预已经写入遗产网络，现场与共同目标已更新。",
            "use_action_card": "策略牌已结算，资源、路线与旅程记录已经更新。",
            "end_turn": "本角色行动结束，旅程正在交接给下一位同行者。",
        }.get(action, "行动已记录，世界状态已经更新。")

    @staticmethod
    def _metric_snapshot(state: GameState, player_id: str, site_id: str | None = None, route_id: str | None = None) -> dict[str, int]:
        player = state.players.get(player_id)
        snapshot = {"ap": player.ap if player else 0, "research_clues": state.shared.research_clues, "restoration_resource": state.shared.restoration_resource, "weathering": state.shared.weathering_track, "influence": state.shared.influence}
        if site_id and site_id in state.sites:
            snapshot["site_damage"] = state.sites[site_id].damage
            snapshot["site_influence"] = state.sites[site_id].influence
        if route_id and route_id in state.routes:
            snapshot["route_risk"] = state.routes[route_id].risk
        return snapshot

    @staticmethod
    def _feedback_changes(before: dict[str, int], after: dict[str, int]) -> list[FeedbackChange]:
        labels = {"ap": "行动点", "research_clues": "研究线索", "restoration_resource": "修护资源", "weathering": "风化压力", "influence": "共同影响", "site_damage": "节点损伤", "site_influence": "地点影响", "route_risk": "路线风险"}
        return [FeedbackChange(metric=key, label=labels.get(key, key), before=before[key], after=after[key], delta=after[key] - before[key]) for key in before if after.get(key) != before[key]]

    def _record_journal(self, state: GameState, action: str, player_id: str, message: str, changes: list[FeedbackChange] | None = None) -> None:
        kind = "event" if action in {"resolve_event", "prepare"} else "project" if action in {"interpret_evidence", "form_interpretation", "choose_intervention", "restore", "restore_route", "establish_connection"} else "action"
        state.shared.journal.append(JournalEntry(id=f"journal-{state.revision + len(state.shared.journal) + 1}", round=state.shared.turn, type=kind, message=message, effects=[change.model_dump() for change in (changes or [])], created_at=datetime.now(timezone.utc).isoformat(), player_id=player_id))
        del state.shared.journal[:-120]

    def _remember_request(self, state, request_id):
        if not request_id:
            return
        if request_id not in state.processed_request_ids:
            state.processed_request_ids.append(request_id)
            del state.processed_request_ids[:-200]

    def _move(self, state, player, target):
        route = next((item for item in self.content.routes if {item["from"], item["to"]} == {player.location, target}), None)
        sprint = bool(player.flags.get("sprint_move"))
        if not self._open(state, target): raise ValueError("invalid_route")
        if not route and sprint and target in self._reachable(state, player.location, 2):
            cost = 1
            route_state = None
        elif route and self._route_open(state, route["id"]):
            route_state = state.routes[route["id"]]
            discount = int(player.flags.pop("next_move_discount", 0))
            cost = self._event_action_cost(state, "move", max(0, (0 if player.flags.pop("free_move", False) else route_state.cost) - discount))
            if player.flags.pop("ignore_route_risk", False): cost = max(0, cost - min(route_state.risk, 1))
            if player.flags.pop("sprint_move", False): cost = 1
        else:
            raise ValueError("invalid_route")
        if player.ap < cost: raise ValueError("not_enough_ap")
        origin = player.location
        player.flags.pop("sprint_move", None)
        player.ap -= cost; player.location = target
        self._trigger_node_ability(state, player, origin, trigger="first_move_from_site_per_round")
        self._trigger_node_ability(state, player, target, trigger="on_arrival")
        state.shared.log.append(f"{player.name} \u62b5\u8fbe {self.content.sites[target]['name']}")

    def _explore(self, state, player, card):
        if player.ap < 1 or card not in state.market or len(player.hand) >= 3: raise ValueError("invalid_explore")
        player.ap -= 1; player.hand.append(card); state.market.remove(card)
        if player.flags.pop("reserve_market_card", False) and state.market:
            state.shared.reserved_market_cards.append(state.market.pop(0))
        self._refill_market(state); state.sites[player.location].discovered = True
        state.shared.research_clues += 1
        project = state.projects.get(state.sites[player.location].active_project_id or "")
        self._advance_project(state, project, player.id, "explore", card, {"research_clues": 1})
        self._trigger_node_ability(state, player, player.location, card_id=card, trigger="first_explore")
        self._trigger_node_ability(state, player, player.location, card_id=card, trigger="after_explore")
        self._emit_scenario_rule(state, "after_explore", {"player_id": player.id, "site_id": player.location, "card_id": card})
        state.shared.log.append(f"{player.name} \u5728 {self.content.sites[player.location]['name']} \u53d1\u73b0\u4e86 {self.content.cards[card]['name']}")

    def _request_explore(self, state, player, card):
        if player.ap < 1 or card not in state.market:
            raise ValueError("invalid_explore")
        if len(player.hand) >= 3:
            state.pending_choice = {"kind": "discard", "next_card_id": card, "options": [{"id": item, "label": f"放下 {self.content.cards[item]['name']}"} for item in player.hand]}
            state.shared.phase = "pending_choice"
            return
        self._explore(state, player, card)

    def _ensure_interpretation(self, task):
        interpretation = task.setdefault("interpretation", {})
        interpretation.setdefault("placements", [])
        interpretation.setdefault("formed", False)
        interpretation.setdefault("intervention", None)
        interpretation.setdefault("confidence", 0)
        return interpretation

    def _interpret_evidence(self, state, player, site_id, card, relation):
        task_id = self.content.sites.get(site_id, {}).get("active_task_id")
        task = state.tasks.get(task_id)
        action_cost = self._event_action_cost(state, "interpret_evidence", 1)
        if relation not in {"support", "conflict", "pending"} or player.ap < action_cost or player.location != site_id or not task or task["completed"] or card not in player.hand or not self._card_can_contribute(card, task): raise ValueError("invalid_interpretation_evidence")
        interpretation = self._ensure_interpretation(task)
        if interpretation["formed"] or any(item["card_id"] == card for item in interpretation["placements"]): raise ValueError("evidence_already_placed")
        player.ap -= action_cost; player.hand.remove(card); player.contributions += 1
        definition = self.content.cards[card]
        origin_tags, combo_tags = list(definition.get("origin_tags", [])), list(definition.get("combo_tags", []))
        if player.flags.pop("temporary_origin_tag", None): origin_tags.append("temporary_cross_origin")
        if player.flags.get("harmony_active") and self._has_upgrade_effect(player, "harmony_origin_bonus"):
            origin_tags.append("harmony_origin"); combo_tags.append("cross_origin")
        placement = {"player_id": player.id, "card_id": card, "relation": relation, "origin_tags": origin_tags, "combo_tags": combo_tags}
        interpretation["placements"].append(placement)
        task["contributed_cards"].append(card); task.setdefault("contribution_records", []).append(placement)
        task.setdefault("contributed_by_player", {})[player.id] = task.setdefault("contributed_by_player", {}).get(player.id, 0) + 1
        if player.id not in task.setdefault("contributing_player_ids", []): task["contributing_player_ids"].append(player.id)
        site = state.sites[site_id]; site.contributions.append(placement); site.influence += 1
        project = state.projects.get(site.active_project_id or "")
        if project and project.status == "active" and relation != "conflict": self._advance_project(state, project, player.id, "interpret_evidence", card)
        state.decks.setdefault("archive", []).append(card)
        bonus = player.flags.pop("next_contribute_bonus", 0)
        if bonus:
            player.influence += bonus; state.shared.influence += bonus
            state.shared.log.append(f"{player.name} \u7684\u534f\u4f5c\u52a0\u6210\u751f\u6548\uff1a\u5f71\u54cd\u529b +{bonus}")
        self._trigger_node_ability(state, player, site_id, card_id=card, trigger="after_interpret_evidence")
        self._emit_scenario_rule(state, "after_interpret_evidence", {"player_id": player.id, "site_id": site_id, "task": task})
        if player.flags.pop("post_contribution_clue", False): state.shared.research_clues += 1
        if self._has_upgrade_effect(player, "post_contribution_clue"):
            task_origins = {origin for item in site.contributions if item.get("card_id") in task["contributed_cards"] for origin in item.get("origin_tags", [])}
            if len(task_origins) >= 2: state.shared.research_clues += 1

    def _evaluate_interpretation(self, task):
        interpretation = self._ensure_interpretation(task)
        usable = [item for item in interpretation["placements"] if item.get("relation") != "conflict"]
        cards = [self.content.cards[item["card_id"]] for item in usable if item.get("card_id") in self.content.cards]
        origins = {origin for item in usable for origin in item.get("origin_tags", [])}
        domains = {item.get("domain") for item in cards}
        tags = {tag for item in usable for tag in item.get("combo_tags", [])}
        combo = task.get("combo_requirement", {})
        missing_domains = sorted(set(task.get("required_domains", [])) - domains)
        preferred_origins = set(combo.get("preferred_origins", []))
        missing_origins = sorted(preferred_origins - origins) if preferred_origins else []
        origin_target = len(preferred_origins) or int(task.get("required_origin_diversity", 0))
        missing_tags = sorted(set(combo.get("required_combo_tags", [])) - tags)
        has_support = any(item.get("relation") == "support" for item in usable)
        support = sum(item.get("relation") == "support" for item in interpretation["placements"])
        conflict = sum(item.get("relation") == "conflict" for item in interpretation["placements"])
        confidence = max(0, support * 2 - conflict)
        required_domains = set(task.get("required_domains", []))
        contributors = {item.get("player_id") for item in interpretation["placements"] if item.get("player_id")}
        contributor_target = int(combo.get("minimum_distinct_players", 1))
        missing_contributors = max(0, contributor_target - len(contributors))
        requirements = [
            {"key": "cards", "label": "证据数量", "current": len(cards), "target": int(task.get("required_card_count", 0)), "complete": len(cards) >= int(task.get("required_card_count", 0))},
            {"key": "domains", "label": "研究领域", "current": len(domains & required_domains), "target": len(required_domains), "complete": not missing_domains, "missing": missing_domains},
            {"key": "origins", "label": "证据来源", "current": len(origins & preferred_origins) if preferred_origins else len(origins), "target": origin_target, "complete": len(origins) >= origin_target and not missing_origins, "missing": missing_origins},
            {"key": "combos", "label": "组合线索", "current": len(tags & set(combo.get("required_combo_tags", []))), "target": len(combo.get("required_combo_tags", [])), "complete": not missing_tags, "missing": missing_tags},
            {"key": "contributors", "label": "共同参与", "current": len(contributors), "target": contributor_target, "complete": missing_contributors == 0, "missing": [f"还需要 {missing_contributors} 位不同同行者"] if missing_contributors else []},
        ]
        reason_parts = []
        if not has_support: reason_parts.append("还需要至少一件支持证据")
        if len(cards) < int(task.get("required_card_count", 0)): reason_parts.append(f"还需要 {int(task.get('required_card_count', 0)) - len(cards)} 件证据")
        if missing_domains: reason_parts.append("还需要补齐研究领域")
        if missing_origins: reason_parts.append("还需要不同来源的证据")
        if missing_tags: reason_parts.append("还需要完成关键组合互证")
        if missing_contributors: reason_parts.append(f"还需要 {missing_contributors} 位不同同行者参与")
        if not reason_parts: reason_parts.append("条件已经满足，可以形成解释")
        return {
            "cards": len(cards), "cards_target": int(task.get("required_card_count", 0)),
            "domains": sorted(domains), "missing_domains": missing_domains,
            "origins": sorted(origins), "origins_target": origin_target, "missing_origins": missing_origins,
            "missing_tags": missing_tags, "has_support": has_support,
            "contributors": sorted(contributors), "contributors_target": contributor_target, "missing_contributors": missing_contributors,
            "support": support, "conflict": conflict, "pending": sum(item.get("relation") == "pending" for item in interpretation["placements"]),
            "confidence": confidence, "requirements": requirements, "reason": "；".join(reason_parts),
            "can_form": bool(has_support and len(cards) >= int(task.get("required_card_count", 0)) and not missing_domains and len(origins) >= origin_target and not missing_origins and not missing_tags and missing_contributors == 0),
        }

    def _interpretation_ready(self, task):
        return self._evaluate_interpretation(task)["can_form"]

    def _form_interpretation(self, state, player, site_id):
        task = state.tasks.get(self.content.sites.get(site_id, {}).get("active_task_id"))
        if player.location != site_id or not task or task["completed"] or not self._interpretation_ready(task): raise ValueError("interpretation_not_ready")
        interpretation = self._ensure_interpretation(task)
        if interpretation["formed"]: raise ValueError("interpretation_already_formed")
        interpretation["formed"] = True; interpretation["confidence"] = self._evaluate_interpretation(task)["confidence"]

    def _choose_intervention(self, state, player, site_id, intervention):
        task = state.tasks.get(self.content.sites.get(site_id, {}).get("active_task_id"))
        if intervention not in {"act_now", "minimal", "record"} or player.location != site_id or not task or task["completed"]: raise ValueError("invalid_intervention")
        interpretation = self._ensure_interpretation(task)
        if not interpretation["formed"] or interpretation["intervention"]: raise ValueError("intervention_not_available")
        site = state.sites[site_id]; reward = task.get("reward", {})
        confidence = int(interpretation.get("confidence", self._evaluate_interpretation(task)["confidence"]))
        interpretation["intervention"] = intervention; task["completed"] = True
        domain = reward.get("domain")
        if domain and domain not in state.shared.completed_domains: state.shared.completed_domains.append(domain)
        if intervention == "act_now":
            state.shared.influence += 2; state.shared.restoration_resource += int(reward.get("restoration_delta", 0)); site.damage = max(0, site.damage - 1)
            if confidence <= 2: state.shared.weathering_track += 1
        elif intervention == "minimal":
            state.shared.influence += 1; state.shared.weathering_track = max(0, state.shared.weathering_track - 1); site.damage = max(0, site.damage - 1)
        else:
            state.shared.research_clues += 3 if confidence <= 2 else 2; state.shared.weathering_track = max(0, state.shared.weathering_track - 1)
        project = state.projects.get(site.active_project_id or "")
        if project and intervention != "record": self._advance_project(state, project, player.id, "choose_intervention")
        self._update_site(site); self._trigger_node_ability(state, player, site_id, trigger="task_completed")

    def _restore(self, state, player, site_id):
        if player.location != site_id: raise ValueError("invalid_restore")
        action_cost = self._event_action_cost(state, "restore", 1)
        if player.ap < action_cost: raise ValueError("not_enough_ap")
        site = state.sites[site_id]
        if site.damage <= 0 or site.status == SiteStatus.CLOSED: raise ValueError("site_does_not_need_restoration")
        discount = int(player.flags.get("restore_discount", 0))
        if self._has_upgrade_effect(player, "project_restore_discount") and player.flags.get("project_restore_discount_round") != state.shared.turn:
            discount = max(discount, 1); player.flags["project_restore_discount_round"] = state.shared.turn
        resource_cost = 0 if discount else 1
        if resource_cost and state.shared.restoration_resource < resource_cost and player.supplies < resource_cost: raise ValueError("not_enough_restoration_resource")
        player.ap -= action_cost
        if resource_cost:
            if state.shared.restoration_resource >= resource_cost: state.shared.restoration_resource -= resource_cost
            else: player.supplies -= resource_cost
        elif player.flags.get("restore_discount", 0): player.flags["restore_discount"] -= 1
        site.damage -= 1; self._update_site(site)
        self._advance_project(state, state.projects.get(site.active_project_id or ""), player.id, "restore", receipts={"restoration_resource": resource_cost})
        self._emit_scenario_rule(state, "after_restore", {"player_id": player.id, "site_id": site_id})

    def _survey_route(self, state, player, route_id):
        route = state.routes.get(route_id)
        if not route or player.location not in {route.from_site, route.to_site} or route.status not in {"strained", "blocked"}: raise ValueError("invalid_route_survey")
        self._trigger_node_ability(state, player, player.location, trigger="after_route_action")
        cost = 0 if player.flags.pop("sprint_survey_available", False) else max(0, 1 - int(player.flags.pop("route_action_discount", 0)))
        cost = self._event_action_cost(state, "survey_route", cost)
        if player.ap < cost: raise ValueError("not_enough_ap")
        player.ap -= cost; state.shared.research_clues += 1; route.status = "strained"; route.risk = max(0, route.risk - 1)

    def _restore_route(self, state, player, route_id):
        route = state.routes.get(route_id)
        action_cost = self._event_action_cost(state, "restore_route", 1)
        if player.ap < action_cost or not route or player.location not in {route.from_site, route.to_site} or route.status not in {"strained", "blocked"}: raise ValueError("invalid_route_restoration")
        self._trigger_node_ability(state, player, player.location, trigger="after_route_action")
        clue_cost = 0 if player.flags.pop("route_action_discount", 0) or (self._has_upgrade_effect(player, "route_action_discount") and player.flags.get("route_discount_round") != state.shared.turn) else 1
        if state.shared.research_clues < clue_cost: raise ValueError("not_enough_research_clues")
        player.ap -= action_cost; state.shared.research_clues -= clue_cost; player.flags["route_discount_round"] = state.shared.turn; route.status = "restored"; route.risk = 0; route.connection_level = max(1, route.connection_level)

    def _establish_connection(self, state, player, route_id):
        route = state.routes.get(route_id)
        action_cost = self._event_action_cost(state, "establish_connection", 1)
        if player.ap < action_cost or not route or player.location not in {route.from_site, route.to_site} or route.status != "restored": raise ValueError("invalid_connection")
        player.ap -= action_cost; route.status = "illuminated"; route.connection_level = 2; state.shared.route_connection_score += 1
        self._emit_scenario_rule(state, "after_establish_connection", {"player_id": player.id, "route_id": route_id})

    def _prepare(self, state, player):
        if player.ap < 1 or not state.shared.current_event_id: raise ValueError("invalid_prepare")
        player.ap -= 1
        event_id = state.shared.current_event_id
        if event_id not in state.shared.prepared_event_ids: state.shared.prepared_event_ids.append(event_id)
        player.flags["prepared_event_id"] = event_id
        state.shared.log.append(f"{player.name} \u5df2\u51c6\u5907\u5e94\u5bf9\u4e8b\u4ef6\uff1a{self.content.events[event_id]['name']}")

    def _exchange(self, state, player, recipient_id, card):
        recipient = state.players.get(recipient_id)
        remote = player.flags.get("remote_exchange_player_id") == recipient_id
        free = bool(player.flags.pop("free_exchange", False) or player.flags.pop("exchange_discount", 0))
        if not recipient or (recipient.location != player.location and not remote) or card not in player.hand or len(recipient.hand) >= 3: raise ValueError("invalid_exchange")
        cost = 0 if free else self._event_action_cost(state, "exchange", 1)
        if player.ap < cost: raise ValueError("not_enough_ap")
        player.ap -= cost; player.hand.remove(card); recipient.hand.append(card)
        if remote: player.flags.pop("remote_exchange_player_id", None)
        self._trigger_node_ability(state, player, player.location, trigger="after_exchange")

    def _skill(self, state, player):
        role = self.content.roles[player.role_id]; ability = role["ability"]; cost = ability.get("ap_cost", 1)
        if player.skill_used or player.ap < cost: raise ValueError("skill_unavailable")
        if ability["action"] == "fine_repair":
            site = state.sites[player.location]
            if site.damage <= 0 or state.shared.restoration_resource < 1: raise ValueError("nothing_to_repair")
            player.ap -= cost; state.shared.restoration_resource -= 1; site.damage = max(0, site.damage - 2); self._update_site(site)
            if self._has_upgrade_effect(player, "fine_repair_weathering_bonus") and site.damage > 0: state.shared.weathering_track = max(0, state.shared.weathering_track - 1)
        elif ability["action"] == "harmony_hint": player.ap -= cost; player.flags["harmony_active"] = True
        elif ability["action"] == "sprint_move": player.ap -= cost; player.flags["sprint_move"] = True; player.flags["sprint_survey_available"] = self._has_upgrade_effect(player, "sprint_survey")
        elif ability["action"] == "view_select":
            player.ap -= cost
            count = 4 if self._has_upgrade_effect(player, "market_look_bonus") else 3
            preview = list(state.market)
            preview.extend(state.decks["culture"][: max(0, count - len(preview))])
            state.pending_choice = {"kind": "view_select", "cards": preview[:count]}; player.skill_used = True; return
        player.skill_used = True

    def _play_card(self, state, player, card):
        if card not in player.hand: raise ValueError("card_not_in_hand")
        player.hand.remove(card); state.decks.setdefault("discard", []).append(card); self._effect(state, player, self.content.cards[card].get("effect", {}))

    def _action_card_timing_allowed(self, state, card):
        timing = str(card.get("timing", "")).strip()
        if state.pending_choice and state.pending_choice.get("kind") == "event":
            return "事件响应" in timing
        if "事件响应" in timing: return bool(state.pending_choice and state.pending_choice.get("kind") == "event")
        if "事件预告" in timing: return state.shared.phase == "player_action" and bool(state.shared.current_event_id)
        return state.shared.phase == "player_action" and not state.pending_choice

    def _use_action_card(self, state, player, card, target_id=None, target_ids=None, force_event_response=False):
        if card not in player.action_hand or card not in self.content.action_cards: raise ValueError("action_card_unavailable")
        definition = self.content.action_cards[card]; effect = definition.get("effect", {}); typ = effect.get("type")
        if not self._action_card_timing_allowed(state, definition) and not (force_event_response and "事件响应" in str(definition.get("timing", ""))): raise ValueError("action_card_wrong_timing")
        cost = int(definition.get("cost", 1))
        if player.ap < cost: raise ValueError("not_enough_ap")
        adjacent = [route for route in state.routes.values() if player.location in {route.from_site, route.to_site}]
        route_effects = {"survey_route", "survey_and_mitigate", "survey_multiple_routes", "reduce_route_risk", "restore_route", "establish_connection", "restore_and_move"}
        candidates = [route for route in adjacent if route.status in ({"restored"} if typ == "establish_connection" else {"blocked", "strained"})]
        if typ == "remote_exchange_or_connect" and not target_id:
            options = [{"id": item.id, "label": f"队友 · {item.name}"} for item in state.players.values() if item.id != player.id] + [{"id": route.id, "label": "路线 · 已修复连接"} for route in adjacent if route.status == "restored"]
            if not options: raise ValueError("no_valid_action_card_target")
            self._set_action_card_choice(state, card, options); return
        if typ == "transfer_resource" and not target_id:
            options = [{"id": item.id, "label": f"队友 · {item.name}"} for item in state.players.values() if item.id != player.id and item.location == player.location]
            if not options: raise ValueError("no_valid_action_card_target")
            self._set_action_card_choice(state, card, options); return
        if typ == "team_prepare" and not target_id and not target_ids:
            options = [{"id": item.id, "label": f"值守 · {item.name}"} for item in state.players.values()]
            self._set_action_card_choice(state, card, options); return
        if typ in route_effects and not target_id:
            if not candidates: raise ValueError("no_valid_action_card_target")
            self._set_action_card_choice(state, card, [{"id": route.id, "label": f"{self.content.sites[route.from_site]['name']} → {self.content.sites[route.to_site]['name']} · {route.status}"} for route in candidates]); return
        stressed = next((route for route in candidates if route.id == target_id), None)
        if typ in route_effects and not stressed: raise ValueError("invalid_action_card_target")
        if typ == "remote_exchange_or_connect" and target_id not in {item.id for item in state.players.values() if item.id != player.id} | {route.id for route in adjacent if route.status == "restored"}: raise ValueError("invalid_action_card_target")
        if typ == "transfer_resource" and target_id not in {item.id for item in state.players.values() if item.id != player.id and item.location == player.location}: raise ValueError("invalid_action_card_target")
        if typ == "team_prepare":
            selected = list(dict.fromkeys(target_ids or ([target_id] if target_id else [])))
            if not selected or any(item not in state.players for item in selected): raise ValueError("invalid_action_card_target")
            effect = {**effect, "_target_ids": selected}
        if typ == "restore_route" and not effect.get("ignore_clue_cost") and state.shared.research_clues < 1: raise ValueError("not_enough_research_clues")
        player.ap -= cost
        player.action_hand.remove(card); state.decks.setdefault("action_discard", []).append(card)
        self._dispatch_action_card_effect(state, player, effect, target_id, adjacent, stressed)

    def _set_action_card_choice(self, state, card, options):
        resume = state.pending_choice if state.pending_choice and state.pending_choice.get("kind") == "event" else None
        choice = {"kind": "action_card", "card_id": card, "options": options}
        if resume: choice["resume_choice"] = resume
        state.pending_choice = choice

    def _dispatch_action_card_effect(self, state, player, effect, target_id, adjacent, stressed):
        handler_name = ACTION_CARD_EFFECT_HANDLERS.get(effect.get("type", ""))
        if not handler_name:
            raise ValueError(f"unsupported_action_card_effect:{effect.get('type')}")
        getattr(self, handler_name)(state, player, effect, target_id, adjacent, stressed)

    def _action_card_survey_route(self, state, player, effect, target_id, adjacent, stressed): self._action_card_survey_routes(state, effect, stressed)
    def _action_card_survey_multiple_routes(self, state, player, effect, target_id, adjacent, stressed):
        routes = [route for route in adjacent if route.status in {"blocked", "strained"}]
        ordered = [stressed, *[route for route in routes if route is not stressed]] if stressed else routes
        for route in ordered[: int(effect.get("max_targets", effect.get("count", 2)))]: self._action_card_survey_routes(state, effect, route)
    def _action_card_survey_and_mitigate(self, state, player, effect, target_id, adjacent, stressed):
        if not stressed:
            raise ValueError("invalid_action_card_target")
        self._action_card_survey_routes(state, effect, stressed)
    def _action_card_reduce_route_risk(self, state, player, effect, target_id, adjacent, stressed):
        risk_delta = int(effect.get("risk_delta", -int(effect.get("amount", 1))))
        stressed.risk = max(0, stressed.risk + risk_delta)
        state.shared.research_clues += int(effect.get("clues", 0))
        state.shared.weathering_track = max(0, state.shared.weathering_track + int(effect.get("weathering_delta", 0)))
    def _action_card_survey_routes(self, state, effect, route):
        if route:
            route.status = "strained"
            route.risk = max(0, route.risk + int(effect.get("risk_delta", -1)))
            state.shared.research_clues += int(effect.get("clues", 0))
            state.shared.weathering_track = max(0, state.shared.weathering_track + int(effect.get("weathering_delta", 0)))
    def _action_card_restore_route(self, state, player, effect, target_id, adjacent, stressed):
        if stressed:
            stressed.status = "restored"; stressed.risk = 0; stressed.connection_level = max(1, stressed.connection_level)
    def _action_card_establish_connection(self, state, player, effect, target_id, adjacent, stressed):
        restored = next((route for route in adjacent if route.id == target_id and route.status == "restored"), None) or next((route for route in adjacent if route.status == "restored"), None)
        if restored: restored.status = "illuminated"; restored.connection_level = 2; state.shared.route_connection_score += 1
    def _action_card_prepare_event(self, state, player, effect, target_id, adjacent, stressed): self._action_card_team_prepare(state, player, effect, target_id, adjacent, stressed)
    def _action_card_team_prepare(self, state, player, effect, target_id, adjacent, stressed):
        if state.shared.current_event_id:
            selected = list(dict.fromkeys(effect.get("_target_ids", []) + [player.id]))[: int(effect.get("max_targets", 2))]
            for player_id in selected: state.players[player_id].flags["prepared_event_id"] = state.shared.current_event_id
            if state.shared.current_event_id not in state.shared.prepared_event_ids: state.shared.prepared_event_ids.append(state.shared.current_event_id)
    def _action_card_restore_and_move(self, state, player, effect, target_id, adjacent, stressed):
        if stressed:
            stressed.status = "restored"; stressed.risk = 0; stressed.connection_level = max(1, stressed.connection_level)
        player.flags["free_move"] = bool(effect.get("move_after_restore", False))
    def _action_card_remote_exchange_or_connect(self, state, player, effect, target_id, adjacent, stressed):
        recipient = state.players.get(target_id or "")
        if recipient: player.flags["remote_exchange_player_id"] = recipient.id
        else:
            restored = next((route for route in adjacent if route.id == target_id and route.status == "restored"), None)
            if restored: restored.status = "illuminated"; restored.connection_level = 2; state.shared.route_connection_score += 1
    def _action_card_reserve_ap(self, state, player, effect, target_id, adjacent, stressed):
        # The card turns this action into a banked AP for this player's next turn.
        # Applying it immediately would only refund the card cost and have no effect.
        player.flags["reserved_ap"] = player.flags.get("reserved_ap", 0) + int(effect.get("amount", 1))
    def _action_card_transfer_resource(self, state, player, effect, target_id, adjacent, stressed):
        recipient = state.players.get(target_id or "")
        amount = int(effect.get("amount", 1))
        if not recipient: raise ValueError("invalid_action_card_target")
        if effect.get("resource") == "ap":
            recipient.ap = min(recipient.max_ap, recipient.ap + amount)
            return
        if state.shared.restoration_resource < amount: raise ValueError("not_enough_restoration_resource")
        state.shared.restoration_resource -= amount; recipient.supplies += amount

    def _use_node_ability(self, state, player, site_id):
        if site_id != player.location or site_id not in self.content.sites: raise ValueError("invalid_node_ability_target")
        ability = self.content.sites[site_id].get("node_ability", {})
        key = f"{site_id}:use_node_ability:{state.shared.turn}"
        if ability.get("trigger") != "once_per_round" or key in state.shared.node_ability_uses: raise ValueError("node_ability_unavailable")
        if player.ap < int(ability.get("cost", 1)): raise ValueError("not_enough_ap")
        player.ap -= int(ability.get("cost", 1))
        effect = ability.get("effect", {})
        if effect.get("type") == "inspect_archive":
            cards = list(reversed(state.decks.get("archive", [])))[: int(effect.get("amount", 2))]
            if not cards: raise ValueError("archive_empty")
            state.pending_choice = {"kind": "archive_select", "site_id": site_id, "cards": cards}
        else:
            self._apply_node_effect(state, player, site_id, effect)
        state.shared.node_ability_uses.append(key)

    def _use_upgrade(self, state, player, upgrade_id):
        if upgrade_id != "archive_retrieve" or not self._has_upgrade_effect(player, "archive_retrieve") or player.flags.get("archive_retrieve_round") == state.shared.turn: raise ValueError("upgrade_unavailable")
        if player.ap < 1: raise ValueError("not_enough_ap")
        cards = [card for card in reversed(state.decks.get("archive", [])) if self.content.cards.get(card, {}).get("domain") in {self.content.cards[item].get("domain") for item in player.hand}]
        if not cards: raise ValueError("archive_retrieve_needs_matching_hand")
        player.ap -= 1; state.pending_choice = {"kind": "archive_retrieve", "cards": cards[:3]}

    def _effect(self, state, player, effect):
        self._dispatch_effect(CULTURE_EFFECT_HANDLERS, state, player, effect)

    def _dispatch_effect(self, registry, state, player, effect, site_id=None):
        typ = effect.get("type")
        handler_name = registry.get(typ or "")
        if not handler_name:
            raise ValueError(f"unsupported_effect:{typ}")
        getattr(self, handler_name)(state, player, effect, site_id)

    def _effect_gain_ap(self, state, player, effect, site_id=None): player.ap = min(player.max_ap, player.ap + int(effect.get("amount", 1)))
    def _effect_next_contribute_bonus(self, state, player, effect, site_id=None): player.flags["next_contribute_bonus"] = player.flags.get("next_contribute_bonus", 0) + int(effect.get("amount", 1))
    def _effect_free_move(self, state, player, effect, site_id=None): player.flags["free_move"] = True
    def _effect_restore_and_influence(self, state, player, effect, site_id=None): state.shared.restoration_resource += int(effect.get("resource", 1)); player.influence += int(effect.get("influence", 1))
    def _effect_reduce_weathering(self, state, player, effect, site_id=None): state.shared.weathering_track = max(0, state.shared.weathering_track - int(effect.get("amount", 1)))
    def _effect_influence(self, state, player, effect, site_id=None): state.shared.influence += int(effect.get("amount", 1))
    def _effect_gain_influence(self, state, player, effect, site_id=None): state.shared.influence += int(effect.get("amount", 1)); player.influence += int(effect.get("amount", 1))
    def _effect_restore_discount(self, state, player, effect, site_id=None): player.flags["restore_discount"] = int(effect.get("amount", 1))
    def _effect_gain_clue(self, state, player, effect, site_id=None): state.shared.research_clues += int(effect.get("amount", 1))
    def _effect_preview_event(self, state, player, effect, site_id=None): player.flags["event_preview"] = True
    def _effect_exchange_discount(self, state, player, effect, site_id=None): player.flags["exchange_discount"] = int(effect.get("amount", 1))
    def _effect_reserve_market_card(self, state, player, effect, site_id=None): player.flags["reserve_market_card"] = True
    def _effect_inspect_archive(self, state, player, effect, site_id=None): player.flags["archive_inspect"] = True
    def _effect_clue_to_restoration(self, state, player, effect, site_id=None):
        clues = int(effect.get("clues", 1))
        restoration = int(effect.get("restoration", effect.get("amount", 1)))
        if state.shared.research_clues < clues:
            raise ValueError("not_enough_research_clues")
        state.shared.research_clues -= clues
        state.shared.restoration_resource += restoration
    def _effect_project_progress(self, state, player, effect, site_id=None):
        if not site_id:
            return
        project = state.projects.get(state.sites[site_id].active_project_id or "")
        if not project or project.status != "active" or project.stage_index >= len(project.stages):
            return
        amount = int(effect.get("amount", 1))
        stage = project.stages[project.stage_index]
        stage_id = stage.get("id", str(project.stage_index))
        project.progress += amount
        project.stage_progress[stage_id] = project.stage_progress.get(stage_id, 0) + amount
        while project.stage_index < len(project.stages):
            current = project.stages[project.stage_index]
            current_id = current.get("id", str(project.stage_index))
            if project.progress < int(current.get("required_progress", 1)) or not self._project_stage_ready(state, project, current):
                break
            project.completed_stages.append(current_id)
            self._apply_reward(state, current.get("reward") or self._default_stage_reward(current))
            project.progress = 0
            project.stage_index += 1
        if project.stage_index >= len(project.stages):
            project.status = "completed"
            self._apply_reward(state, self.content.projects[project.id].get("reward", {}))
    def _effect_temporary_origin_tag(self, state, player, effect, site_id=None): player.flags["temporary_origin_tag"] = effect.get("tag", "cross_origin")
    def _effect_ignore_route_risk(self, state, player, effect, site_id=None): player.flags["ignore_route_risk"] = True
    def _effect_free_exchange(self, state, player, effect, site_id=None): player.flags["free_exchange"] = True
    def _effect_preview_event_target(self, state, player, effect, site_id=None): player.flags["event_preview_target"] = True
    def _effect_route_action_discount(self, state, player, effect, site_id=None): player.flags["route_action_discount"] = int(effect.get("amount", 1))
    def _effect_inspect_adjacent_routes(self, state, player, effect, site_id=None): player.flags["inspect_adjacent_routes"] = True
    def _effect_trigger_role_upgrade(self, state, player, effect, site_id=None): self._offer_upgrade(state, player.id)

    def _end_turn(self, state, player):
        reserved_ap = int(player.flags.pop("reserved_ap", 0))
        player.ap = player.max_ap + reserved_ap; player.skill_used = False
        order = state.shared.player_order; index = order.index(player.id); last = index == len(order) - 1
        state.shared.active_player_id = order[0] if last else order[index + 1]
        self._apply_round_start_upgrades(state, state.players[state.shared.active_player_id])
        if not last:
            self._draw_action_card(state, state.players[state.shared.active_player_id])
        if last:
            snapshot = {
                "round": state.shared.turn,
                "event_id": state.shared.current_event_id,
                "event_targets": list(state.shared.event_targets),
                "planning_marks": {key: [dict(item) for item in items] for key, items in state.shared.planning_marks.items()},
                "weathering_track": state.shared.weathering_track,
                "restoration_resource": state.shared.restoration_resource,
                "influence": state.shared.influence,
                "site_states": {site.id: {"damage": site.damage, "status": site.status.value if hasattr(site.status, "value") else str(site.status)} for site in state.sites.values()},
                "route_states": {route.id: {"risk": route.risk, "status": route.status} for route in state.routes.values()},
            }
            state.shared.round_snapshot = snapshot
            state.shared.phase = "event_resolution"; state.shared.turn += 1; self._settle_event(state)
            if state.shared.current_event_id:
                event_name = self.content.events.get(state.shared.current_event_id, {}).get("name", "世界事件")
                self._record_journal(state, "resolve_event", state.shared.active_player_id, f"事件结算：{event_name}")
            if not state.pending_choice:
                self._finalize_round(state, snapshot)

    def _finalize_round(self, state, snapshot):
        """Close one round while the resolved event is still the current instance."""
        if state.shared.event_instance.get("status") == "resolved":
            state.shared.event_history.append(EventHistoryRecord.model_validate({**state.shared.event_instance.model_dump(mode="json"), "round": int(snapshot.get("round", state.shared.turn - 1))}))
        scenario_context = self._scenario_round_context(state, snapshot)
        scenario_effects = self._emit_scenario_rule(state, "round_end", scenario_context)
        planning_effects = self._settle_planning_marks(state, state.shared.active_player_id)
        state.shared.round_summary = self._build_round_summary(state, snapshot, scenario_effects + planning_effects)
        self._reveal_event(state)
        for site_id in state.sites:
            self._trigger_node_ability(state, state.players[state.shared.active_player_id], site_id, trigger="round_start")
        self._draw_action_card(state, state.players[state.shared.active_player_id])
        self._release_reserved_market_cards(state)
        state.shared.scenario_round_baseline = self._capture_scenario_round_baseline(state)
        state.shared.round_snapshot = {}

    def _settle_planning_marks(self, state, player_id):
        marks = [mark for values in state.shared.planning_marks.values() for mark in values]
        effects = []
        collaborated_count = 0
        for mark in marks:
            collaborated = mark.get("collaborated") is True or str(mark.get("collaborated", "")).lower() == "true"
            if collaborated:
                collaborated_count += 1
                target_id = mark.get("target_id")
                route = state.routes.get(target_id) if target_id else None
                if route:
                    from_name = self.content.sites.get(route.from_site, {}).get("name", route.from_site)
                    to_name = self.content.sites.get(route.to_site, {}).get("name", route.to_site)
                    target_name = f"{from_name}—{to_name}"
                    changes = {"行动点": 1, "研究线索": 1, "路线风险": -1}
                else:
                    target_name = self.content.sites.get(target_id, {}).get("name") or self.content.projects.get(target_id, {}).get("name") or target_id or "已声明目标"
                    changes = {"行动点": 1, "研究线索": 1}
                effects.append({"type": "planning_collaboration", "target_id": target_id, "label": f"协作接续：{target_name}", "changes": changes, "reason": "另一位同行者完成了这枚规划标记"})
                continue
        state.shared.planning_marks = {}
        state.shared.phase = "player_action"
        state.shared.log.append(f"\u89c4\u5212\u7ed3\u7b97\uff1a{collaborated_count} \u679a\u6807\u8bb0\u5df2\u88ab\u63a5\u7eed\uff0c{len(marks) - collaborated_count} \u679a\u672a\u63a5\u7eed\u4e14\u672a\u6539\u53d8\u72b6\u6001")

        return effects

    def _end_planning(self, state, player):
        if state.shared.phase != "planning":
            raise ValueError("planning_not_active")
        self._settle_planning_marks(state, player.id)

    def _build_round_summary(self, state, snapshot=None, round_effects=None):
        snapshot = snapshot or {}
        event_targets = list(snapshot.get("event_targets", state.shared.event_targets))
        site_changes = []
        route_changes = []
        for target_id in event_targets:
            if target_id in state.sites:
                site = state.sites[target_id]
                before = snapshot.get("site_states", {}).get(target_id, {})
                current_status = site.status.value if hasattr(site.status, "value") else str(site.status)
                before_damage = int(before.get("damage", site.damage))
                if before_damage != site.damage or before.get("status") != current_status:
                    site_changes.append({"id": target_id, "label": self.content.sites.get(target_id, {}).get("name", target_id), "kind": "site", "before": before_damage, "after": int(site.damage), "delta": int(site.damage) - before_damage, "status_before": before.get("status"), "status_after": current_status})
            elif target_id in state.routes:
                route = state.routes[target_id]
                before = snapshot.get("route_states", {}).get(target_id, {})
                if int(before.get("risk", route.risk)) != route.risk or before.get("status") != route.status:
                    from_name = self.content.sites.get(route.from_site, {}).get("name", route.from_site)
                    to_name = self.content.sites.get(route.to_site, {}).get("name", route.to_site)
                    before_risk = int(before.get("risk", route.risk))
                    route_changes.append({"id": target_id, "label": route.name or f"{from_name}—{to_name}", "kind": "route", "before": before_risk, "after": int(route.risk), "delta": int(route.risk) - before_risk, "status_before": before.get("status"), "status_after": route.status})
        priority = next((self.content.sites.get(site.id, {}).get("name", site.id) for site in state.sites.values() if site.status == SiteStatus.AT_RISK), "继续补齐胜利清单")
        return {
            "round": snapshot.get("round", state.shared.turn - 1),
            "event_id": snapshot.get("event_id", state.shared.current_event_id),
            "event_targets": event_targets,
            "planning_marks": sum(len(items) for items in snapshot.get("planning_marks", state.shared.planning_marks).values()),
            "planning_mark_count": sum(len(items) for items in snapshot.get("planning_marks", state.shared.planning_marks).values()),
            "before": {
                "weathering": snapshot.get("weathering_track", state.shared.weathering_track),
                "restoration_resource": snapshot.get("restoration_resource", state.shared.restoration_resource),
                "influence": snapshot.get("influence", state.shared.influence),
            },
            "after": {
                "weathering": state.shared.weathering_track,
                "restoration_resource": state.shared.restoration_resource,
                "influence": state.shared.influence,
            },
            "event_resolution": list(state.shared.event_instance.get("resolution", [])),
            "weathering_track": state.shared.weathering_track,
            "restoration_resource": state.shared.restoration_resource,
            "round_effects": list(round_effects or []),
            "site_changes": site_changes,
            "route_changes": route_changes,
            "next_priority": priority,
        }

    def _settle_event(self, state):
        event_id = state.shared.current_event_id
        if not event_id: return
        event = self.content.events[event_id]
        prepared = event_id in state.shared.prepared_event_ids or any(item.flags.get("prepared_event_id") == event_id for item in state.players.values())
        harmony = [item for item in state.players.values() if item.flags.pop("harmony_active", False)]
        if prepared:
            if event_id in state.shared.prepared_event_ids: state.shared.prepared_event_ids.remove(event_id)
            for item in state.players.values(): item.flags.pop("prepared_event_id", None)
            state.shared.weathering_track = max(0, state.shared.weathering_track - 1)
            state.shared.log.append(f"\u51c6\u5907\u751f\u6548\uff1a{event['name']} \u7684\u98ce\u5316\u538b\u529b\u964d\u4f4e 1")
        if harmony:
            state.shared.weathering_track = max(0, state.shared.weathering_track - 1)
            state.shared.log.append("\u548c\u5408\u534f\u4f5c\u751f\u6548\uff1a\u4e8b\u4ef6\u538b\u529b\u964d\u4f4e 1")
        instance = state.shared.event_instance
        if instance.get("event_id") != event_id:
            instance = {"event_id": event_id, "revealed_targets": self._select_event_targets(state, event), "mitigation": [], "resolution": [], "status": "forecast"}
            state.shared.event_instance = instance
            state.shared.event_targets = list(instance["revealed_targets"])
        if event_id == "route_blocked" and not prepared:
            state.shared.phase = "pending_choice"
            target_id = (instance.get("revealed_targets") or state.shared.event_targets or [None])[0]
            target = state.routes.get(target_id) if target_id else None
            if target:
                target.status = "blocked"
                target.risk = max(1, target.risk)
            state.pending_choice = {"kind": "event", "event_id": event_id, "options": [{"id": "mitigate", "label": "\u6d88\u8017 1 \u4fee\u590d\u8d44\u6e90\uff0c\u7f13\u548c\u9053\u8def\u963b\u65ad"}, {"id": "accept", "label": "\u63a5\u53d7\u963b\u65ad\uff0c\u5a01\u80c1\u4e0a\u5347 1"}]}
            return
        self._event_effect(state, event.get("effect", {}))

    def _resolve_choice(self, state, req):
        action = req["action"]
        choice = req.get("target_id")
        if state.pending_choice["kind"] == "event":
            if action == ActionType.USE_ACTION_CARD.value:
                self._use_action_card(state, state.players[state.shared.active_player_id], req.get("card_id"), req.get("target_id"), req.get("target_ids"))
                state.revision += 1; self._check_outcome(state); return self.refresh(state)
            if action != ActionType.RESOLVE_EVENT.value or choice not in {"mitigate", "accept"}: raise ValueError("invalid_event_choice")
            if choice == "mitigate":
                if state.shared.restoration_resource < 1: raise ValueError("not_enough_restoration_resource")
                state.shared.restoration_resource -= 1
                route_id = (state.shared.event_instance.get("revealed_targets") or state.shared.event_targets or [None])[0]
                route = state.routes.get(route_id) if route_id else None
                if route:
                    route.status = "strained"
                    route.risk = max(0, route.risk - 1)
                state.shared.event_instance["mitigation"] = [{"type": "route", "route_id": route_id, "result": "strained"}]
                state.shared.event_instance["resolution"] = [{"target_id": route_id, "label": "路线风险", "changes": {"修护资源": -1, "路线状态": "承压"}, "reason": "团队选择缓和阻断"}]
            else:
                state.shared.weathering_track += 1
                state.shared.event_instance["mitigation"] = [{"type": "route", "route_id": state.shared.event_targets[0] if state.shared.event_targets else None, "result": "accepted"}]
                state.shared.event_instance["resolution"] = [{"target_id": state.shared.event_targets[0] if state.shared.event_targets else None, "label": "风化压力", "changes": {"风化压力": 1}, "reason": "团队接受道路阻断"}]
            state.shared.event_instance["status"] = "resolved"
            snapshot = dict(state.shared.round_snapshot)
            state.pending_choice = None
            self._finalize_round(state, snapshot)
            state.revision += 1
            self._check_outcome(state)
            return self.refresh(state)
        elif state.pending_choice["kind"] == "view_select":
            player = state.players[state.shared.active_player_id]; card = req.get("card_id")
            if action != ActionType.SELECT_MARKET_CARD.value or card not in state.pending_choice["cards"]: raise ValueError("invalid_market_choice")
            selected = list(state.pending_choice["cards"])
            if card in state.market: state.market.remove(card)
            elif card in state.decks.get("culture", []): state.decks["culture"].remove(card)
            else: raise ValueError("invalid_market_choice")
            player.hand.append(card)
            if self._has_upgrade_effect(player, "market_look_bonus"):
                reserve = next((item for item in selected if item != card and (item in state.market or item in state.decks.get("culture", []))), None)
                if reserve:
                    if reserve in state.market: state.market.remove(reserve)
                    else: state.decks["culture"].remove(reserve)
                    state.shared.reserved_market_cards.append(reserve)
            self._refill_market(state); state.pending_choice = None
        elif state.pending_choice["kind"] == "discard":
            player = state.players[state.shared.active_player_id]
            discard_id = req.get("card_id")
            next_action_card = state.pending_choice.get("next_action_card_id")
            if next_action_card:
                if action != ActionType.DISCARD.value or discard_id not in player.action_hand or state.pending_choice.get("player_id") != player.id:
                    raise ValueError("invalid_action_card_discard")
                player.action_hand.remove(discard_id)
                state.decks.setdefault("action_discard", []).append(discard_id)
                player.action_hand.append(next_action_card)
                player.flags["action_card_draw_turn"] = state.shared.turn
                state.pending_choice = None
                state.shared.phase = "player_action"
                return
            next_card = state.pending_choice.get("next_card_id")
            if action != ActionType.DISCARD.value or discard_id not in player.hand or next_card not in state.market: raise ValueError("invalid_discard_choice")
            player.hand.remove(discard_id)
            state.decks.setdefault("discard", []).append(discard_id)
            state.pending_choice = None
            state.shared.phase = "player_action"
            self._explore(state, player, next_card)
        elif state.pending_choice["kind"] == "role_upgrade":
            player = state.players[state.shared.active_player_id]; upgrade_id = req.get("upgrade_id")
            if action != ActionType.SELECT_UPGRADE.value or upgrade_id not in {item["id"] for item in state.pending_choice["options"]}: raise ValueError("invalid_upgrade_choice")
            player.upgrades.append(upgrade_id); self._upgrade_effect(state, player, self.content.role_upgrades.get(upgrade_id, {}).get("effect", {})); state.pending_choice = None
        elif state.pending_choice["kind"] == "action_card":
            player = state.players[state.shared.active_player_id]; card = state.pending_choice["card_id"]; target_id = req.get("target_id")
            if action != ActionType.USE_ACTION_CARD.value or target_id not in {item["id"] for item in state.pending_choice["options"]}: raise ValueError("invalid_action_card_target")
            resume_choice = state.pending_choice.get("resume_choice")
            state.pending_choice = None; self._use_action_card(state, player, card, target_id, req.get("target_ids"), force_event_response=bool(resume_choice))
            if resume_choice and state.pending_choice is None: state.pending_choice = resume_choice
        elif state.pending_choice["kind"] == "archive_select":
            player = state.players[state.shared.active_player_id]; card = req.get("card_id")
            if action != ActionType.SELECT_MARKET_CARD.value or card not in state.pending_choice.get("cards", []): raise ValueError("invalid_archive_choice")
            player.flags["archive_hint_card"] = card; state.shared.log.append(f"档案提示：{self.content.cards[card]['name']}"); state.pending_choice = None
        elif state.pending_choice["kind"] == "archive_retrieve":
            player = state.players[state.shared.active_player_id]; card = req.get("card_id")
            if action != ActionType.SELECT_MARKET_CARD.value or card not in state.pending_choice.get("cards", []): raise ValueError("invalid_archive_choice")
            domain = self.content.cards[card].get("domain"); replacement = next((item for item in player.hand if self.content.cards[item].get("domain") == domain), None)
            if not replacement: raise ValueError("archive_retrieve_needs_matching_hand")
            state.decks["archive"].remove(card); player.hand.remove(replacement); state.decks["archive"].append(replacement); player.hand.append(card); player.flags["archive_retrieve_round"] = state.shared.turn; state.pending_choice = None
        state.revision += 1; self._check_outcome(state); return self.refresh(state)

    def _event_effect(self, state, effect):
        handler_name = EVENT_EFFECT_HANDLERS.get(effect.get("type", ""))
        if not handler_name:
            raise ValueError(f"unsupported_effect:{effect.get('type')}")
        getattr(self, handler_name)(state, None, effect)
        state.shared.event_instance["status"] = "resolved"

    def _event_damage_open_sites(self, state, player, effect, site_id=None):
        target_ids = state.shared.event_instance.get("revealed_targets") or state.shared.event_targets
        targets = [state.sites[item] for item in target_ids if item in state.sites]
        for site in targets:
            site.damage = min(site.max_damage, site.damage + int(effect.get("amount", 1)))
            self._update_site(site)
        state.shared.event_instance["resolved_targets"] = [site.id for site in targets]
        state.shared.event_instance["resolution"] = [{"target_id": site.id, "label": self.content.sites[site.id]["name"], "changes": {"节点损伤": int(effect.get("amount", 1))}, "reason": "事件结算"} for site in targets]
    def _event_all_influence(self, state, player, effect, site_id=None):
        for teammate in state.players.values(): teammate.influence += int(effect.get("amount", 1))
        state.shared.event_instance["resolution"] = [{"target_id": teammate.id, "label": teammate.name, "changes": {"个人影响": int(effect.get("amount", 1))}, "reason": "事件结算"} for teammate in state.players.values()]
    def _event_gain_resource(self, state, player, effect, site_id=None): state.shared.restoration_resource += int(effect.get("amount", 1)); state.shared.event_instance["resolution"] = [{"label": "共同修护资源", "changes": {"修护资源": int(effect.get("amount", 1))}, "reason": "事件结算"}]
    def _event_weathering(self, state, player, effect, site_id=None): state.shared.weathering_track += int(effect.get("amount", 1)); state.shared.event_instance["resolution"] = [{"label": "风化压力", "changes": {"风化压力": int(effect.get("amount", 1))}, "reason": "事件结算"}]

    def _reveal_event(self, state):
        if not state.decks["events"]:
            state.shared.current_event_id = None
            state.shared.event_targets = []
            state.shared.event_instance = {}
            return
        event_id = state.decks["events"].pop(0)
        event = self.content.events[event_id]
        targets = self._select_event_targets(state, event)
        state.shared.current_event_id = event_id
        state.shared.event_targets = targets
        state.shared.event_instance = {"event_id": event_id, "forecast_scope": {"target_rule": event.get("target_rule"), "hidden_target_count": len(targets)}, "revealed_targets": targets, "resolved_targets": [], "mitigation": [], "resolution": [], "status": "forecast"}

    def _select_event_targets(self, state, event):
        if event.get("id") == "route_blocked":
            candidates = sorted((route.id for route in state.routes.values() if route.status in {"open", "strained"}), key=str)
            if not candidates: return []
            return [candidates[(state.seed + state.shared.turn) % len(candidates)]]
        rule = event.get("target_rule", "all_players")
        if rule == "two_open_sites":
            candidates = sorted((site.id for site in state.sites.values() if site.status != SiteStatus.CLOSED), key=str)
            count = min(2, len(candidates))
            start = (state.seed + state.shared.turn) % max(1, len(candidates))
            return [candidates[(start + index) % len(candidates)] for index in range(count)]
        if rule in {"one_at_risk_site", "one_site"}:
            candidates = sorted((site.id for site in state.sites.values() if site.status != SiteStatus.CLOSED), key=str)
            return candidates[:1]
        if rule == "one_route":
            candidates = sorted((route.id for route in state.routes.values() if route.status in {"open", "strained"}), key=str)
            return candidates[:1]
        if rule in {"shared_resource", "weathering", "global_resource", "global_weathering"}:
            return []
        if rule == "all_players":
            return list(state.players)
        return list(state.players)

    def _refill_market(self, state):
        while len(state.market) < 3 and state.decks["culture"]: state.market.append(state.decks["culture"].pop(0))

    def _release_reserved_market_cards(self, state):
        while state.shared.reserved_market_cards:
            card = state.shared.reserved_market_cards.pop(0)
            if card not in state.market: state.market.insert(0, card)
            if len(state.market) > 3: state.decks["culture"].append(state.market.pop())

    def _advance_project(self, state, project, player_id, action_type="interpret_evidence", card_id=None, receipts=None):
        if not project or project.status != "active" or project.stage_index >= len(project.stages): return
        stage = project.stages[project.stage_index]
        if stage.get("action_type", "interpret_evidence") != action_type: return
        stage_id = stage.get("id", str(project.stage_index))
        project.stage_evidence.append({"stage_id": stage_id, "card_id": card_id, "player_id": player_id, "action_type": action_type})
        project.stage_progress[stage_id] = project.stage_progress.get(stage_id, 0) + 1
        stage_receipts = project.stage_receipts.setdefault(stage_id, {})
        for key, amount in (receipts or {}).items():
            stage_receipts[key] = stage_receipts.get(key, 0) + int(amount)
        project.stage_contributors.setdefault(stage_id, [])
        if player_id not in project.stage_contributors[stage_id]: project.stage_contributors[stage_id].append(player_id)
        project.progress += 1
        if player_id not in project.contributors: project.contributors.append(player_id)
        while project.stage_index < len(project.stages):
            current_stage = project.stages[project.stage_index]
            current_stage_id = current_stage.get("id", str(project.stage_index))
            if project.progress < current_stage.get("required_progress", 1) or not self._project_stage_ready(state, project, current_stage):
                break
            project.completed_stages.append(current_stage_id)
            self._apply_reward(state, current_stage.get("reward") or self._default_stage_reward(current_stage))
            state.shared.log.append(f"项目阶段完成：{current_stage.get('name', current_stage_id)}，阶段奖励已到账")
            project.progress = 0; project.stage_index += 1
        if project.stage_index >= len(project.stages): project.status = "completed"; self._apply_reward(state, self.content.projects[project.id].get("reward", {})); self._offer_upgrade(state, player_id)
        if project.stage_index < len(project.stages): project.available_choices = project.stages[project.stage_index].get("choices", [])
        state.shared.log.append(f"\u9879\u76ee {project.name} \u8fdb\u5165\u7b2c {project.stage_index + 1} \u9636\u6bb5")

    @staticmethod
    def _default_stage_reward(stage):
        action_type = stage.get("action_type")
        if action_type == "explore":
            return {"research_clues": 1}
        if action_type == "restore":
            return {"restoration_resource": 1}
        return {"influence": 1}

    def _plan(self, state, player, target):
        if state.shared.phase not in {"planning", "player_action"}:
            raise ValueError("planning_not_active")
        if not target or (target not in state.sites and target not in state.projects and target not in state.routes):
            raise ValueError("invalid_plan_target")
        marks = state.shared.planning_marks.setdefault(player.id, [])
        if any(str(mark.get("turn")) == str(state.shared.turn) for mark in marks): raise ValueError("planning_limit_reached")
        marks.append({"target_id": target, "turn": str(state.shared.turn)})
        state.shared.log.append(f"{player.name} \u653e\u7f6e\u89c4\u5212\u6807\u8bb0\uff1a{target}")

    def _resolve_planning_collaboration(self, state, player, action, req):
        target_ids = {value for value in (req.get("target_id"), req.get("target_site_id"), req.get("route_id")) if value}
        if action == ActionType.MOVE.value and req.get("target_id"):
            route = next((item for item in state.routes.values() if {item.from_site, item.to_site} == {player.location, req["target_id"]}), None)
            if route:
                target_ids.add(route.id)
        for project_id, project in state.projects.items():
            if project.site_id in target_ids:
                target_ids.add(project_id)
        for owner_id, marks in state.shared.planning_marks.items():
            if owner_id == player.id:
                continue
            for mark in marks:
                if mark.get("collaborated") or str(mark.get("turn")) != str(state.shared.turn) or mark.get("target_id") not in target_ids:
                    continue
                mark["collaborated"] = True
                mark["collaboration_action"] = action
                player.ap = min(player.max_ap, player.ap + 1)
                state.shared.research_clues += 1
                route = state.routes.get(mark["target_id"])
                if route:
                    route.risk = max(0, route.risk - 1)
                target_name = self.content.sites.get(mark["target_id"], {}).get("name") or self.content.projects.get(mark["target_id"], {}).get("name") or (route.name if route else mark["target_id"])
                state.shared.log.append(f"{player.name} 与 {state.players[owner_id].name} 协作完成{target_name}的计划：行动点返还1，研究线索+1")
                return

    def _card_can_contribute(self, card, task):
        definition = self.content.cards[card]; required_tags = set(task.get("combo_requirement", {}).get("required_combo_tags", []))
        return definition.get("domain") in task.get("required_domains", []) or bool(required_tags & set(definition.get("combo_tags", [])))

    def _task_complete(self, task):
        return bool(self._evaluate_interpretation(task)["can_form"])

    def _task_progress(self, task):
        evaluation = self._evaluate_interpretation(task)
        return {"requirements": evaluation["requirements"], "complete": evaluation["can_form"], "interpretation": evaluation}

    def _reachable(self, state, start, hops):
        found = {start}; queue = deque([(start, 0)])
        while queue:
            current, distance = queue.popleft()
            if distance >= hops: continue
            for route in self.content.routes:
                if current not in {route["from"], route["to"]} or not self._route_open(state, route["id"]):
                    continue
                target = route["to"] if route["from"] == current else route["from"]
                if target not in found:
                    found.add(target); queue.append((target, distance + 1))
        return found

    def _open(self, state, site_id): return site_id in state.sites and state.sites[site_id].status != SiteStatus.CLOSED
    def _route_open(self, state, route_id): return state.routes.get(route_id, RouteState(id=route_id, from_site="", to_site="")).status in {"open", "restored", "illuminated"}

    def _update_site(self, site):
        site.status = SiteStatus.CLOSED if site.damage >= site.max_damage else SiteStatus.AT_RISK if site.damage else SiteStatus.STABLE
        site.durability = max(0, site.max_damage - site.damage); site.max_durability = site.max_damage

    def _update_objectives(self, state):
        completed_projects = sum(project.status == "completed" for project in state.projects.values())
        restored_routes = sum(route.status in {"restored", "illuminated"} for route in state.routes.values())
        protected_sites = sum(site.status == SiteStatus.STABLE and site.discovered for site in state.sites.values())
        all_evidence = [card for player in state.players.values() for card in player.hand] + state.decks.get("archive", [])
        for task in state.tasks.values(): all_evidence.extend(task.get("contributed_cards", []))
        diversity = len({origin for card_id in all_evidence for origin in self.content.cards.get(card_id, {}).get("origin_tags", [])})
        for objective in state.objectives.values():
            objective.progress = {"projects": completed_projects, "route_restoration": restored_routes, "site_protection": protected_sites, "regions": min(4, state.shared.route_connection_score), "origin_diversity": diversity}.get(objective.type, objective.progress)
            objective.completed = objective.progress >= objective.target
        state.score.tasks = sum(task.get("completed", False) for task in state.tasks.values())
        state.score.routes = restored_routes
        state.score.protection = protected_sites
        state.score.discovery = sum(site.discovered for site in state.sites.values())
        state.score.diversity = diversity
        state.score.resources = state.shared.restoration_resource
        state.score.efficiency = max(0, state.shared.max_rounds - state.shared.turn + 1)
        state.score.total = state.score.tasks * 10 + state.score.routes * 5 + state.score.protection * 2 + state.score.discovery + state.score.diversity * 2 + state.score.efficiency
        state.score.grade = "gold" if state.score.total >= 55 else "silver" if state.score.total >= 35 else "bronze"
        scenario = self.content.scenarios.get(state.scenario_id, {})
        core_ids = {scenario.get("core_project_id")} if scenario.get("core_project_id") else set()
        scenario = self.content.scenarios.get(state.scenario_id, {})
        core_target = len(core_ids)
        objective_target = len(state.objectives)
        def related_labels(ids):
            labels = []
            for identifier in ids:
                if identifier in self.content.projects:
                    labels.append(self.content.projects[identifier].get("name", identifier))
                elif identifier in self.content.objectives:
                    labels.append(self.content.objectives[identifier].get("name", identifier))
                elif identifier in self.content.sites:
                    labels.append(self.content.sites[identifier].get("name", identifier))
                else:
                    route = next((item for item in self.content.routes if item.get("id") == identifier), None)
                    if route:
                        from_name = self.content.sites.get(route.get("from"), {}).get("name", route.get("from"))
                        to_name = self.content.sites.get(route.get("to"), {}).get("name", route.get("to"))
                        labels.append(route.get("name") or f"{from_name}—{to_name}")
                    else:
                        labels.append(identifier)
            return labels
        core_completed = sum(1 for project_id in core_ids if project_id in state.projects and state.projects[project_id].status == "completed")
        objectives_completed = sum(1 for objective in state.objectives.values() if objective.completed)
        victory_conditions = []
        for project_id in sorted(core_ids):
            project = state.projects.get(project_id)
            if not project:
                continue
            target = max(1, len(project.stages))
            current = target if project.status == "completed" else min(project.stage_index, target)
            site_name = self.content.sites.get(project.site_id, {}).get("name", project.site_id)
            victory_conditions.append({
                "id": f"project:{project.id}",
                "label": f"项目：{project.name}",
                "current": current,
                "target": target,
                "remaining": max(0, target - current),
                "kind": "progress",
                "operator": "gte",
                "status": "completed" if project.status == "completed" else "incomplete",
                "related_ids": [project.id, project.site_id],
                "related_labels": [project.name, site_name],
            })
        for objective in state.objectives.values():
            target = max(1, objective.target)
            current = min(objective.progress, target)
            objective_name = self.content.objectives.get(objective.id, {}).get("name", objective.name)
            victory_conditions.append({
                "id": f"objective:{objective.id}",
                "label": f"目标：{objective_name}",
                "current": current,
                "target": target,
                "remaining": max(0, target - current),
                "kind": "progress",
                "operator": "gte",
                "status": "completed" if objective.completed else "incomplete",
                "related_ids": [objective.id],
                "related_labels": [objective_name],
            })
        if not victory_conditions:
            victory_conditions.append({
                "id": "journey_progress",
                "label": "共同旅程进度",
                "current": 0,
                "target": 1,
                "remaining": 1,
                "kind": "progress",
                "operator": "gte",
                "status": "incomplete",
                "related_ids": [],
                "related_labels": [],
            })
        state.goal_status = GoalStatus(
            core_projects_completed=core_completed,
            core_projects_target=len(core_ids),
            objectives_completed=objectives_completed,
            objectives_target=len(state.objectives),
            protected_sites=protected_sites,
            protected_sites_target=int(next((objective.get("target", 0) for objective in self.content.objectives.values() if objective.get("type") == "site_protection"), 0)),
            weathering=state.shared.weathering_track,
            weathering_limit=state.shared.weathering_limit,
            rounds_remaining=max(0, state.shared.max_rounds - state.shared.turn + 1),
            victory_conditions=victory_conditions,
            failure_conditions=[
                {"id": "closed_sites", "label": "关闭节点不超过上限", "current": sum(site.status == SiteStatus.CLOSED for site in state.sites.values()), "target": int(scenario.get("closed_site_limit", 2)), "remaining": max(0, int(scenario.get("closed_site_limit", 2)) - sum(site.status == SiteStatus.CLOSED for site in state.sites.values())), "kind": "guardrail", "operator": "lt", "status": "failed" if sum(site.status == SiteStatus.CLOSED for site in state.sites.values()) >= int(scenario.get("closed_site_limit", 2)) else "safe", "related_ids": [site.id for site in state.sites.values() if site.status == SiteStatus.CLOSED], "related_labels": related_labels([site.id for site in state.sites.values() if site.status == SiteStatus.CLOSED])},
                {"id": "weathering_limit", "label": "风化压力不达到上限", "current": state.shared.weathering_track, "target": state.shared.weathering_limit, "remaining": max(0, state.shared.weathering_limit - state.shared.weathering_track), "kind": "guardrail", "operator": "lt", "status": "failed" if state.shared.weathering_track >= state.shared.weathering_limit else "safe", "related_ids": []},
                {"id": "round_limit", "label": "在回合耗尽前完成", "current": state.shared.turn, "target": state.shared.max_rounds, "remaining": max(0, state.shared.max_rounds - state.shared.turn + 1), "kind": "deadline", "operator": "lte", "status": "failed" if state.shared.turn > state.shared.max_rounds else "safe", "related_ids": []},
            ],
        )

    def _check_outcome(self, state):
        self._update_objectives(state)
        scenario = self.content.scenarios.get(state.scenario_id, {})
        closed = sum(site.status == SiteStatus.CLOSED for site in state.sites.values())
        objectives_done = sum(objective.completed for objective in state.objectives.values())
        core = state.projects.get(scenario.get("core_project_id", "")); core_complete = bool(core and core.status == "completed")
        victory = (core_complete and objectives_done == len(state.objectives) and objectives_done > 0) or (not scenario.get("core_project_id") and len(state.shared.completed_domains) >= len(self.content.domains) and state.shared.influence >= scenario.get("influence_goal", 10))
        if victory and closed < scenario.get("closed_site_limit", 2) and state.shared.weathering_track < state.shared.weathering_limit and state.shared.turn <= state.shared.max_rounds:
            state.shared.outcome = GameOutcome.VICTORY; state.shared.outcome_reason = "core_project_and_objectives_completed" if core_complete else "domain_interpretation_completed"
        elif closed >= scenario.get("closed_site_limit", 2):
            state.shared.outcome = GameOutcome.DEFEAT; state.shared.outcome_reason = "too_many_closed_sites"
        elif state.shared.weathering_track >= state.shared.weathering_limit:
            state.shared.outcome = GameOutcome.DEFEAT; state.shared.outcome_reason = "weathering_track_reached_limit"
        elif state.shared.turn > state.shared.max_rounds:
            state.shared.outcome = GameOutcome.DEFEAT; state.shared.outcome_reason = "round_limit_reached"
        if state.shared.outcome:
            state.shared.phase = "game_over"
            state.result = ResultState(
                outcome=state.shared.outcome,
                outcome_reason=state.shared.outcome_reason,
                outcome_summary=scenario.get("victory_brief") if state.shared.outcome == GameOutcome.VICTORY else scenario.get("failure_brief", ""),
                score=state.score,
                completed_objectives=[item.id for item in state.objectives.values() if item.completed],
                completed_projects=[item.id for item in state.projects.values() if item.status == "completed"],
                seed=state.seed,
            )

    def _ensure_runtime_state(self, state):
        if not state.routes:
            state.routes = {route["id"]: RouteState(id=route["id"], from_site=route["from"], to_site=route["to"], cost=route.get("cost", 1), status=route.get("status", "open"), tags=route.get("tags", [])) for route in self.content.routes if route["from"] in state.sites and route["to"] in state.sites}
        if not state.projects:
            state.projects = {project_id: ProjectState(id=project_id, site_id=project["site_id"], name=project["name"], stages=project.get("stages", [])) for project_id, project in self.content.projects.items()}
        for site in state.sites.values():
            if not site.active_project_id:
                project = next((item for item in state.projects.values() if item.site_id == site.id), None)
                site.active_project_id = project.id if project else None
        if not state.shared.scenario_round_baseline:
            state.shared.scenario_round_baseline = self._capture_scenario_round_baseline(state)

    @staticmethod
    def _capture_scenario_round_baseline(state):
        return {
            "project_completed_stages": {project.id: len(project.completed_stages) for project in state.projects.values()},
            "route_statuses": {route.id: getattr(route.status, "value", route.status) for route in state.routes.values()},
        }

    def _scenario_round_context(self, state, snapshot=None):
        baseline = state.shared.scenario_round_baseline or self._capture_scenario_round_baseline(state)
        project_baseline = baseline.get("project_completed_stages", {})
        route_baseline = baseline.get("route_statuses", {})
        completed_project_stages = sum(
            max(0, len(project.completed_stages) - int(project_baseline.get(project.id, 0)))
            for project in state.projects.values()
        )
        restored_routes = sum(
            1
            for route in state.routes.values()
            if getattr(route.status, "value", route.status) in {"restored", "illuminated"}
            and route_baseline.get(route.id) not in {"restored", "illuminated"}
        )
        return {
            **(snapshot or {}),
            "completed_project_stages": completed_project_stages,
            "restored_routes": restored_routes,
        }

    def _preview_snapshot(self, state, req):
        player = state.players.get(req.get("player_id"))
        site_id = req.get("target_site_id")
        if not site_id and req.get("action") in {ActionType.INTERPRET_EVIDENCE.value, ActionType.FORM_INTERPRETATION.value, ActionType.CHOOSE_INTERVENTION.value, ActionType.RESTORE.value, ActionType.USE_NODE_ABILITY.value}:
            site_id = player.location if player else None
        route_id = req.get("route_id")
        snapshot = {
            "ap": player.ap if player else 0,
            "research_clues": state.shared.research_clues,
            "restoration_resource": state.shared.restoration_resource,
            "weathering": state.shared.weathering_track,
            "influence": state.shared.influence,
            "route_connection_score": state.shared.route_connection_score,
        }
        if site_id in state.sites:
            snapshot["site_influence"] = state.sites[site_id].influence
            snapshot["damage"] = state.sites[site_id].damage
        if route_id in state.routes:
            snapshot["risk"] = state.routes[route_id].risk
        return snapshot

    def simulate_action(self, state, action):
        """Run the production handler on a disposable copy and return its numeric state delta."""
        request = {
            "player_id": action.get("player_id") or state.shared.active_player_id,
            "action": action["type"],
            "target_id": action.get("target_id"),
            "target_site_id": action.get("target_site_id"),
            "card_id": action.get("card_id"),
            "recipient_id": action.get("recipient_id"),
            "route_id": action.get("route_id"),
            "upgrade_id": action.get("upgrade_id"),
            "target_ids": action.get("target_ids"),
            "_preview": True,
        }
        simulated = deepcopy(state)
        before = self._preview_snapshot(simulated, request)
        simulated = self.apply(simulated, request)
        after = self._preview_snapshot(simulated, request)
        return {key: after[key] - value for key, value in before.items() if isinstance(value, (int, float)) and after.get(key) != value}

    def _action_preview_delta(self, action, state=None):
        if state is None:
            return {}
        try:
            return self.simulate_action(state, action)
        except ValueError:
            return {}

    def _recommendation_for_option(self, option, state, active, target=None):
        action_type = option["type"]
        candidate = target or option
        route_actions = {ActionType.SURVEY_ROUTE.value, ActionType.RESTORE_ROUTE.value, ActionType.ESTABLISH_CONNECTION.value}
        target_id = candidate.get("route_id") if action_type in route_actions else candidate.get("target_site_id") or candidate.get("target_id")
        target_route = state.routes.get(target_id) if target_id else None
        target_site = state.sites.get(target_id) if target_id else None
        target_name = self.content.sites.get(target_id, {}).get("name") if target_id else None
        if target_route:
            target_name = f"{self.content.sites.get(target_route.from_site, {}).get('name', target_route.from_site)}—{self.content.sites.get(target_route.to_site, {}).get('name', target_route.to_site)}"

        pressure = int((state.shared.weathering_track / max(1, state.shared.weathering_limit)) * 28)
        rounds_remaining = max(0, int(state.shared.max_rounds) - state.shared.turn + 1)
        time_pressure = max(0, 5 - rounds_remaining) * 7
        event_targets = set(state.shared.event_targets or [])
        if not event_targets and state.shared.event_instance:
            event_targets = set(state.shared.event_instance.get("revealed_targets", []))
        event_urgency = 18 if state.shared.current_event_id else 0
        task = state.tasks.get(self.content.sites.get(active.location, {}).get("active_task_id"), {})
        requirements = task.get("progress", {}).get("requirements", [])
        missing = sum(1 for item in requirements if not item.get("complete"))
        score = 8 + pressure + time_pressure + event_urgency
        reason = option.get("description", "执行一项可用行动。")

        target_project = next((project for project in state.projects.values() if project.status == "active" and project.site_id == target_id), None) if target_id else None
        project_gap = 0
        if target_project and target_project.stage_index < len(target_project.stages):
            stage = target_project.stages[target_project.stage_index]
            stage_id = stage.get("id", str(target_project.stage_index))
            project_gap = max(0, int(stage.get("required_progress", 1)) - int(target_project.stage_progress.get(stage_id, 0)))
            score += min(20, project_gap * 5)
        target_task_id = self.content.sites.get(target_id, {}).get("active_task_id") if target_id else None
        target_task = state.tasks.get(target_task_id, {}) if target_task_id else {}
        target_task_gap = sum(1 for item in target_task.get("progress", {}).get("requirements", []) if not item.get("complete"))
        if target_task_gap:
            score += min(16, target_task_gap * 4)

        role_action = self.content.roles.get(active.role_id, {}).get("ability", {}).get("action")
        role_fit = {"fine_repair": ActionType.RESTORE.value, "sprint_move": ActionType.MOVE.value, "view_select": ActionType.EXPLORE.value, "harmony_hint": ActionType.INTERPRET_EVIDENCE.value}
        role_fit_reason = ""
        if role_fit.get(role_action) == action_type:
            score += 14
            role_name = self.content.roles.get(active.role_id, {}).get("ability", {}).get("name")
            if role_name:
                role_fit_reason = f"当前角色的「{role_name}」正适合处理这类行动。"

        if action_type == ActionType.CHOOSE_INTERVENTION.value:
            score += 52; reason = "解释已经形成，选择干预会直接推进当前委托。"
        elif action_type == ActionType.FORM_INTERPRETATION.value:
            score += 46; reason = "研究台条件已经满足，现在形成解释不会再消耗行动点。"
        elif action_type == ActionType.INTERPRET_EVIDENCE.value:
            score += 28 + missing * 7; reason = "这一步会填补当前委托的证据条件。"
        elif action_type == ActionType.EXPLORE.value:
            score += 22 + missing * 6
            card = self.content.cards.get(candidate.get("card_id"), {})
            if card.get("domain") in task.get("required_domains", []): score += 18
            if set(card.get("origin_tags", [])) & set(task.get("combo_requirement", {}).get("preferred_origins", [])): score += 10
            reason = f"推荐带回{card.get('name', '这件线索')}：它能补足当前委托的证据缺口。"
        elif action_type == ActionType.RESTORE.value:
            damage = target_site.damage if target_site else state.sites[active.location].damage
            score += int(32 * damage / max(1, target_site.max_damage if target_site else state.sites[active.location].max_damage))
            if target_id in event_targets: score += 18
            risk_text = "节点已接近关闭，必须优先稳住现场" if damage >= max(1, (target_site.max_damage if target_site else state.sites[active.location].max_damage) - 1) else "先降低节点损伤，避免事件结算扩大风险"
            reason = f"推荐修护{target_name or self.content.sites.get(active.location, {}).get('name', active.location)}：{risk_text}。"
        elif action_type in route_actions:
            risk = target_route.risk if target_route else 0
            score += risk * 12 + (18 if target_route and target_route.status == "blocked" else 0)
            if target_id in event_targets: score += 16
            reason = f"推荐处理{target_name or '这条路线'}：降低路线风险可以保留后续移动空间。"
        elif action_type == ActionType.MOVE.value:
            if target_site:
                score += int(24 * target_site.damage / max(1, target_site.max_damage))
                if target_site.id in event_targets: score += 20
                target_task = self.content.sites.get(target_site.id, {}).get("active_task_id")
                if target_task and not state.tasks.get(target_task, {}).get("completed"): score += 10
            movement_cost = int(candidate.get("cost", option.get("cost", {}).get("ap", 0)) or 0)
            score -= movement_cost * 8
            reason = f"推荐前往{target_name or '新的节点'}：这里的风险或委托缺口值得优先处理。"
        elif action_type == ActionType.USE_ACTION_CARD.value:
            score += 18 + (12 if target_id in event_targets else 0)
            reason = option.get("reason") or "策略牌适合在当前风险或目标缺口出现时使用。"
        elif action_type == ActionType.END_TURN.value:
            score = max(0, 10 - pressure); reason = "当前没有更高优先级的行动，结束行动让下一位同行者接手。"

        if role_fit_reason:
            reason = f"{reason} {role_fit_reason}"

        raw_cost = candidate.get("cost", option.get("cost", {}).get("ap", 0))
        cost = int(raw_cost.get("ap", 0) if isinstance(raw_cost, dict) else raw_cost or 0)
        score += 8 if cost == 0 else min(12, max(0, 18 - cost * 6))
        return max(0, min(100, int(score))), reason

    def _action_requirements(self, action_type, action, state=None, active=None):
        cost = action.get("cost", 0)
        if isinstance(cost, dict):
            cost = cost.get("ap", 0)
        requirements = [f"行动点至少 {int(cost)}"] if int(cost or 0) > 0 else []
        if not state or not active:
            return requirements
        site = state.sites.get(active.location)
        if action_type == ActionType.MOVE.value:
            requirements.append("目标节点开放，且路线保持通行")
        elif action_type == ActionType.EXPLORE.value:
            requirements.extend(["已抵达当前节点", "手牌未满（最多 3 张）", "公开市场仍有可取线索"])
        elif action_type == ActionType.INTERPRET_EVIDENCE.value:
            requirements.extend(["已抵达任务节点", "证据符合当前委托", "这件证据尚未归入研究台"])
        elif action_type == ActionType.FORM_INTERPRETATION.value:
            requirements.append("研究台的领域、来源和组合条件全部满足")
        elif action_type == ActionType.CHOOSE_INTERVENTION.value:
            requirements.append("当前解释已经形成，且尚未选择干预")
        elif action_type == ActionType.RESTORE.value:
            requirements.extend(["已抵达受损节点", "团队修护资源或个人补给至少 1 点"])
        elif action_type == ActionType.EXCHANGE.value:
            requirements.extend(["与同行者同处一处，或已获得远程交换权限", "对方手牌未满"])
        elif action_type == ActionType.SURVEY_ROUTE.value:
            requirements.extend(["已抵达路线一端", "路线处于承压或阻断状态"])
        elif action_type == ActionType.RESTORE_ROUTE.value:
            requirements.extend(["已抵达路线一端", "路线处于承压或阻断状态", "研究线索至少 1 点"])
        elif action_type == ActionType.ESTABLISH_CONNECTION.value:
            requirements.extend(["已抵达路线一端", "路线已经修护"])
        elif action_type == ActionType.PREPARE.value:
            requirements.append("当前有尚未结算的事件")
        elif action_type == ActionType.USE_SKILL.value:
            requirements.append("角色技能本回合尚未使用")
        elif action_type == ActionType.USE_NODE_ABILITY.value:
            requirements.append("当前地点能力本回合尚未使用")
        elif action_type == ActionType.USE_UPGRADE.value:
            requirements.append("该角色专长已解锁，且当前允许使用")
        elif action_type == ActionType.PLAY_CARD.value:
            requirements.append("手中有这张文化牌，并确认放弃它的研究台用途")
        elif action_type == ActionType.USE_ACTION_CARD.value:
            requirements.append("这张策略牌当前处于可使用时机")
        elif action_type == ActionType.PLAN.value:
            requirements.append("本轮尚未为当前角色声明规划目标")
        elif action_type == ActionType.RESOLVE_EVENT.value:
            requirements.append("当前事件正在等待团队回应")
        elif action_type == ActionType.DISCARD.value:
            requirements.append("从当前手牌中选择一件放下")
        elif action_type == ActionType.SELECT_MARKET_CARD.value:
            requirements.append("从当前展示的线索中选择一件")
        elif action_type == ActionType.SELECT_UPGRADE.value:
            requirements.append("选择一个已展示的角色专长")
        elif action_type == ActionType.END_TURN.value:
            requirements.append("可随时结束当前行动")
        if site and action_type == ActionType.RESTORE.value and site.status == SiteStatus.CLOSED:
            requirements.append("节点尚未关闭")
        return requirements

    def _build_action_options(self, actions, state=None):
        terminology = self.content.terminology.get("actions", {})
        descriptions = {
            ActionType.MOVE.value: "沿已显影的路线前往另一个开放节点。",
            ActionType.EXPLORE.value: "从公开市场取走一件文化线索，推进当前地点的研究。",
            ActionType.INTERPRET_EVIDENCE.value: "将一张证据归入支持、冲突或待确认，公开你的判断。",
            ActionType.FORM_INTERPRETATION.value: "根据已归位的证据形成当前解释，再决定如何行动。",
            ActionType.CHOOSE_INTERVENTION.value: "选择立即处理、最小干预或先记录，让解释真正改变现场。",
            ActionType.RESTORE.value: "消耗修护资源，降低当前地点的风化损伤。",
            ActionType.EXCHANGE.value: "把手中的线索交给同处的同行者。",
            ActionType.USE_SKILL.value: "使用当前角色的专长，改变这一回合的行动空间。",
            ActionType.PLAY_CARD.value: "立即使用一张文化证据牌的即时效果。",
            ActionType.USE_ACTION_CARD.value: "使用策略牌，并在需要时选择路线或同行者。",
            ActionType.SURVEY_ROUTE.value: "勘察受阻路线，降低风险并补充研究线索。",
            ActionType.RESTORE_ROUTE.value: "消耗研究线索，让受阻路线恢复通行。",
            ActionType.ESTABLISH_CONNECTION.value: "把已修护路线升级为稳定的区域连接。",
            ActionType.PREPARE.value: "提前准备当前事件，降低结算时的风化压力。",
            ActionType.PLAN.value: "为地点、路线或项目放置一枚协作标记。",
            ActionType.END_TURN.value: "结束当前角色的行动，把回合交给下一位同行者。",
            ActionType.END_PLANNING.value: "结算本轮协作标记，进入行动阶段。",
        }
        category_labels = {
            ActionType.USE_SKILL.value: "角色技能",
            ActionType.USE_NODE_ABILITY.value: "地点能力",
            ActionType.USE_UPGRADE.value: "角色专长",
            ActionType.USE_ACTION_CARD.value: "策略牌",
            ActionType.PLAY_CARD.value: "文化证据",
        }
        action_labels_by_type = {
            ActionType.USE_SKILL.value: "使用角色技能",
            ActionType.USE_NODE_ABILITY.value: "使用地点能力",
            ActionType.USE_UPGRADE.value: "使用角色专长",
            ActionType.USE_ACTION_CARD.value: "使用策略牌",
            ActionType.PLAY_CARD.value: "使用文化牌",
        }
        specific_types = set(category_labels)
        grouped = {}
        active = state.players.get(state.shared.active_player_id) if state else None
        for action in actions:
            action_type = action["type"]
            cost = int(action.get("cost", 0))
            group_key = action_type
            if action.get("card_id") and action_type in {ActionType.PLAY_CARD.value, ActionType.USE_ACTION_CARD.value}:
                group_key = f"{action_type}:{action['card_id']}"
            option = grouped.setdefault(group_key, {
                "id": f"action:{group_key}",
                "type": action_type,
                "label": action.get("label", action_type),
                "category_label": category_labels.get(action_type, "基础行动"),
                "action_label": action_labels_by_type.get(action_type, terminology.get(action_type, {}).get("name", action_type)),
                "description": descriptions.get(action_type, "执行一项可用行动。"),
                "cost": {"ap": cost},
                "enabled": action.get("enabled", True),
                "disabled_reason": action.get("disabled_reason"),
                "targets": [],
                "preview_delta": self._action_preview_delta(action, state),
                "confirmation": f"确认{action.get('label', action_type)}？",
                "payload": {},
                "requirements": self._action_requirements(action_type, action, state, active),
                "recommendation_score": 0,
                "reason": "",
            })
            term = terminology.get(action_type, {})
            if action_type not in specific_types:
                option["label"] = term.get("name") or option["label"]
            option["action_label"] = action_labels_by_type.get(action_type, term.get("name") or option["action_label"])
            option["description"] = term.get("description") or option["description"]
            if action_type == ActionType.USE_ACTION_CARD.value and action.get("card_id"):
                card_definition = self.content.action_cards.get(action["card_id"], {})
                option["label"] = card_definition.get("name") or option["label"]
                option["action_label"] = "使用策略牌"
                option["description"] = card_definition.get("description") or option["description"]
                timing = card_definition.get("timing") or "当前行动阶段"
                best_use = card_definition.get("best_use") or "在合适目标上使用，改变本回合的风险或资源。"
                limitations = card_definition.get("limitations") or "使用前请确认目标和行动点。"
                option["reason"] = f"时机：{timing}。最适合：{best_use}。限制：{limitations}"
                option["payload"].update({key: card_definition.get(key) for key in ("timing", "effect", "best_use", "limitations", "combo_tags") if card_definition.get(key) is not None})
                option["confirmation"] = f"确认使用策略牌“{card_definition.get('name', '策略牌')}”吗？"
            elif action_type == ActionType.PLAY_CARD.value and action.get("card_id"):
                card_definition = self.content.cards.get(action["card_id"], {})
                option["label"] = card_definition.get("name") or option["label"]
                option["description"] = card_definition.get("instant_use_text") or option["description"]
                option["confirmation"] = f"确认发动文化牌“{card_definition.get('name', '文化牌')}”的即时效果吗？"
            elif action_type in {ActionType.USE_SKILL.value, ActionType.USE_NODE_ABILITY.value, ActionType.USE_UPGRADE.value}:
                option["label"] = action.get("label") or option["label"]
            target = action.get("target_id") or action.get("target_site_id") or action.get("card_id") or action.get("route_id") or action.get("recipient_id") or action.get("upgrade_id")
            payload = {key: value for key, value in action.items() if value is not None}
            if action_type == ActionType.PLAY_CARD.value and action.get("card_id"):
                card_definition = self.content.cards.get(action["card_id"], {})
                payload.update({key: card_definition.get(key) for key in ("evidence_use_text", "instant_use_text", "effect") if card_definition.get(key) is not None})
            option["payload"].update(payload)
            if target:
                target_key = str(target)
                if action_type == ActionType.EXCHANGE.value:
                    target_key = f"{target_key}:{action.get('card_id', '')}"
                option["targets"].append({"id": target_key, "label": action.get("label", str(target)), "preview_delta": self._action_preview_delta(action, state), "payload": payload, "recommendation_score": 0, "reason": ""})
            else:
                option["payload"] = payload
        if state is not None and not state.pending_choice and not state.shared.outcome:
            present = set(grouped)
            active = state.players.get(state.shared.active_player_id)
            if active:
                disabled = {}
                if state.shared.phase == "player_action":
                    if ActionType.MOVE.value not in present: disabled[ActionType.MOVE.value] = "当前没有可达且开放的节点。"
                    if ActionType.EXPLORE.value not in present: disabled[ActionType.EXPLORE.value] = "当前没有可取的研究线索，或手牌已满。"
                    if ActionType.INTERPRET_EVIDENCE.value not in present and ActionType.FORM_INTERPRETATION.value not in present and ActionType.CHOOSE_INTERVENTION.value not in present: disabled[ActionType.INTERPRET_EVIDENCE.value] = "先寻访一张适合当前问题的证据，再开始研判。"
                    if ActionType.RESTORE.value not in present: disabled[ActionType.RESTORE.value] = "当前地点暂时不需要修护，或修护资源不足。"
                    if ActionType.EXCHANGE.value not in present: disabled[ActionType.EXCHANGE.value] = "当前地点没有可以交换的同行者。"
                    role = self.content.roles.get(active.role_id, {})
                    if ActionType.USE_SKILL.value not in present: disabled[ActionType.USE_SKILL.value] = "角色专长本回合已使用，或行动点不足。"
                for action_type, reason in disabled.items():
                    grouped[action_type] = {
                        "id": f"action:{action_type}", "type": action_type, "label": terminology.get(action_type, {}).get("name", "当前行动"),
                        "category_label": category_labels.get(action_type, "基础行动"), "action_label": action_labels_by_type.get(action_type, terminology.get(action_type, {}).get("name", action_type)),
                        "description": terminology.get(action_type, {}).get("description", descriptions.get(action_type, "执行一项可用行动。")), "cost": {"ap": 0},
                        "enabled": False, "disabled_reason": reason, "targets": [],
                        "preview_delta": {}, "confirmation": "", "payload": {}, "requirements": self._action_requirements(action_type, {"type": action_type}, state, active), "recommendation_score": 0, "reason": reason,
                    }
        for option in grouped.values():
            if option["enabled"]:
                active = state.players.get(state.shared.active_player_id) if state else None
                if active:
                    if option["targets"]:
                        scored_targets = []
                        for target in option["targets"]:
                            candidate = dict(target["payload"])
                            candidate["type"] = option["type"]
                            candidate["cost"] = option["cost"].get("ap", 0)
                            target_score, target_reason = self._recommendation_for_option(option, state, active, candidate)
                            target["recommendation_score"] = target_score
                            target["reason"] = target_reason
                            scored_targets.append((target_score, target_reason))
                        option["recommendation_score"], generated_reason = max(scored_targets, key=lambda item: item[0])
                    else:
                        option["recommendation_score"], generated_reason = self._recommendation_for_option(option, state, active)
                    option["reason"] = option["reason"] or generated_reason
                else:
                    option["recommendation_score"] = 0
                    option["reason"] = option["reason"] or option["description"]
        return [ActionOption.model_validate(option) for option in grouped.values()]

    def _event_deck_for_scenario(self, scenario, rng):
        source = [event_id for event_id in scenario.get("event_deck", self.content.events) if event_id in self.content.events]; ordered, used = [], set()
        for chain in self.content.event_chains:
            if chain.get("id") in scenario.get("event_chain_ids", []):
                for event_id in chain.get("event_ids", []):
                    if event_id in source and event_id not in used: ordered.append(event_id); used.add(event_id)
        remainder = [event_id for event_id in source if event_id not in used]; rng.shuffle(remainder); return ordered + remainder

    def _draw_action_card(self, state, player):
        if player.flags.get("action_card_draw_turn") == state.shared.turn:
            return False
        if not state.decks.get("action"):
            player.flags["action_card_draw_turn"] = state.shared.turn
            return False
        if len(player.action_hand) >= 3:
            card = state.decks["action"].pop(0)
            state.pending_choice = {"kind": "discard", "player_id": player.id, "next_action_card_id": card, "options": [{"id": item, "label": f"\u5f03\u7f6e {self.content.action_cards.get(item, {}).get('name', item)}"} for item in player.action_hand]}
            state.shared.phase = "pending_choice"
            return False
        player.action_hand.append(state.decks["action"].pop(0))
        player.flags["action_card_draw_turn"] = state.shared.turn
        return True

    def _project_stage_ready(self, state, project, stage):
        requirements = stage.get("requirements", {})
        stage_id = stage.get("id", str(project.stage_index))
        cards = [self.content.cards[item["card_id"]] for item in project.stage_evidence if item.get("stage_id") == stage_id and item.get("card_id") in self.content.cards]
        domains = {card.get("domain") for card in cards}; origins = {origin for card in cards for origin in card.get("origin_tags", [])}
        contributors = {item.get("player_id") for item in project.stage_evidence if item.get("stage_id") == stage_id}
        receipts = project.stage_receipts.get(stage_id, {})
        return set(requirements.get("domains", [])).issubset(domains) and len(origins) >= requirements.get("origin_diversity", 0) and len(contributors) >= requirements.get("contributors", 0) and receipts.get("research_clues", 0) >= requirements.get("clues", 0) and receipts.get("restoration_resource", 0) >= requirements.get("restoration_resource", 0)

    def _apply_reward(self, state, reward):
        state.shared.influence += int(reward.get("influence", 0)); state.shared.research_clues += int(reward.get("research_clues", 0)); state.shared.restoration_resource += int(reward.get("restoration_resource", 0))
        state.shared.route_connection_score += int(reward.get("route_connection", 0))
        state.shared.weathering_track = max(0, state.shared.weathering_track - int(reward.get("weathering_reduction", 0)))

    def _trigger_node_ability(self, state, player, site_id, card_id=None, trigger=None):
        ability = self.content.sites.get(site_id, {}).get("node_ability")
        if not ability or not trigger or not self._ability_matches_event(ability.get("trigger"), trigger): return
        if trigger not in TRIGGER_HANDLERS: raise ValueError(f"unsupported_trigger:{trigger}")
        ability_trigger = ability.get("trigger")
        frequency = ability.get("frequency", "round")
        key = f"{site_id}:{ability_trigger}:{state.shared.turn if frequency != 'game' else 'game'}"
        if key in state.shared.node_ability_uses: return
        card = self.content.cards.get(card_id, {}) if card_id else {}
        condition = ability.get("condition", {})
        if condition.get("domain") and card.get("domain") != condition["domain"]: return
        if ability_trigger == "first_new_domain_contribution_per_round" and card.get("domain") in state.shared.completed_domains: return
        if ability_trigger == "after_architecture_contribution" and card.get("domain") != "architecture": return
        if ability_trigger == "statue_architecture_combo" and card.get("domain") not in {"statue", "architecture"}: return
        if ability_trigger == "statue_architecture_combo":
            domains = {self.content.cards.get(item.get("card_id"), {}).get("domain") for item in state.sites[site_id].contributions} | {card.get("domain")}
            if not {"statue", "architecture"}.issubset(domains): return
        if ability_trigger == "once_per_round_pattern_contribution" and card.get("domain") != "pattern": return
        if ability_trigger == "frontier_trade_combo" and card.get("domain") not in {"frontier", "trade"}: return
        if ability_trigger == "frontier_trade_combo":
            domains = {self.content.cards.get(item.get("card_id"), {}).get("domain") for item in state.sites[site_id].contributions} | {card.get("domain")}
            if not {"frontier", "trade"}.issubset(domains): return
        if trigger == "second_distinct_player_action_per_round":
            count = len({item.get("player_id") for item in state.sites[site_id].contributions if item.get("player_id")})
            if count < 2: return
        self._apply_node_effect(state, player, site_id, ability.get("effect", {}))
        state.shared.node_ability_uses.append(key)

    @staticmethod
    def _ability_matches_event(ability_trigger, event):
        if ability_trigger == event: return True
        return event == "after_interpret_evidence" and ability_trigger in {"first_new_domain_contribution_per_round", "after_architecture_contribution", "statue_architecture_combo", "once_per_round_pattern_contribution", "frontier_trade_combo"}

    def _apply_node_effect(self, state, player, site_id, effect):
        self._dispatch_effect(NODE_EFFECT_HANDLERS, state, player, effect, site_id)

    def _offer_upgrade(self, state, player_id):
        player = state.players[player_id]; options = [self.content.role_upgrades[item] for item in self.content.roles[player.role_id].get("upgrade_ids", []) if item in self.content.role_upgrades and item not in player.upgrades]
        if options and not state.pending_choice: state.pending_choice = {"kind": "role_upgrade", "options": options}

    def _upgrade_effect(self, state, player, effect):
        if not effect.get("type"): return
        normalized = dict(effect)
        if "amount" not in normalized and "value" in normalized: normalized["amount"] = normalized["value"]
        player.flags.setdefault("upgrade_effects", []).append(normalized)

    def _has_upgrade_effect(self, player, effect_type):
        return any(item.get("type") == effect_type for item in player.flags.get("upgrade_effects", []))

    def _apply_round_start_upgrades(self, state, player):
        # Per-round upgrades are consumed by their action handlers. Keeping this
        # hook explicit makes the turn boundary the single place for future
        # reset behavior without carrying a dead compatibility branch.
        return None
