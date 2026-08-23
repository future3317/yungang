from __future__ import annotations

from typing import Any

from ..content import Content
from ..models import ActionType, FeedbackEvent, GameState
from .action_cards import ActionCardsMixin
from .base import BaseEngineMixin
from .effects import EffectsMixin
from .events import EventsMixin
from .evidence import EvidenceMixin
from .movement import MovementMixin
from .objectives import ObjectivesMixin
from .planning import PlanningMixin
from .preview import PreviewMixin
from .projects import ProjectsMixin
from .routes import RoutesMixin
from .setup import SetupMixin
from .upgrades import UpgradesMixin


class GameEngine(EffectsMixin, SetupMixin, MovementMixin, EvidenceMixin, RoutesMixin, PlanningMixin, EventsMixin, ProjectsMixin, ActionCardsMixin, UpgradesMixin, ObjectivesMixin, PreviewMixin, BaseEngineMixin):
    """Public orchestrator for the heritage-network game rules.

    Method groups live in focused mixin modules under ``backend/engine/``;
    this class only wires them together and exposes the public lifecycle
    methods ``new_game``, ``refresh``, ``apply``, and ``simulate_action``.
    """

    def __init__(self, content: Content | None = None):
        BaseEngineMixin.__init__(self, content)
        SetupMixin.__init__(self, content)

    def refresh(self, state: GameState) -> GameState:
        self._ensure_runtime_state(state)
        for task in state.tasks.values():
            self._ensure_interpretation(task)
            task["progress"] = self._task_progress(task)
        if state.shared.outcome:
            state.action_options = []
            return state

        active = state.players[state.shared.active_player_id]
        actions: list[dict[str, Any]]

        if state.pending_choice:
            kind = state.pending_choice.get("kind")
            if kind == "event":
                actions = [{"type": ActionType.RESOLVE_EVENT.value, "target_id": option["id"], "label": option["label"]} for option in state.pending_choice["options"]]
                active_player = state.players[state.shared.active_player_id]
                actions.extend({
                    "type": ActionType.USE_ACTION_CARD.value,
                    "card_id": card,
                    "label": f"使用策略：{self.content.action_cards[card]['name']}",
                    "cost": int(self.content.action_cards[card].get("cost", 1)),
                    "enabled": self._action_card_timing_allowed(state, self.content.action_cards[card]) and self._action_card_target_available(state, active_player, self.content.action_cards[card]),
                    "disabled_reason": f"当前不能使用 · 时机：{self.content.action_cards[card].get('timing', '当前行动阶段')}",
                } for card in active_player.action_hand)
            elif kind == "view_select":
                actions = [{"type": ActionType.SELECT_MARKET_CARD.value, "card_id": card, "label": f"选择 {self.content.cards[card]['name']}"} for card in state.pending_choice["cards"]]
            elif kind == "discard":
                if state.pending_choice.get("next_action_card_id"):
                    actions = [{"type": ActionType.DISCARD.value, "card_id": card, "label": f"弃置 {self.content.action_cards.get(card, {}).get('name', card)}"} for card in active.action_hand]
                else:
                    actions = [{"type": ActionType.DISCARD.value, "card_id": card, "label": f"放下 {self.content.cards[card]['name']}"} for card in active.hand]
            elif kind == "role_upgrade":
                actions = [{"type": ActionType.SELECT_UPGRADE.value, "upgrade_id": option["id"], "label": option["name"]} for option in state.pending_choice["options"]]
            elif kind == "action_card":
                card_id = state.pending_choice["card_id"]
                actions = [{"type": ActionType.USE_ACTION_CARD.value, "card_id": card_id, "target_id": option["id"], "label": option["label"], "cost": int(self.content.action_cards.get(card_id, {}).get("cost", 1))} for option in state.pending_choice["options"]]
            elif kind in {"archive_select", "archive_retrieve"}:
                actions = [{"type": ActionType.SELECT_MARKET_CARD.value, "card_id": card, "label": f"选择 {self.content.cards.get(card, {}).get('name', card)}"} for card in state.pending_choice.get("cards", [])]
            else:
                actions = []
            state.action_options = self._build_action_options(actions, state)
            return state

        # The intent board is part of the normal action phase. Older persisted
        # states may still carry the removed planning phase, but their marks
        # must survive until the end-of-round settlement.
        if state.shared.phase == "planning":
            state.shared.phase = "player_action"
        has_current_plan = any(str(mark.get("turn")) == str(state.shared.turn) for mark in state.shared.planning_marks.get(active.id, []))
        actions = [{"type": ActionType.END_TURN.value, "label": "结束回合"}]
        if not has_current_plan:
            actions.append({"type": ActionType.PLAN.value, "label": "放置规划标记", "cost": 0})
        site = state.sites[active.location]
        if not has_current_plan:
            actions.extend({"type": ActionType.PLAN.value, "target_id": site_id, "label": self.content.sites[site_id]["name"], "cost": 0} for site_id in state.sites)
            actions.extend({"type": ActionType.PLAN.value, "target_id": route_id, "label": f"路线：{next((item.get('name') for item in self.content.routes if item['id'] == route_id), route_id)}", "cost": 0} for route_id in state.routes)
            actions.extend({"type": ActionType.PLAN.value, "target_id": project_id, "label": f"项目：{state.projects[project_id].name}", "cost": 0} for project_id in state.projects)
        if site.status != "closed" and active.ap > 0:
            for route in self.content.routes:
                if active.location not in {route["from"], route["to"]}:
                    continue
                target = route["to"] if route["from"] == active.location else route["from"]
                if not self._open(state, target):
                    continue
                route_state = state.routes.get(route["id"])
                if route_state and self._route_open(state, route["id"]):
                    base_cost = 0 if active.flags.get("free_move") else route_state.cost
                    actions.append({"type": ActionType.MOVE.value, "target_id": target, "label": f"前往 {self.content.sites[target]['name']}", "cost": self._event_action_cost(state, "move", base_cost), "route_id": route["id"]})
            if active.flags.get("sprint_move"):
                for target in self._reachable(state, active.location, 2):
                    if target != active.location and not any(item.get("target_id") == target for item in actions):
                        actions.append({"type": ActionType.MOVE.value, "target_id": target, "label": f"疾行至 {self.content.sites[target]['name']}", "cost": 1})
            if active.ap >= 1:
                actions.extend({"type": ActionType.EXPLORE.value, "target_id": active.location, "card_id": card, "label": f"探索并选择 {self.content.cards[card]['name']}", "cost": 1} for card in state.market)
            if active.ap >= 1 and state.shared.restoration_resource > 0 and site.damage > 0:
                actions.append({"type": ActionType.RESTORE.value, "target_id": active.location, "label": "共同修护当前节点", "cost": self._event_action_cost(state, "restore", 1)})
            for route in self.content.routes:
                if active.location not in {route["from"], route["to"]}:
                    continue
                target = route["to"] if route["from"] == active.location else route["from"]
                route_state = state.routes.get(route["id"])
                if not route_state:
                    continue
                if route_state.status in {"strained", "blocked"}:
                    actions.append({"type": ActionType.SURVEY_ROUTE.value, "route_id": route["id"], "target_id": target, "label": f"勘察路线 · {self.content.sites[target]['name']}", "cost": self._event_action_cost(state, "survey_route", 1)})
                if route_state.status in {"strained", "blocked"} and state.shared.research_clues > 0:
                    actions.append({"type": ActionType.RESTORE_ROUTE.value, "route_id": route["id"], "target_id": target, "label": f"修护路线 · {self.content.sites[target]['name']}", "cost": self._event_action_cost(state, "restore_route", 1)})
                if route_state.status == "restored" and route_state.connection_level < 1:
                    actions.append({"type": ActionType.ESTABLISH_CONNECTION.value, "route_id": route["id"], "target_id": target, "label": f"建立连接 · {self.content.sites[target]['name']}", "cost": self._event_action_cost(state, "establish_connection", 1)})
            if state.shared.current_event_id and state.shared.current_event_id not in state.shared.prepared_event_ids:
                actions.append({"type": ActionType.PREPARE.value, "label": "准备应对事件", "cost": 1})
            task = state.tasks.get(self.content.sites[active.location].get("active_task_id"))
            if task and not task["completed"]:
                interpretation = self._ensure_interpretation(task)
                placed = {self._placement_value(item, "card_id") for item in interpretation["placements"]}
                if not interpretation["formed"] and active.ap >= 1:
                    for card in active.hand:
                        if card not in placed and self._card_can_contribute(card, task):
                            for relation, label in (("support", "支持"), ("conflict", "冲突"), ("pending", "待确认")):
                                actions.append({"type": ActionType.INTERPRET_EVIDENCE.value, "target_id": relation, "target_site_id": active.location, "card_id": card, "label": f"将 {self.content.cards[card]['name']} 归入{label}", "cost": self._event_action_cost(state, "interpret_evidence", 1)})
                if not interpretation["formed"] and self._interpretation_ready(task):
                    actions.append({"type": ActionType.FORM_INTERPRETATION.value, "target_id": active.location, "label": "形成当前解释", "cost": 0})
                if interpretation["formed"] and not interpretation["intervention"]:
                    actions.extend({"type": ActionType.CHOOSE_INTERVENTION.value, "target_id": choice, "target_site_id": active.location, "label": label, "cost": 0} for choice, label in (("act_now", "立即处理"), ("minimal", "最小干预"), ("record", "先记录")))
            actions.extend({"type": ActionType.PLAY_CARD.value, "card_id": card, "label": f"使用 {self.content.cards[card]['name']}"} for card in active.hand)
            actions.extend({
                "type": ActionType.USE_ACTION_CARD.value,
                "card_id": card,
                "label": f"使用策略：{self.content.action_cards[card]['name']}",
                "cost": int(self.content.action_cards[card].get("cost", 1)),
                "enabled": self._action_card_timing_allowed(state, self.content.action_cards[card]) and self._action_card_target_available(state, active, self.content.action_cards[card]),
                "disabled_reason": f"当前不能使用 · 时机：{self.content.action_cards[card].get('timing', '当前行动阶段')}",
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
                    actions.extend({"type": ActionType.EXCHANGE.value, "target_id": other_id, "card_id": card, "label": f"交给 {other.name}：{self.content.cards[card]['name']}", "cost": exchange_cost} for card in active.hand)
        role = self.content.roles[active.role_id]
        if active.ap >= role.get("ability", {}).get("ap_cost", 1) and not active.skill_used:
            actions.append({"type": ActionType.USE_SKILL.value, "label": role["ability"]["name"], "skill": role["ability"]["action"], "cost": role["ability"].get("ap_cost", 1)})
        actions = [action for action in actions if action["type"] != ActionType.PLAN.value or action.get("target_id")]
        state.action_options = self._build_action_options(actions, state)
        allowed = self._allowed_action_types(state)
        if allowed is not None:
            state.action_options = [option for option in state.action_options if option.type in allowed]
        self._update_objectives(state)
        return state

    def apply(self, state: GameState, req: dict[str, Any]) -> GameState:
        request_id = req.get("request_id")
        if request_id and request_id in state.processed_request_ids:
            return state
        self._ensure_runtime_state(state)
        if state.shared.outcome:
            raise ValueError("game_is_over")
        if state.pending_choice:
            pid = req.get("player_id", state.shared.active_player_id)
            before = self._metric_snapshot(state, pid)
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
        if action == ActionType.MOVE.value:
            self._move(state, player, target)
        elif action == ActionType.EXPLORE.value:
            self._request_explore(state, player, req.get("card_id"))
        elif action == ActionType.INTERPRET_EVIDENCE.value:
            self._interpret_evidence(state, player, req.get("target_site_id") or player.location, req.get("card_id"), req.get("target_id"))
        elif action == ActionType.FORM_INTERPRETATION.value:
            self._form_interpretation(state, player, target or player.location)
        elif action == ActionType.CHOOSE_INTERVENTION.value:
            self._choose_intervention(state, player, req.get("target_site_id") or player.location, req.get("target_id"))
        elif action == ActionType.RESTORE.value:
            self._restore(state, player, target)
        elif action == ActionType.EXCHANGE.value:
            self._exchange(state, player, target, req.get("card_id"))
        elif action == ActionType.USE_SKILL.value:
            self._skill(state, player)
        elif action == ActionType.PLAY_CARD.value:
            self._play_card(state, player, req.get("card_id"))
        elif action == ActionType.USE_ACTION_CARD.value:
            self._use_action_card(state, player, req.get("card_id"), req.get("target_id") or req.get("route_id"), req.get("target_ids"))
        elif action == ActionType.USE_NODE_ABILITY.value:
            self._use_node_ability(state, player, target or player.location)
        elif action == ActionType.USE_UPGRADE.value:
            self._use_upgrade(state, player, req.get("upgrade_id"))
        elif action == ActionType.SURVEY_ROUTE.value:
            self._survey_route(state, player, req.get("route_id"))
        elif action == ActionType.RESTORE_ROUTE.value:
            self._restore_route(state, player, req.get("route_id"))
        elif action == ActionType.ESTABLISH_CONNECTION.value:
            self._establish_connection(state, player, req.get("route_id"))
        elif action == ActionType.PREPARE.value:
            self._prepare(state, player)
        elif action == ActionType.END_TURN.value:
            self._end_turn(state, player)
        elif action == ActionType.PLAN.value:
            self._plan(state, player, target)
        elif action == ActionType.END_PLANNING.value:
            self._end_planning(state, player)
        else:
            raise ValueError("unknown_action")
        if action not in {ActionType.PLAN.value, ActionType.END_TURN.value, ActionType.END_PLANNING.value}:
            self._resolve_planning_collaboration(state, player, action, req)
        state.revision += 1
        self._remember_request(state, request_id)
        if not req.get("_preview"):
            self._check_outcome(state)
        result = state if req.get("_preview") else self.refresh(state)
        after = self._metric_snapshot(result, pid, site_id=site_id, route_id=route_id)
        changes = self._feedback_changes(before, after)
        self._record_journal(
            state,
            action,
            pid,
            self._journal_message(action, target, req),
            changes,
            self._journal_target(state, target),
        )
        result.feedback_events = [FeedbackEvent(message=self._feedback_message(action), changes=changes)]
        return result
