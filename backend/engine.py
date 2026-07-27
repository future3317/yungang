from __future__ import annotations

from collections import deque
from typing import Any

from .content import Content
from .domain.rng import DeterministicRng
from .mechanisms import ACTION_CARD_EFFECT_HANDLERS, CULTURE_EFFECT_HANDLERS, EVENT_EFFECT_HANDLERS, NODE_EFFECT_HANDLERS, TRIGGER_HANDLERS
from .models import ActionOption, ActionType, GameOutcome, GameState, ObjectiveState, PlayerState, ProjectState, RouteState, SiteState, SiteStatus


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
        }
        rules["max_rounds"] += int(difficulty.get("max_rounds", normal.get("max_rounds", 8))) - int(normal.get("max_rounds", 8))
        rules["restoration_resource"] += int(difficulty.get("restoration_resource", normal.get("restoration_resource", 6))) - int(normal.get("restoration_resource", 6))
        if solo:
            solo_rules = scenario.get("solo_rules", {})
            rules["max_rounds"] += int(solo_rules.get("max_rounds_bonus", 0))
            rules["planning_marks_per_round"] = int(solo_rules.get("planning_marks_per_round", 1))
            rules["route_action_discount"] = int(solo_rules.get("route_action_discount", 0))
        return rules

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

        tasks = {tid: {**task, "contributed_cards": [], "completed": False} for tid, task in self.content.tasks.items() if task.get("site_id") in sites}
        routes = {route["id"]: RouteState(id=route["id"], from_site=route["from"], to_site=route["to"], cost=route.get("cost", 1), status=route.get("status", "open"), risk=route.get("risk", 0), connection_level=route.get("connection_level", 0), active_project_id=route.get("active_project_id"), tags=route.get("tags", [])) for route in self.content.routes if route["from"] in sites and route["to"] in sites}
        route_ids = list(routes)
        rng.shuffle(route_ids)
        for route_id in route_ids[: scenario.get("blocked_route_count", 0)]:
            routes[route_id].status = "blocked"
        enabled_project_ids = set(scenario.get("enabled_project_ids", self.content.projects))
        projects = {project_id: ProjectState(id=project_id, site_id=project["site_id"], name=project["name"], stages=project.get("stages", [])) for project_id, project in self.content.projects.items() if project_id in enabled_project_ids and project.get("site_id") in sites}
        objectives = {objective_id: ObjectiveState(id=objective_id, name=objective["name"], type=objective["type"], target=objective.get("target", 1)) for objective_id, objective in self.content.objectives.items() if not scenario.get("objective_ids") or objective_id in scenario["objective_ids"]}
        card_pool = scenario.get("card_pool", {})
        culture_deck = [card_id for card_id in self.content.cards for _ in range(int(card_pool.get(card_id, 1)))] if card_pool else list(self.content.cards)
        event_deck = self._event_deck_for_scenario(scenario, rng)
        rng.shuffle(culture_deck)
        state = GameState(
            session_id=session_id,
            difficulty_id=difficulty_id,
            players=players,
            sites=sites,
            tasks=tasks,
            shared={"max_rounds": effective_rules["max_rounds"], "active_player_id": ids[0], "player_order": ids, "restoration_resource": effective_rules["restoration_resource"], "scenario_id": scenario_id, "threat": scenario.get("starting_threat", 0), "research_clues": scenario.get("starting_clues", 0), "phase": "player_action", "weathering_track": scenario.get("starting_threat", 0), "weathering_limit": scenario.get("weathering_limit", 5), "effective_rules": effective_rules, "solo_mode": solo, "controlled_character_ids": ids if solo else []},
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
        self._refill_market(state)
        self._reveal_event(state)
        state.shared.log.append("\u65c5\u7a0b\u5f00\u59cb\uff1a\u5148\u89c2\u5bdf\u4e8b\u4ef6\u9884\u544a\uff0c\u518d\u51b3\u5b9a\u672c\u56de\u5408\u7684\u8282\u70b9\u884c\u52a8\u3002")
        return self.refresh(state)

    def refresh(self, state: GameState):
        self._ensure_runtime_state(state)
        for task in state.tasks.values():
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
            elif kind == "view_select":
                state.legal_actions = [{"type": ActionType.SELECT_MARKET_CARD.value, "card_id": card, "label": f"\u9009\u62e9 {self.content.cards[card]['name']}"} for card in state.pending_choice["cards"]]
            elif kind == "discard":
                state.legal_actions = [{"type": ActionType.DISCARD.value, "card_id": card, "label": f"\u653e\u4e0b {self.content.cards[card]['name']}"} for card in active.hand]
            elif kind == "role_upgrade":
                state.legal_actions = [{"type": ActionType.SELECT_UPGRADE.value, "upgrade_id": option["id"], "label": option["name"]} for option in state.pending_choice["options"]]
            elif kind == "action_card":
                card_id = state.pending_choice["card_id"]
                state.legal_actions = [{"type": ActionType.USE_ACTION_CARD.value, "card_id": card_id, "target_id": option["id"], "label": option["label"]} for option in state.pending_choice["options"]]
            state.action_options = self._build_action_options(state.legal_actions, state)
            return state

        if state.shared.phase == "planning":
            marks = sum(len(items) for items in state.shared.planning_marks.values())
            actions = [{"type": ActionType.END_PLANNING.value, "label": "\u5f00\u59cb\u884c\u52a8", "cost": 0, "planning_marks": marks}]
            actions.extend({"type": ActionType.PLAN.value, "target_id": site_id, "label": self.content.sites[site_id]["name"], "cost": 0} for site_id in state.sites)
            state.legal_actions = actions
            state.action_options = self._build_action_options(actions, state)
            return state
        actions: list[dict[str, Any]] = [{"type": ActionType.END_TURN.value, "label": "\u7ed3\u675f\u56de\u5408"}, {"type": ActionType.PLAN.value, "label": "\u653e\u7f6e\u89c4\u5212\u6807\u8bb0", "cost": 0}]
        site = state.sites[active.location]
        actions.extend({"type": ActionType.PLAN.value, "target_id": site_id, "label": self.content.sites[site_id]["name"], "cost": 0} for site_id in state.sites)
        if site.status != SiteStatus.CLOSED and active.ap > 0:
            for route in self.content.routes:
                if active.location not in {route["from"], route["to"]}:
                    continue
                target = route["to"] if route["from"] == active.location else route["from"]
                if not self._open(state, target):
                    continue
                route_state = state.routes.get(route["id"])
                if route_state and self._route_open(state, route["id"]):
                    actions.append({"type": ActionType.MOVE.value, "target_id": target, "label": f"\u524d\u5f80 {self.content.sites[target]['name']}", "cost": 0 if active.flags.get("free_move") else route_state.cost, "route_id": route["id"]})
            if active.flags.get("sprint_move"):
                for target in self._reachable(state, active.location, 2):
                    if target != active.location and not any(item.get("target_id") == target for item in actions):
                        actions.append({"type": ActionType.MOVE.value, "target_id": target, "label": f"\u75be\u884c\u81f3 {self.content.sites[target]['name']}", "cost": 1})
            if active.ap >= 1:
                actions.extend({"type": ActionType.EXPLORE.value, "target_id": active.location, "card_id": card, "label": f"\u63a2\u7d22\u5e76\u9009\u62e9 {self.content.cards[card]['name']}", "cost": 1} for card in state.market)
            if active.ap >= 1 and state.shared.restoration_resource > 0 and site.damage > 0:
                actions.append({"type": ActionType.RESTORE.value, "target_id": active.location, "label": "\u5171\u540c\u4fee\u62a4\u5f53\u524d\u8282\u70b9", "cost": 1})
            for route in self.content.routes:
                if active.location not in {route["from"], route["to"]}:
                    continue
                target = route["to"] if route["from"] == active.location else route["from"]
                route_state = state.routes.get(route["id"])
                if not route_state:
                    continue
                if route_state.status in {"strained", "blocked"}:
                    actions.append({"type": ActionType.SURVEY_ROUTE.value, "route_id": route["id"], "target_id": target, "label": f"\u52d8\u5bdf\u8def\u7ebf · {self.content.sites[target]['name']}", "cost": 1})
                if route_state.status in {"strained", "blocked"} and state.shared.research_clues > 0:
                    actions.append({"type": ActionType.RESTORE_ROUTE.value, "route_id": route["id"], "target_id": target, "label": f"\u4fee\u62a4\u8def\u7ebf · {self.content.sites[target]['name']}", "cost": 1})
                if route_state.status == "restored" and route_state.connection_level < 1:
                    actions.append({"type": ActionType.ESTABLISH_CONNECTION.value, "route_id": route["id"], "target_id": target, "label": f"\u5efa\u7acb\u8fde\u63a5 · {self.content.sites[target]['name']}", "cost": 1})
            if state.shared.current_event_id and state.shared.current_event_id not in state.shared.prepared_event_ids:
                actions.append({"type": ActionType.PREPARE.value, "label": "\u51c6\u5907\u5e94\u5bf9\u4e8b\u4ef6", "cost": 1})
            task = state.tasks.get(self.content.sites[active.location].get("active_task_id"))
            if active.ap >= 1 and task and not task["completed"]:
                actions.extend({"type": ActionType.CONTRIBUTE.value, "target_id": active.location, "card_id": card, "label": f"\u8d21\u732e {self.content.cards[card]['name']}", "cost": 1} for card in active.hand if self._card_can_contribute(card, task))
            actions.extend({"type": ActionType.PLAY_CARD.value, "card_id": card, "label": f"\u4f7f\u7528 {self.content.cards[card]['name']}"} for card in active.hand)
            actions.extend({"type": ActionType.USE_ACTION_CARD.value, "card_id": card, "label": f"\u4f7f\u7528\u7b56\u7565\uff1a{self.content.action_cards[card]['name']}"} for card in active.action_hand)
            for other_id, other in state.players.items():
                if other_id != active.id and other.location == active.location:
                    actions.extend({"type": ActionType.EXCHANGE.value, "target_id": other_id, "card_id": card, "label": f"\u4ea4\u7ed9 {other.name}：{self.content.cards[card]['name']}", "cost": 1} for card in active.hand)
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
        if state.shared.outcome:
            raise ValueError("game_is_over")
        if state.pending_choice:
            result = self._resolve_choice(state, req)
            self._remember_request(state, request_id)
            return result
        pid, action = req["player_id"], req["action"]
        if pid != state.shared.active_player_id:
            raise ValueError("not_active_player")
        player = state.players[pid]
        target = req.get("target_site_id") or req.get("target_id")
        if action == ActionType.MOVE.value: self._move(state, player, target)
        elif action == ActionType.EXPLORE.value: self._request_explore(state, player, req.get("card_id"))
        elif action == ActionType.CONTRIBUTE.value: self._contribute(state, player, target, req.get("card_id"))
        elif action == ActionType.RESTORE.value: self._restore(state, player, target)
        elif action == ActionType.EXCHANGE.value: self._exchange(state, player, target, req.get("card_id"))
        elif action == ActionType.USE_SKILL.value: self._skill(state, player)
        elif action == ActionType.PLAY_CARD.value: self._play_card(state, player, req.get("card_id"))
        elif action == ActionType.USE_ACTION_CARD.value: self._use_action_card(state, player, req.get("card_id"), req.get("target_id") or req.get("route_id"))
        elif action == ActionType.SURVEY_ROUTE.value: self._survey_route(state, player, req.get("route_id"))
        elif action == ActionType.RESTORE_ROUTE.value: self._restore_route(state, player, req.get("route_id"))
        elif action == ActionType.ESTABLISH_CONNECTION.value: self._establish_connection(state, player, req.get("route_id"))
        elif action == ActionType.PREPARE.value: self._prepare(state, player)
        elif action == ActionType.END_TURN.value: self._end_turn(state, player)
        elif action == ActionType.PLAN.value: self._plan(state, player, target)
        elif action == ActionType.END_PLANNING.value: self._end_planning(state, player)
        else: raise ValueError("unknown_action")
        state.revision += 1
        self._remember_request(state, request_id)
        self._check_outcome(state)
        return self.refresh(state)

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
            cost = 0 if player.flags.pop("free_move", False) else route_state.cost
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
        player.ap -= 1; player.hand.append(card); state.market.remove(card); self._refill_market(state); state.sites[player.location].discovered = True
        state.shared.research_clues += 1
        project = state.projects.get(state.sites[player.location].active_project_id or "")
        self._advance_project(state, project, player.id, "explore", card)
        self._trigger_node_ability(state, player, player.location, card_id=card, trigger="first_explore")
        self._trigger_node_ability(state, player, player.location, card_id=card, trigger="after_explore")
        state.shared.log.append(f"{player.name} \u5728 {self.content.sites[player.location]['name']} \u53d1\u73b0\u4e86 {self.content.cards[card]['name']}")

    def _request_explore(self, state, player, card):
        if player.ap < 1 or card not in state.market:
            raise ValueError("invalid_explore")
        if len(player.hand) >= 3:
            state.pending_choice = {"kind": "discard", "next_card_id": card, "options": [{"id": item, "label": f"放下 {self.content.cards[item]['name']}"} for item in player.hand]}
            state.shared.phase = "pending_choice"
            return
        self._explore(state, player, card)

    def _contribute(self, state, player, site_id, card):
        task = state.tasks.get(self.content.sites[site_id].get("active_task_id")) if site_id in self.content.sites else None
        if player.ap < 1 or player.location != site_id or not task or task["completed"] or card not in player.hand or not self._card_can_contribute(card, task): raise ValueError("invalid_contribution")
        player.ap -= 1; player.hand.remove(card); player.contributions += 1
        site = state.sites[site_id]; site.contributions.append({"player_id": player.id, "card_id": card, "origin_tags": self.content.cards[card].get("origin_tags", [])})
        task["contributed_cards"].append(card); task.setdefault("contributed_by_player", {})[player.id] = task.setdefault("contributed_by_player", {}).get(player.id, 0) + 1; site.influence += 1; state.shared.influence += 1
        project = state.projects.get(site.active_project_id or "")
        if project and project.status == "active": self._advance_project(state, project, player.id, "contribute", card)
        if player.flags.get("harmony_active") and self._has_upgrade_effect(player, "harmony_origin_bonus"):
            player.flags["next_contribute_bonus"] = player.flags.get("next_contribute_bonus", 0) + 1
        bonus = player.flags.pop("next_contribute_bonus", 0)
        if bonus:
            player.influence += bonus; state.shared.influence += bonus
            state.shared.log.append(f"{player.name} \u7684\u534f\u4f5c\u52a0\u6210\u751f\u6548\uff1a\u5f71\u54cd\u529b +{bonus}")
        state.decks.setdefault("archive", []).append(card)
        if player.id not in task.setdefault("contributing_player_ids", []): task["contributing_player_ids"].append(player.id)
        self._trigger_node_ability(state, player, site_id, card)
        if player.flags.pop("post_contribution_clue", False): state.shared.research_clues += 1
        if self._has_upgrade_effect(player, "post_contribution_clue"):
            task_origins = {origin for item in task["contributed_cards"] for origin in self.content.cards[item].get("origin_tags", [])}
            if len(task_origins) >= 2: state.shared.research_clues += 1
        if self._task_complete(task):
            task["completed"] = True; domain = task["reward"]["domain"]
            if domain not in state.shared.completed_domains: state.shared.completed_domains.append(domain)
            state.shared.influence += 1; state.shared.restoration_resource += task["reward"].get("restoration_delta", 0); site.damage = max(0, site.damage - task["reward"].get("restoration_delta", 1)); self._update_site(site)
            self._trigger_node_ability(state, player, site_id, trigger="task_completed")
        state.shared.log.append(f"{player.name} \u4e3a {task['name']} \u8d21\u732e\u4e86\u8bc1\u636e")

    def _restore(self, state, player, site_id):
        if player.ap < 1 or player.location != site_id or state.shared.restoration_resource < 1: raise ValueError("invalid_restore")
        site = state.sites[site_id]
        if site.damage <= 0 or site.status == SiteStatus.CLOSED: raise ValueError("site_does_not_need_restoration")
        player.ap -= 1; state.shared.restoration_resource -= 1
        if self._has_upgrade_effect(player, "project_restore_discount"): state.shared.restoration_resource += 1
        site.damage -= 1; self._update_site(site)
        self._advance_project(state, state.projects.get(site.active_project_id or ""), player.id, "restore")

    def _survey_route(self, state, player, route_id):
        route = state.routes.get(route_id)
        if player.ap < 0 or not route or player.location not in {route.from_site, route.to_site} or route.status not in {"strained", "blocked"}: raise ValueError("invalid_route_survey")
        cost = 0 if player.flags.pop("sprint_survey_available", False) else 1
        if player.ap < cost: raise ValueError("not_enough_ap")
        player.ap -= cost; state.shared.research_clues += 1; route.status = "strained"; route.risk = max(0, route.risk - 1)

    def _restore_route(self, state, player, route_id):
        route = state.routes.get(route_id)
        if player.ap < 1 or not route or player.location not in {route.from_site, route.to_site} or route.status not in {"strained", "blocked"}: raise ValueError("invalid_route_restoration")
        clue_cost = 0 if self._has_upgrade_effect(player, "route_action_discount") and player.flags.get("route_discount_round") != state.shared.turn else 1
        if state.shared.research_clues < clue_cost: raise ValueError("not_enough_research_clues")
        player.ap -= 1; state.shared.research_clues -= clue_cost; player.flags["route_discount_round"] = state.shared.turn; route.status = "restored"; route.risk = 0; route.connection_level = max(1, route.connection_level)

    def _establish_connection(self, state, player, route_id):
        route = state.routes.get(route_id)
        if player.ap < 1 or not route or player.location not in {route.from_site, route.to_site} or route.status != "restored": raise ValueError("invalid_connection")
        player.ap -= 1; route.status = "illuminated"; route.connection_level = 2; state.shared.route_connection_score += 1

    def _prepare(self, state, player):
        if player.ap < 1 or not state.shared.current_event_id: raise ValueError("invalid_prepare")
        player.ap -= 1
        event_id = state.shared.current_event_id
        if event_id not in state.shared.prepared_event_ids: state.shared.prepared_event_ids.append(event_id)
        player.flags["prepared_event_id"] = event_id
        state.shared.log.append(f"{player.name} \u5df2\u51c6\u5907\u5e94\u5bf9\u4e8b\u4ef6\uff1a{self.content.events[event_id]['name']}")

    def _exchange(self, state, player, recipient_id, card):
        recipient = state.players.get(recipient_id)
        if player.ap < 1 or not recipient or recipient.location != player.location or card not in player.hand or len(recipient.hand) >= 3: raise ValueError("invalid_exchange")
        player.ap -= 1; player.hand.remove(card); recipient.hand.append(card)

    def _skill(self, state, player):
        role = self.content.roles[player.role_id]; ability = role["ability"]; cost = ability.get("ap_cost", 1)
        if player.skill_used or player.ap < cost: raise ValueError("skill_unavailable")
        if ability["action"] == "fine_repair":
            site = state.sites[player.location]
            if site.damage <= 0 or state.shared.restoration_resource < 1: raise ValueError("nothing_to_repair")
            player.ap -= cost; state.shared.restoration_resource -= 1; site.damage = max(0, site.damage - 2); self._update_site(site)
            if self._has_upgrade_effect(player, "fine_repair_threat_bonus") and site.damage > 0: state.shared.threat = max(0, state.shared.threat - 1)
        elif ability["action"] == "harmony_hint": player.ap -= cost; player.flags["harmony_active"] = True
        elif ability["action"] == "sprint_move": player.ap -= cost; player.flags["sprint_move"] = True; player.flags["sprint_survey_available"] = self._has_upgrade_effect(player, "sprint_survey")
        elif ability["action"] == "view_select": player.ap -= cost; state.pending_choice = {"kind": "view_select", "cards": state.market[:4 if self._has_upgrade_effect(player, "market_look_bonus") else 3]}; player.skill_used = True; return
        player.skill_used = True

    def _play_card(self, state, player, card):
        if card not in player.hand: raise ValueError("card_not_in_hand")
        player.hand.remove(card); state.decks.setdefault("discard", []).append(card); self._effect(state, player, self.content.cards[card].get("effect", {}))

    def _use_action_card(self, state, player, card, target_id=None):
        if card not in player.action_hand or card not in self.content.action_cards: raise ValueError("action_card_unavailable")
        effect = self.content.action_cards[card].get("effect", {}); typ = effect.get("type")
        adjacent = [route for route in state.routes.values() if player.location in {route.from_site, route.to_site}]
        route_effects = {"survey_route", "survey_and_mitigate", "survey_multiple_routes", "reduce_route_risk", "restore_route", "establish_connection", "restore_and_move"}
        candidates = [route for route in adjacent if route.status in ({"restored"} if typ == "establish_connection" else {"blocked", "strained"})]
        if typ == "remote_exchange_or_connect" and not target_id:
            options = [{"id": item.id, "label": f"队友 · {item.name}"} for item in state.players.values() if item.id != player.id] + [{"id": route.id, "label": "路线 · 已修复连接"} for route in adjacent if route.status == "restored"]
            if not options: raise ValueError("no_valid_action_card_target")
            state.pending_choice = {"kind": "action_card", "card_id": card, "options": options}
            return
        if typ == "transfer_resource" and not target_id:
            options = [{"id": item.id, "label": f"队友 · {item.name}"} for item in state.players.values() if item.id != player.id and item.location == player.location]
            if not options: raise ValueError("no_valid_action_card_target")
            state.pending_choice = {"kind": "action_card", "card_id": card, "options": options}
            return
        if typ == "team_prepare" and not target_id:
            options = [{"id": item.id, "label": f"值守 · {item.name}"} for item in state.players.values()]
            state.pending_choice = {"kind": "action_card", "card_id": card, "options": options}
            return
        if typ in route_effects and not target_id:
            if not candidates: raise ValueError("no_valid_action_card_target")
            state.pending_choice = {"kind": "action_card", "card_id": card, "options": [{"id": route.id, "label": f"{self.content.sites[route.from_site]['name']} → {self.content.sites[route.to_site]['name']} · {route.status}"} for route in candidates]}
            return
        stressed = next((route for route in candidates if route.id == target_id), None)
        if typ in route_effects and not stressed: raise ValueError("invalid_action_card_target")
        if typ == "remote_exchange_or_connect" and target_id not in {item.id for item in state.players.values() if item.id != player.id} | {route.id for route in adjacent if route.status == "restored"}: raise ValueError("invalid_action_card_target")
        if typ == "transfer_resource" and target_id not in {item.id for item in state.players.values() if item.id != player.id and item.location == player.location}: raise ValueError("invalid_action_card_target")
        if typ == "team_prepare" and target_id not in state.players: raise ValueError("invalid_action_card_target")
        player.action_hand.remove(card); state.decks.setdefault("action_discard", []).append(card)
        self._dispatch_action_card_effect(state, player, effect, target_id, adjacent, stressed)
        self._draw_action_card(state, player)

    def _dispatch_action_card_effect(self, state, player, effect, target_id, adjacent, stressed):
        handler_name = ACTION_CARD_EFFECT_HANDLERS.get(effect.get("type", ""))
        if not handler_name:
            raise ValueError(f"unsupported_action_card_effect:{effect.get('type')}")
        getattr(self, handler_name)(state, player, effect, target_id, adjacent, stressed)

    def _action_card_survey_route(self, state, player, effect, target_id, adjacent, stressed): self._action_card_survey_routes(state, effect, stressed)
    def _action_card_survey_multiple_routes(self, state, player, effect, target_id, adjacent, stressed):
        routes = [route for route in adjacent if route.status in {"blocked", "strained"}]
        for route in routes[: int(effect.get("count", 2))]: self._action_card_survey_routes(state, effect, route)
    def _action_card_survey_and_mitigate(self, state, player, effect, target_id, adjacent, stressed): self._action_card_survey_routes(state, effect, stressed)
    def _action_card_reduce_route_risk(self, state, player, effect, target_id, adjacent, stressed): self._action_card_survey_routes(state, effect, stressed)
    def _action_card_survey_routes(self, state, effect, route):
        if route:
            route.status = "strained"
            route.risk = max(0, route.risk + int(effect.get("risk_delta", -1)))
            state.shared.research_clues += int(effect.get("clues", 1))
    def _action_card_restore_route(self, state, player, effect, target_id, adjacent, stressed):
        if stressed:
            stressed.status = "restored"; stressed.risk = 0; stressed.connection_level = max(1, stressed.connection_level)
    def _action_card_establish_connection(self, state, player, effect, target_id, adjacent, stressed):
        restored = next((route for route in adjacent if route.id == target_id and route.status == "restored"), None) or next((route for route in adjacent if route.status == "restored"), None)
        if restored: restored.status = "illuminated"; restored.connection_level = 2; state.shared.route_connection_score += 1
    def _action_card_prepare_event(self, state, player, effect, target_id, adjacent, stressed): self._action_card_team_prepare(state, player, effect, target_id, adjacent, stressed)
    def _action_card_team_prepare(self, state, player, effect, target_id, adjacent, stressed):
        if state.shared.current_event_id and state.shared.current_event_id not in state.shared.prepared_event_ids: state.shared.prepared_event_ids.append(state.shared.current_event_id)
    def _action_card_restore_and_move(self, state, player, effect, target_id, adjacent, stressed): state.shared.restoration_resource += int(effect.get("resource", 1)); player.flags["free_move"] = True
    def _action_card_remote_exchange_or_connect(self, state, player, effect, target_id, adjacent, stressed):
        recipient = state.players.get(target_id or "")
        if recipient: recipient.flags["remote_exchange"] = True
        else:
            restored = next((route for route in adjacent if route.id == target_id and route.status == "restored"), None)
            if restored: restored.status = "illuminated"; restored.connection_level = 2; state.shared.route_connection_score += 1
    def _action_card_reserve_ap(self, state, player, effect, target_id, adjacent, stressed): player.ap = min(player.max_ap + 1, player.ap + 1)
    def _action_card_transfer_resource(self, state, player, effect, target_id, adjacent, stressed):
        recipient = state.players.get(target_id or "")
        if recipient: recipient.flags["supplies"] = recipient.flags.get("supplies", 0) + int(effect.get("amount", 1))

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
    def _effect_reduce_threat(self, state, player, effect, site_id=None): state.shared.threat = max(0, state.shared.threat - int(effect.get("amount", 1))); state.shared.weathering_track = state.shared.threat
    def _effect_influence(self, state, player, effect, site_id=None): state.shared.influence += int(effect.get("amount", 1))
    def _effect_gain_influence(self, state, player, effect, site_id=None): state.shared.influence += int(effect.get("amount", 1)); player.influence += int(effect.get("amount", 1))
    def _effect_restore_discount(self, state, player, effect, site_id=None): player.flags["restore_discount"] = int(effect.get("amount", 1))
    def _effect_gain_clue(self, state, player, effect, site_id=None): state.shared.research_clues += int(effect.get("amount", 1))
    def _effect_preview_event(self, state, player, effect, site_id=None): player.flags["event_preview"] = True
    def _effect_exchange_discount(self, state, player, effect, site_id=None): player.flags["exchange_discount"] = int(effect.get("amount", 1))
    def _effect_reserve_market_card(self, state, player, effect, site_id=None): player.flags["reserve_market_card"] = True
    def _effect_inspect_archive(self, state, player, effect, site_id=None): player.flags["archive_inspect"] = True
    def _effect_clue_to_restoration(self, state, player, effect, site_id=None):
        if state.shared.research_clues >= 1:
            state.shared.research_clues -= 1
            state.shared.restoration_resource += int(effect.get("amount", 1))
    def _effect_project_progress(self, state, player, effect, site_id=None):
        if site_id:
            project = state.projects.get(state.sites[site_id].active_project_id or "")
            if project: project.progress += int(effect.get("amount", 1))
    def _effect_temporary_origin_tag(self, state, player, effect, site_id=None): player.flags["temporary_origin_tag"] = effect.get("tag", "cross_origin")
    def _effect_ignore_route_risk(self, state, player, effect, site_id=None): player.flags["ignore_route_risk"] = True
    def _effect_free_exchange(self, state, player, effect, site_id=None): player.flags["free_exchange"] = True
    def _effect_preview_event_target(self, state, player, effect, site_id=None): player.flags["event_preview_target"] = True
    def _effect_route_action_discount(self, state, player, effect, site_id=None): player.flags["route_action_discount"] = int(effect.get("amount", 1))
    def _effect_inspect_adjacent_routes(self, state, player, effect, site_id=None): player.flags["inspect_adjacent_routes"] = True
    def _effect_trigger_role_upgrade(self, state, player, effect, site_id=None): self._offer_upgrade(state, player.id)

    def _end_turn(self, state, player):
        player.ap = player.max_ap; player.skill_used = False
        order = state.shared.player_order; index = order.index(player.id); last = index == len(order) - 1
        state.shared.active_player_id = order[0] if last else order[index + 1]
        self._apply_round_start_upgrades(state, state.players[state.shared.active_player_id])
        if last:
            state.shared.phase = "event_resolution"; state.shared.turn += 1; self._settle_event(state)
            if not state.pending_choice:
                if state.shared.event_instance.get("status") == "resolved": state.shared.event_history.append(dict(state.shared.event_instance))
                self._reveal_event(state)
                for site_id in state.sites:
                    self._trigger_node_ability(state, state.players[state.shared.active_player_id], site_id, trigger="round_start")
                for teammate in state.players.values(): self._draw_action_card(state, teammate)
            if not state.pending_choice:
                state.shared.phase = "planning"
                state.shared.planning_marks = {}
                state.shared.round_summary = self._build_round_summary(state)

    def _end_planning(self, state, player):
        if state.shared.phase != "planning":
            raise ValueError("planning_not_active")
        marks = [mark for values in state.shared.planning_marks.values() for mark in values]
        for mark in marks:
            target_id = mark.get("target_id")
            if target_id in state.sites:
                state.sites[target_id].influence += 1
            elif target_id in state.routes:
                state.routes[target_id].risk = max(0, state.routes[target_id].risk - 1)
            elif target_id in state.projects:
                state.projects[target_id].progress += 1
        state.shared.phase = "player_action"
        state.shared.log.append(f"\u89c4\u5212\u7ed3\u7b97\uff1a{len(marks)} \u679a\u6807\u8bb0\u8f6c\u4e3a\u534f\u4f5c\u52a0\u6210")

    def _build_round_summary(self, state):
        return {
            "round": state.shared.turn - 1,
            "event_id": state.shared.current_event_id,
            "event_targets": list(state.shared.event_targets),
            "planning_marks": sum(len(items) for items in state.shared.planning_marks.values()),
            "weathering_track": state.shared.weathering_track,
            "restoration_resource": state.shared.restoration_resource,
        }

    def _settle_event(self, state):
        event_id = state.shared.current_event_id
        if not event_id: return
        event = self.content.events[event_id]
        prepared = event_id in state.shared.prepared_event_ids
        harmony = [item for item in state.players.values() if item.flags.pop("harmony_active", False)]
        if prepared:
            state.shared.prepared_event_ids.remove(event_id)
            state.shared.threat = max(0, state.shared.threat - 1)
            state.shared.log.append(f"\u51c6\u5907\u751f\u6548\uff1a{event['name']} \u7684\u98ce\u5316\u538b\u529b\u964d\u4f4e 1")
        if harmony:
            state.shared.threat = max(0, state.shared.threat - 1)
            state.shared.log.append("\u548c\u5408\u534f\u4f5c\u751f\u6548\uff1a\u4e8b\u4ef6\u538b\u529b\u964d\u4f4e 1")
        instance = state.shared.event_instance
        if instance.get("event_id") != event_id:
            instance = {"event_id": event_id, "revealed_targets": self._select_event_targets(state, event), "mitigation": [], "status": "forecast"}
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
            else:
                state.shared.threat += 1
                state.shared.weathering_track = state.shared.threat
                state.shared.event_instance["mitigation"] = [{"type": "route", "route_id": state.shared.event_targets[0] if state.shared.event_targets else None, "result": "accepted"}]
            state.shared.event_instance["status"] = "resolved"
            state.shared.event_history.append(dict(state.shared.event_instance))
            state.pending_choice = None; self._reveal_event(state); state.shared.phase = "planning"
        elif state.pending_choice["kind"] == "view_select":
            player = state.players[state.shared.active_player_id]; card = req.get("card_id")
            if action != ActionType.SELECT_MARKET_CARD.value or card not in state.pending_choice["cards"]: raise ValueError("invalid_market_choice")
            player.hand.append(card); state.market.remove(card); self._refill_market(state); state.pending_choice = None
        elif state.pending_choice["kind"] == "discard":
            player = state.players[state.shared.active_player_id]
            discard_id = req.get("card_id")
            next_card = state.pending_choice.get("next_card_id")
            if action != ActionType.DISCARD.value or discard_id not in player.hand or next_card not in state.market: raise ValueError("invalid_discard_choice")
            player.hand.remove(discard_id)
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
            state.pending_choice = None; self._use_action_card(state, player, card, target_id)
        state.revision += 1; self._check_outcome(state); return self.refresh(state)

    def _event_effect(self, state, effect):
        handler_name = EVENT_EFFECT_HANDLERS.get(effect.get("type", ""))
        if not handler_name:
            raise ValueError(f"unsupported_effect:{effect.get('type')}")
        getattr(self, handler_name)(state, None, effect)
        state.shared.weathering_track = state.shared.threat
        state.shared.event_instance["status"] = "resolved"

    def _event_damage_open_sites(self, state, player, effect, site_id=None):
        target_ids = state.shared.event_instance.get("revealed_targets") or state.shared.event_targets
        targets = [state.sites[item] for item in target_ids if item in state.sites]
        for site in targets:
            site.damage = min(site.max_damage, site.damage + int(effect.get("amount", 1)))
            self._update_site(site)
        state.shared.event_instance["resolved_targets"] = [site.id for site in targets]
    def _event_all_influence(self, state, player, effect, site_id=None):
        for teammate in state.players.values(): teammate.influence += int(effect.get("amount", 1))
    def _event_gain_resource(self, state, player, effect, site_id=None): state.shared.restoration_resource += int(effect.get("amount", 1))
    def _event_threat(self, state, player, effect, site_id=None): state.shared.threat += int(effect.get("amount", 1))

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
        state.shared.event_instance = {"event_id": event_id, "forecast_scope": {"target_rule": event.get("target_rule"), "hidden_target_count": len(targets)}, "revealed_targets": targets, "resolved_targets": [], "mitigation": [], "status": "forecast"}

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
        return list(state.players)

    def _refill_market(self, state):
        while len(state.market) < 3 and state.decks["culture"]: state.market.append(state.decks["culture"].pop(0))

    def _advance_project(self, state, project, player_id, action_type="contribute", card_id=None):
        if not project or project.status != "active" or project.stage_index >= len(project.stages): return
        stage = project.stages[project.stage_index]
        if stage.get("action_type", "contribute") != action_type: return
        stage_id = stage.get("id", str(project.stage_index))
        project.stage_evidence.append({"stage_id": stage_id, "card_id": card_id, "player_id": player_id, "action_type": action_type})
        project.stage_progress[stage_id] = project.stage_progress.get(stage_id, 0) + 1
        project.stage_contributors.setdefault(stage_id, [])
        if player_id not in project.stage_contributors[stage_id]: project.stage_contributors[stage_id].append(player_id)
        project.progress += 1
        if player_id not in project.contributors: project.contributors.append(player_id)
        while project.stage_index < len(project.stages) and project.progress >= project.stages[project.stage_index].get("required_progress", 1) and self._project_stage_ready(state, project, project.stages[project.stage_index]):
            project.completed_stages.append(stage_id)
            project.progress = 0; project.stage_index += 1
        if project.stage_index >= len(project.stages): project.status = "completed"; self._apply_reward(state, self.content.projects[project.id].get("reward", {})); self._offer_upgrade(state, player_id)
        if project.stage_index < len(project.stages): project.available_choices = project.stages[project.stage_index].get("choices", [])
        state.shared.log.append(f"\u9879\u76ee {project.name} \u8fdb\u5165\u7b2c {project.stage_index + 1} \u9636\u6bb5")

    def _plan(self, state, player, target):
        if state.shared.phase not in {"planning", "player_action"}:
            raise ValueError("planning_not_active")
        if not target or (target not in state.sites and target not in state.projects and target not in state.routes):
            raise ValueError("invalid_plan_target")
        marks = state.shared.planning_marks.setdefault(player.id, [])
        if len(marks) >= int(state.shared.effective_rules.get("planning_marks_per_round", 2)): raise ValueError("planning_limit_reached")
        marks.append({"target_id": target, "turn": str(state.shared.turn)})
        state.shared.log.append(f"{player.name} \u653e\u7f6e\u89c4\u5212\u6807\u8bb0\uff1a{target}")

    def _card_can_contribute(self, card, task):
        definition = self.content.cards[card]; required_tags = set(task.get("combo_requirement", {}).get("required_combo_tags", []))
        return definition.get("domain") in task.get("required_domains", []) or bool(required_tags & set(definition.get("combo_tags", [])))

    def _task_complete(self, task):
        cards = [self.content.cards[c] for c in task["contributed_cards"]]
        domains = {c.get("domain") for c in cards}; origins = {origin for c in cards for origin in c.get("origin_tags", [])}
        combo = task.get("combo_requirement", {}); combo_tags = {tag for card in cards for tag in card.get("combo_tags", [])}; players = set(task.get("contributing_player_ids", []))
        per_player = task.get("contributed_by_player", {})
        minimum_per_player = int(task.get("required_cards_per_player_min", 0))
        return len(cards) >= task["required_card_count"] and len(origins) >= task["required_origin_diversity"] and set(task["required_domains"]).issubset(domains) and set(combo.get("required_combo_tags", [])).issubset(combo_tags) and set(combo.get("preferred_origins", [])).issubset(origins) and len(players) >= combo.get("minimum_distinct_players", 1) and (not minimum_per_player or all(count >= minimum_per_player for count in per_player.values()))

    def _task_progress(self, task):
        cards = [self.content.cards[c] for c in task.get("contributed_cards", []) if c in self.content.cards]
        domains = {c.get("domain") for c in cards}; origins = {origin for c in cards for origin in c.get("origin_tags", [])}
        combo = task.get("combo_requirement", {}); combo_tags = {tag for card in cards for tag in card.get("combo_tags", [])}; players = set(task.get("contributing_player_ids", []))
        required_domains = set(task.get("required_domains", [])); required_origins = set(combo.get("preferred_origins", [])); required_tags = set(combo.get("required_combo_tags", []))
        requirements = [
            {"key": "cards", "label": "证据数量", "current": len(cards), "target": int(task.get("required_card_count", 0)), "complete": len(cards) >= int(task.get("required_card_count", 0))},
            {"key": "domains", "label": "研究领域", "current": len(domains & required_domains), "target": len(required_domains), "complete": required_domains.issubset(domains), "missing": sorted(required_domains - domains)},
            {"key": "origins", "label": "来源多样性", "current": len(origins), "target": int(task.get("required_origin_diversity", 0)), "complete": len(origins) >= int(task.get("required_origin_diversity", 0))},
            {"key": "contributors", "label": "贡献者", "current": len(players), "target": int(combo.get("minimum_distinct_players", 1)), "complete": len(players) >= int(combo.get("minimum_distinct_players", 1))},
            {"key": "combos", "label": "组合线索", "current": len(combo_tags & required_tags), "target": len(required_tags), "complete": required_tags.issubset(combo_tags), "missing": sorted(required_tags - combo_tags)},
        ]
        if required_origins:
            requirements.append({"key": "preferred_origins", "label": "指定来源", "current": len(origins & required_origins), "target": len(required_origins), "complete": required_origins.issubset(origins), "missing": sorted(required_origins - origins)})
        minimum_per_player = int(task.get("required_cards_per_player_min", 0))
        if minimum_per_player:
            counts = task.get("contributed_by_player", {})
            requirements.append({"key": "cards_per_player", "label": "参与者最低贡献", "current": min(counts.values(), default=0), "target": minimum_per_player, "complete": bool(counts) and all(count >= minimum_per_player for count in counts.values())})
        return {"requirements": requirements, "complete": self._task_complete(task)}

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
        protected_sites = sum(site.status == SiteStatus.STABLE for site in state.sites.values())
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
            state.result = {"outcome": state.shared.outcome, "outcome_reason": state.shared.outcome_reason, "score": state.score.model_dump(), "completed_objectives": [item.id for item in state.objectives.values() if item.completed], "completed_projects": [item.id for item in state.projects.values() if item.status == "completed"], "seed": state.seed}

    def _ensure_runtime_state(self, state):
        if not state.routes:
            state.routes = {route["id"]: RouteState(id=route["id"], from_site=route["from"], to_site=route["to"], cost=route.get("cost", 1), status=route.get("status", "open"), tags=route.get("tags", [])) for route in self.content.routes if route["from"] in state.sites and route["to"] in state.sites}
        if not state.projects:
            state.projects = {project_id: ProjectState(id=project_id, site_id=project["site_id"], name=project["name"], stages=project.get("stages", [])) for project_id, project in self.content.projects.items()}
        for site in state.sites.values():
            if not site.active_project_id:
                project = next((item for item in state.projects.values() if item.site_id == site.id), None)
                site.active_project_id = project.id if project else None

    def _build_action_options(self, actions, state=None):
        descriptions = {
            ActionType.MOVE.value: "沿已显影的路线前往另一个开放节点。",
            ActionType.EXPLORE.value: "从公开市场取走一件文化线索，推进当前地点的研究。",
            ActionType.CONTRIBUTE.value: "把符合委托的线索交给当前地点，完成互证。",
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
        grouped = {}
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
                "description": descriptions.get(action_type, "执行一项可用行动。"),
                "cost": {"ap": cost},
                "enabled": True,
                "disabled_reason": None,
                "targets": [],
                "preview_delta": {"ap": -cost},
                "confirmation": f"确认{action.get('label', action_type)}？",
                "payload": {},
            })
            target = action.get("target_id") or action.get("target_site_id") or action.get("card_id") or action.get("route_id") or action.get("recipient_id") or action.get("upgrade_id")
            payload = {key: value for key, value in action.items() if value is not None}
            if target:
                target_key = str(target)
                if action_type == ActionType.EXCHANGE.value:
                    target_key = f"{target_key}:{action.get('card_id', '')}"
                option["targets"].append({"id": target_key, "label": action.get("label", str(target)), "preview_delta": {"ap": -cost}, "payload": payload})
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
                    if ActionType.CONTRIBUTE.value not in present: disabled[ActionType.CONTRIBUTE.value] = "当前地点没有符合委托的手牌线索。"
                    if ActionType.RESTORE.value not in present: disabled[ActionType.RESTORE.value] = "当前地点暂时不需要修护，或修护资源不足。"
                    if ActionType.EXCHANGE.value not in present: disabled[ActionType.EXCHANGE.value] = "当前地点没有可以交换的同行者。"
                    role = self.content.roles.get(active.role_id, {})
                    if ActionType.USE_SKILL.value not in present: disabled[ActionType.USE_SKILL.value] = "角色专长本回合已使用，或行动点不足。"
                for action_type, reason in disabled.items():
                    grouped[action_type] = {
                        "id": f"action:{action_type}", "type": action_type, "label": action_type,
                        "description": descriptions.get(action_type, "执行一项可用行动。"), "cost": {"ap": 0},
                        "enabled": False, "disabled_reason": reason, "targets": [],
                        "preview_delta": {}, "confirmation": "", "payload": {},
                    }
        return [ActionOption.model_validate(option) for option in grouped.values()]

    def _event_deck_for_scenario(self, scenario, rng):
        source = [event_id for event_id in scenario.get("event_deck", self.content.events) if event_id in self.content.events]; ordered, used = [], set()
        for chain in self.content.event_chains:
            if chain.get("id") in scenario.get("event_chain_ids", []):
                for event_id in chain.get("event_ids", []):
                    if event_id in source and event_id not in used: ordered.append(event_id); used.add(event_id)
        remainder = [event_id for event_id in source if event_id not in used]; rng.shuffle(remainder); return ordered + remainder

    def _draw_action_card(self, state, player):
        if len(player.action_hand) < 1 and state.decks.get("action"): player.action_hand.append(state.decks["action"].pop(0))

    def _project_stage_ready(self, state, project, stage):
        requirements = stage.get("requirements", {})
        stage_id = stage.get("id", str(project.stage_index))
        cards = [self.content.cards[item["card_id"]] for item in project.stage_evidence if item.get("stage_id") == stage_id and item.get("card_id") in self.content.cards]
        domains = {card.get("domain") for card in cards}; origins = {origin for card in cards for origin in card.get("origin_tags", [])}
        contributors = {item.get("player_id") for item in project.stage_evidence if item.get("stage_id") == stage_id}
        return set(requirements.get("domains", [])).issubset(domains) and len(origins) >= requirements.get("origin_diversity", 0) and len(contributors) >= requirements.get("contributors", 0) and state.shared.research_clues >= requirements.get("clues", 0) and state.shared.restoration_resource >= requirements.get("restoration_resource", 0)

    def _apply_reward(self, state, reward):
        state.shared.influence += int(reward.get("influence", 0)); state.shared.research_clues += int(reward.get("research_clues", 0)); state.shared.restoration_resource += int(reward.get("restoration_resource", 0))
        state.shared.route_connection_score += int(reward.get("route_connection", 0))
        state.shared.threat = max(0, state.shared.threat - int(reward.get("threat_reduction", 0)))
        state.shared.weathering_track = state.shared.threat

    def _trigger_node_ability(self, state, player, site_id, card_id=None, trigger=None):
        ability = self.content.sites.get(site_id, {}).get("node_ability")
        if not ability or (trigger and ability.get("trigger") != trigger): return
        trigger = trigger or ability.get("trigger")
        if trigger not in TRIGGER_HANDLERS: raise ValueError(f"unsupported_trigger:{trigger}")
        frequency = ability.get("frequency", "round")
        key = f"{site_id}:{trigger}:{state.shared.turn if frequency != 'game' else 'game'}"
        if key in state.shared.node_ability_uses: return
        card = self.content.cards.get(card_id, {}) if card_id else {}
        condition = ability.get("condition", {})
        if condition.get("domain") and card.get("domain") != condition["domain"]: return
        if trigger == "first_new_domain_contribution_per_round" and card.get("domain") in state.shared.completed_domains: return
        if trigger == "after_architecture_contribution" and card.get("domain") != "architecture": return
        if trigger == "statue_architecture_combo" and card.get("domain") not in {"statue", "architecture"}: return
        if trigger == "once_per_round_pattern_contribution" and card.get("domain") != "pattern": return
        if trigger == "second_distinct_player_action_per_round":
            count = len({item.get("player_id") for item in state.sites[site_id].contributions if item.get("player_id")})
            if count < 2: return
        self._apply_node_effect(state, player, site_id, ability.get("effect", {}))
        state.shared.node_ability_uses.append(key)

    def _apply_node_effect(self, state, player, site_id, effect):
        self._dispatch_effect(NODE_EFFECT_HANDLERS, state, player, effect, site_id)

    def _offer_upgrade(self, state, player_id):
        player = state.players[player_id]; options = [self.content.role_upgrades[item] for item in self.content.roles[player.role_id].get("upgrade_ids", []) if item in self.content.role_upgrades and item not in player.upgrades]
        if options and not state.pending_choice: state.pending_choice = {"kind": "role_upgrade", "options": options}

    def _upgrade_effect(self, state, player, effect):
        if not effect.get("type"): return
        player.flags.setdefault("upgrade_effects", []).append(dict(effect))

    def _has_upgrade_effect(self, player, effect_type):
        return any(item.get("type") == effect_type for item in player.flags.get("upgrade_effects", []))

    def _apply_round_start_upgrades(self, state, player):
        if not self._has_upgrade_effect(player, "archive_retrieve") or player.flags.get("archive_round") == state.shared.turn:
            return
        if state.decks.get("archive") and len(player.hand) < 3:
            player.hand.append(state.decks["archive"].pop())
        player.flags["archive_round"] = state.shared.turn
