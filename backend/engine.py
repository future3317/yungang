from __future__ import annotations

from collections import deque
from typing import Any

from .content import Content
from .domain.rng import DeterministicRng
from .models import ActionType, GameOutcome, GameState, ObjectiveState, PlayerState, ProjectState, RouteState, SiteState, SiteStatus


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
        }
        rules["max_rounds"] += int(difficulty.get("max_rounds", normal.get("max_rounds", 8))) - int(normal.get("max_rounds", 8))
        rules["restoration_resource"] += int(difficulty.get("restoration_resource", normal.get("restoration_resource", 6))) - int(normal.get("restoration_resource", 6))
        if solo:
            solo_rules = scenario.get("solo_rules", {})
            rules["max_rounds"] += int(solo_rules.get("max_rounds_bonus", 0))
            rules["planning_marks_per_round"] = int(solo_rules.get("planning_marks_per_round", 1))
            rules["route_action_discount"] = int(solo_rules.get("route_action_discount", 0))
        return rules

    def new_game(self, session_id="demo", player_ids=None, difficulty_id="normal", scenario_id="sand_and_stone", seed=None):
        ids = player_ids or ["p1", "p2"]
        if not 1 <= len(ids) <= 4:
            raise ValueError("game_needs_one_to_four_players")
        difficulty = self.content.difficulty.get(difficulty_id, self.content.difficulty.get("normal", {}))
        scenario = self.content.scenarios.get(scenario_id, next(iter(self.content.scenarios.values()), {}))
        scenario_id = scenario.get("id", scenario_id)
        rng = DeterministicRng(seed)
        solo = len(ids) == 1
        effective_rules = self._effective_rules(scenario, difficulty, solo)
        if solo:
            controlled_roles = int(scenario.get("solo_rules", {}).get("controlled_roles", 2))
            ids = [ids[0], *[f"{ids[0]}-ally-{index}" for index in range(2, controlled_roles + 1)]]
        role_ids = list(self.content.roles)
        players = {}
        for index, pid in enumerate(ids):
            role_id = role_ids[index % len(role_ids)]
            role = self.content.roles[role_id]
            bonus = effective_rules["solo_ap_bonus"]
            players[pid] = PlayerState(id=pid, name=role["name"], role_id=role_id, location=role.get("start_site_id", "yungang"), ap=3 + bonus, max_ap=3 + bonus)

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
                state.legal_actions = [{"type": ActionType.DISCARD.value, "card_id": card, "label": f"\u5f03\u7f6e {self.content.cards[card]['name']}"} for card in active.hand]
            elif kind == "role_upgrade":
                state.legal_actions = [{"type": ActionType.SELECT_UPGRADE.value, "upgrade_id": option["id"], "label": option["name"]} for option in state.pending_choice["options"]]
            elif kind == "action_card":
                card_id = state.pending_choice["card_id"]
                state.legal_actions = [{"type": ActionType.USE_ACTION_CARD.value, "card_id": card_id, "target_id": option["id"], "label": option["label"]} for option in state.pending_choice["options"]]
            state.action_options = self._build_action_options(state.legal_actions)
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
                    actions.append({"type": ActionType.MOVE.value, "target_id": target, "label": f"\u524d\u5f80 {self.content.sites[route['to']]['name']}", "cost": 0 if active.flags.get("free_move") else route_state.cost, "route_id": route["id"]})
            if active.flags.get("sprint_move"):
                for target in self._reachable(state, active.location, 2):
                    if target != active.location and not any(item.get("target_id") == target for item in actions):
                        actions.append({"type": ActionType.MOVE.value, "target_id": target, "label": f"\u75be\u884c\u81f3 {self.content.sites[target]['name']}", "cost": 1})
            if active.ap >= 1 and len(active.hand) < 3:
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
                    actions.append({"type": ActionType.SURVEY_ROUTE.value, "route_id": route["id"], "target_id": target, "label": f"\u52d8\u5bdf\u8def\u7ebf · {self.content.sites[route['to']]['name']}", "cost": 1})
                if route_state.status in {"strained", "blocked"} and state.shared.research_clues > 0:
                    actions.append({"type": ActionType.RESTORE_ROUTE.value, "route_id": route["id"], "target_id": target, "label": f"\u4fee\u62a4\u8def\u7ebf · {self.content.sites[route['to']]['name']}", "cost": 1})
                if route_state.status == "restored" and route_state.connection_level < 1:
                    actions.append({"type": ActionType.ESTABLISH_CONNECTION.value, "route_id": route["id"], "target_id": target, "label": f"\u5efa\u7acb\u8fde\u63a5 · {self.content.sites[route['to']]['name']}", "cost": 1})
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
        state.action_options = self._build_action_options(actions)
        self._update_objectives(state)
        return state

    def apply(self, state: GameState, req: dict[str, Any]):
        if state.shared.outcome:
            raise ValueError("game_is_over")
        if state.pending_choice:
            return self._resolve_choice(state, req)
        pid, action = req["player_id"], req["action"]
        if pid != state.shared.active_player_id:
            raise ValueError("not_active_player")
        player = state.players[pid]
        target = req.get("target_site_id") or req.get("target_id")
        if action == ActionType.MOVE.value: self._move(state, player, target)
        elif action == ActionType.EXPLORE.value: self._explore(state, player, req.get("card_id"))
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
        else: raise ValueError("unknown_action")
        state.revision += 1
        self._check_outcome(state)
        return self.refresh(state)

    def _move(self, state, player, target):
        route = next((item for item in self.content.routes if {item["from"], item["to"]} == {player.location, target}), None)
        if not route or not self._open(state, target) or not self._route_open(state, route["id"]): raise ValueError("invalid_route")
        route_state = state.routes[route["id"]]
        cost = 0 if player.flags.pop("free_move", False) else route_state.cost
        if player.flags.pop("sprint_move", False): cost = 1
        if player.ap < cost: raise ValueError("not_enough_ap")
        player.ap -= cost; player.location = target
        state.shared.log.append(f"{player.name} \u62b5\u8fbe {self.content.sites[target]['name']}")

    def _explore(self, state, player, card):
        if player.ap < 1 or card not in state.market or len(player.hand) >= 3: raise ValueError("invalid_explore")
        player.ap -= 1; player.hand.append(card); state.market.remove(card); self._refill_market(state); state.sites[player.location].discovered = True
        state.shared.research_clues += 1
        project = state.projects.get(state.sites[player.location].active_project_id or "")
        self._advance_project(state, project, player.id, "explore")
        state.shared.log.append(f"{player.name} \u5728 {self.content.sites[player.location]['name']} \u53d1\u73b0\u4e86 {self.content.cards[card]['name']}")

    def _contribute(self, state, player, site_id, card):
        task = state.tasks.get(self.content.sites[site_id].get("active_task_id")) if site_id in self.content.sites else None
        if player.ap < 1 or player.location != site_id or not task or task["completed"] or card not in player.hand or not self._card_can_contribute(card, task): raise ValueError("invalid_contribution")
        player.ap -= 1; player.hand.remove(card); player.contributions += 1
        site = state.sites[site_id]; site.contributions.append({"player_id": player.id, "card_id": card, "origin_tags": self.content.cards[card].get("origin_tags", [])})
        task["contributed_cards"].append(card); site.influence += 1; state.shared.influence += 1
        project = state.projects.get(site.active_project_id or "")
        if project and project.status == "active": self._advance_project(state, project, player.id, "contribute", card)
        bonus = player.flags.pop("next_contribute_bonus", 0)
        if bonus:
            player.influence += bonus; state.shared.influence += bonus
            state.shared.log.append(f"{player.name} \u7684\u534f\u4f5c\u52a0\u6210\u751f\u6548\uff1a\u5f71\u54cd\u529b +{bonus}")
        state.decks.setdefault("archive", []).append(card)
        if player.id not in task.setdefault("contributing_player_ids", []): task["contributing_player_ids"].append(player.id)
        self._trigger_node_ability(state, player, site_id, card)
        if player.flags.pop("post_contribution_clue", False): state.shared.research_clues += 1
        if self._task_complete(task):
            task["completed"] = True; domain = task["reward"]["domain"]
            if domain not in state.shared.completed_domains: state.shared.completed_domains.append(domain)
            state.shared.influence += 1; state.shared.restoration_resource += task["reward"].get("restoration_delta", 0); site.damage = max(0, site.damage - task["reward"].get("restoration_delta", 1)); self._update_site(site)
        state.shared.log.append(f"{player.name} \u4e3a {task['name']} \u8d21\u732e\u4e86\u8bc1\u636e")

    def _restore(self, state, player, site_id):
        if player.ap < 1 or player.location != site_id or state.shared.restoration_resource < 1: raise ValueError("invalid_restore")
        site = state.sites[site_id]
        if site.damage <= 0 or site.status == SiteStatus.CLOSED: raise ValueError("site_does_not_need_restoration")
        player.ap -= 1; state.shared.restoration_resource -= 1; site.damage -= 1; self._update_site(site)
        self._advance_project(state, state.projects.get(site.active_project_id or ""), player.id, "restore")

    def _survey_route(self, state, player, route_id):
        route = state.routes.get(route_id)
        if player.ap < 1 or not route or player.location not in {route.from_site, route.to_site} or route.status not in {"strained", "blocked"}: raise ValueError("invalid_route_survey")
        player.ap -= 1; state.shared.research_clues += 1; route.status = "strained"; route.risk = max(0, route.risk - 1)

    def _restore_route(self, state, player, route_id):
        route = state.routes.get(route_id)
        if player.ap < 1 or state.shared.research_clues < 1 or not route or player.location not in {route.from_site, route.to_site} or route.status not in {"strained", "blocked"}: raise ValueError("invalid_route_restoration")
        player.ap -= 1; state.shared.research_clues -= 1; route.status = "restored"; route.risk = 0; route.connection_level = max(1, route.connection_level)

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
        elif ability["action"] == "harmony_hint": player.ap -= cost; player.flags["harmony_active"] = True
        elif ability["action"] == "sprint_move": player.ap -= cost; player.flags["sprint_move"] = True
        elif ability["action"] == "view_select": player.ap -= cost; state.pending_choice = {"kind": "view_select", "cards": state.market[:3]}; player.skill_used = True; return
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
        if typ in route_effects and not target_id:
            if not candidates: raise ValueError("no_valid_action_card_target")
            state.pending_choice = {"kind": "action_card", "card_id": card, "options": [{"id": route.id, "label": f"{self.content.sites[route.from_site]['name']} → {self.content.sites[route.to_site]['name']} · {route.status}"} for route in candidates]}
            return
        stressed = next((route for route in candidates if route.id == target_id), None)
        if typ in route_effects and not stressed: raise ValueError("invalid_action_card_target")
        player.action_hand.remove(card); state.decks.setdefault("action_discard", []).append(card)
        if typ in {"survey_route", "survey_and_mitigate", "survey_multiple_routes", "reduce_route_risk"} and stressed:
            stressed.status = "strained"; stressed.risk = max(0, stressed.risk + int(effect.get("risk_delta", -1))); state.shared.research_clues += int(effect.get("clues", 1))
        elif typ == "restore_route" and stressed:
            stressed.status = "restored"; stressed.risk = 0; stressed.connection_level = max(1, stressed.connection_level)
        elif typ == "establish_connection":
            restored = next((route for route in adjacent if route.status == "restored"), None)
            if restored: restored.status = "illuminated"; restored.connection_level = 2; state.shared.route_connection_score += 1
        elif typ in {"prepare_event", "team_prepare"} and state.shared.current_event_id:
            if state.shared.current_event_id not in state.shared.prepared_event_ids: state.shared.prepared_event_ids.append(state.shared.current_event_id)
        elif typ == "restore_and_move": state.shared.restoration_resource += 1; player.flags["free_move"] = True
        elif typ == "remote_exchange_or_connect": player.flags["free_move"] = True
        elif typ == "reserve_ap": player.ap = min(player.max_ap + 1, player.ap + 1)
        elif typ == "transfer_resource": state.shared.restoration_resource += 1
        self._draw_action_card(state, player)

    def _effect(self, state, player, effect):
        typ = effect.get("type")
        if typ == "gain_ap": player.ap = min(player.max_ap, player.ap + effect.get("amount", 1))
        elif typ == "next_contribute_bonus": player.flags["next_contribute_bonus"] = effect.get("amount", 1)
        elif typ == "free_move": player.flags["free_move"] = True
        elif typ == "restore_and_influence": state.shared.restoration_resource += effect.get("resource", 1); player.influence += effect.get("influence", 1)
        elif typ == "reduce_threat": state.shared.threat = max(0, state.shared.threat - effect.get("amount", 1))
        elif typ == "influence": state.shared.influence += effect.get("amount", 1)
        elif typ == "gain_influence": state.shared.influence += effect.get("amount", 1)

    def _end_turn(self, state, player):
        player.ap = player.max_ap; player.skill_used = False
        order = state.shared.player_order; index = order.index(player.id); last = index == len(order) - 1
        state.shared.active_player_id = order[0] if last else order[index + 1]
        if last:
            state.shared.phase = "event_resolution"; state.shared.turn += 1; self._settle_event(state)
            if not state.pending_choice: self._reveal_event(state)
            for teammate in state.players.values(): self._draw_action_card(state, teammate)
            if not state.pending_choice: state.shared.phase = "player_action"

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
        if event_id == "route_blocked" and not prepared:
            state.shared.phase = "pending_choice"
            affected = sorted((route for route in state.routes.values() if route.status in {"open", "strained"}), key=lambda route: route.id)
            if affected:
                target = affected[(state.seed + state.shared.turn) % len(affected)]
                target.status = "blocked"
                target.risk = max(1, target.risk)
                state.shared.event_targets = [target.id]
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
            else: state.shared.threat += 1; state.shared.weathering_track = state.shared.threat
            state.pending_choice = None; self._reveal_event(state); state.shared.phase = "player_action"
        elif state.pending_choice["kind"] == "view_select":
            player = state.players[state.shared.active_player_id]; card = req.get("card_id")
            if action != ActionType.SELECT_MARKET_CARD.value or card not in state.pending_choice["cards"]: raise ValueError("invalid_market_choice")
            player.hand.append(card); state.market.remove(card); self._refill_market(state); state.pending_choice = None
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
        typ = effect.get("type")
        if typ == "damage_open_sites":
            for site in [item for item in state.sites.values() if item.status != SiteStatus.CLOSED][:2]: site.damage = min(site.max_damage, site.damage + effect.get("amount", 1)); self._update_site(site)
        elif typ == "all_influence":
            for player in state.players.values(): player.influence += effect.get("amount", 1)
        elif typ == "gain_resource": state.shared.restoration_resource += effect.get("amount", 1)
        elif typ == "threat": state.shared.threat += effect.get("amount", 1)
        state.shared.weathering_track = state.shared.threat

    def _reveal_event(self, state):
        if not state.decks["events"]: state.shared.current_event_id = None; return
        state.shared.current_event_id = state.decks["events"].pop(0)

    def _refill_market(self, state):
        while len(state.market) < 3 and state.decks["culture"]: state.market.append(state.decks["culture"].pop(0))

    def _advance_project(self, state, project, player_id, action_type="contribute", card_id=None):
        if not project or project.status != "active" or project.stage_index >= len(project.stages): return
        stage = project.stages[project.stage_index]
        if stage.get("action_type", "contribute") != action_type: return
        if card_id: project.stage_evidence.append({"card_id": card_id, "player_id": player_id})
        project.progress += 1
        if player_id not in project.contributors: project.contributors.append(player_id)
        while project.stage_index < len(project.stages) and project.progress >= project.stages[project.stage_index].get("required_progress", 1) and self._project_stage_ready(state, project, project.stages[project.stage_index]):
            project.progress = 0; project.stage_index += 1
        if project.stage_index >= len(project.stages): project.status = "completed"; self._apply_reward(state, self.content.projects[project.id].get("reward", {})); self._offer_upgrade(state, player_id)
        state.shared.log.append(f"\u9879\u76ee {project.name} \u8fdb\u5165\u7b2c {project.stage_index + 1} \u9636\u6bb5")

    def _plan(self, state, player, target):
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
        return len(cards) >= task["required_card_count"] and len(origins) >= task["required_origin_diversity"] and set(task["required_domains"]).issubset(domains) and set(combo.get("required_combo_tags", [])).issubset(combo_tags) and set(combo.get("preferred_origins", [])).issubset(origins) and len(players) >= combo.get("minimum_distinct_players", 1)

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

    def _build_action_options(self, actions):
        grouped = {}
        for action in actions:
            grouped.setdefault(action["type"], {"type": action["type"], "label": action.get("label", action["type"]), "cost": {"ap": action.get("cost", 0)}, "targets": [], "disabled_reason": None})
            target = action.get("target_id") or action.get("card_id") or action.get("route_id")
            if target: grouped[action["type"]]["targets"].append({"id": target, "label": action.get("label", target), "preview": {"cost": action.get("cost", 0)}})
        return list(grouped.values())

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
        requirements = stage.get("requirements", {}); cards = [self.content.cards[item["card_id"]] for item in project.stage_evidence if item["card_id"] in self.content.cards]
        domains = {card.get("domain") for card in cards}; origins = {origin for card in cards for origin in card.get("origin_tags", [])}
        return set(requirements.get("domains", [])).issubset(domains) and len(origins) >= requirements.get("origin_diversity", 0) and state.shared.research_clues >= requirements.get("clues", 0)

    def _apply_reward(self, state, reward):
        state.shared.influence += int(reward.get("influence", 0)); state.shared.research_clues += int(reward.get("research_clues", 0)); state.shared.restoration_resource += int(reward.get("restoration_resource", 0))

    def _trigger_node_ability(self, state, player, site_id, card_id):
        ability = self.content.sites.get(site_id, {}).get("node_ability"); key = f"{site_id}:{state.shared.turn}"; card = self.content.cards[card_id]
        if ability and ability.get("trigger") == "first_new_domain_contribution_per_round" and card.get("domain") not in state.shared.completed_domains and key not in state.shared.node_ability_uses:
            self._effect(state, player, ability.get("effect", {})); state.shared.node_ability_uses.append(key)

    def _offer_upgrade(self, state, player_id):
        player = state.players[player_id]; options = [self.content.role_upgrades[item] for item in self.content.roles[player.role_id].get("upgrade_ids", []) if item in self.content.role_upgrades and item not in player.upgrades]
        if options and not state.pending_choice: state.pending_choice = {"kind": "role_upgrade", "options": options}

    def _upgrade_effect(self, state, player, effect):
        typ = effect.get("type")
        if typ == "post_contribution_clue": player.flags["post_contribution_clue"] = True
        elif typ == "route_action_discount": player.flags["free_move"] = True
        elif typ == "fine_repair_threat_bonus": state.shared.threat = max(0, state.shared.threat - 1)
        elif typ == "project_restore_discount": state.shared.restoration_resource += 1
        elif typ == "harmony_origin_bonus": player.flags["next_contribute_bonus"] = 1
        elif typ == "market_look_bonus": state.shared.research_clues += 1
        elif typ == "archive_retrieve" and state.decks.get("archive") and len(player.hand) < 3: player.hand.append(state.decks["archive"].pop())
        elif typ == "sprint_survey": player.flags["sprint_move"] = True
