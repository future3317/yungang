from __future__ import annotations

from typing import Any

from ..mechanisms import EVENT_EFFECT_HANDLERS
from ..models import EventHistoryRecord, GameState, PlayerState, SiteStatus


class EventsMixin:
    def _settle_event(self, state: GameState) -> None:
        event_id = state.shared.current_event_id
        if not event_id:
            return
        event = self.content.events[event_id]
        prepared = event_id in state.shared.prepared_event_ids or any(item.flags.get("prepared_event_id") == event_id for item in state.players.values())
        harmony = [item for item in state.players.values() if item.flags.pop("harmony_event_reduction", False) or item.flags.pop("harmony_active", False)]
        if prepared:
            if event_id in state.shared.prepared_event_ids:
                state.shared.prepared_event_ids.remove(event_id)
            for item in state.players.values():
                item.flags.pop("prepared_event_id", None)
            state.shared.weathering_track = max(0, state.shared.weathering_track - 1)
            self._record_journal(state, "settle_event", state.shared.active_player_id, f"准备生效：{event['name']} 的风化压力降低 1")
        if harmony:
            state.shared.weathering_track = max(0, state.shared.weathering_track - 1)
            self._record_journal(state, "settle_event", state.shared.active_player_id, "和合协作生效：事件压力降低 1")
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
            state.pending_choice = {
                "kind": "event",
                "event_id": event_id,
                "options": [
                    {"id": "mitigate", "label": "消耗 1 修复资源，缓和道路阻断"},
                    {"id": "accept", "label": "接受阻断，威胁上升 1"},
                ],
            }
            return
        self._event_effect(state, event.get("effect", {}))

    def _reveal_event(self, state: GameState) -> None:
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
        state.shared.event_instance = {
            "event_id": event_id,
            "forecast_scope": {"target_rule": event.get("target_rule"), "hidden_target_count": len(targets)},
            "revealed_targets": targets,
            "resolved_targets": [],
            "mitigation": [],
            "resolution": [],
            "status": "forecast",
        }

    def _select_event_targets(self, state: GameState, event: dict[str, Any]) -> list[str]:
        if event.get("id") == "route_blocked":
            candidates = sorted((route.id for route in state.routes.values() if route.status in {"open", "strained"}), key=str)
            if not candidates:
                return []
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

    def _event_effect(self, state: GameState, effect: dict[str, Any]) -> None:
        handler_name = EVENT_EFFECT_HANDLERS.get(effect.get("type", ""))
        if not handler_name:
            raise ValueError(f"unsupported_effect:{effect.get('type')}")
        getattr(self, handler_name)(state, None, effect)
        state.shared.event_instance["status"] = "resolved"

    def _event_damage_open_sites(self, state: GameState, player: PlayerState | None, effect: dict[str, Any], site_id: str | None = None) -> None:
        target_ids = state.shared.event_instance.get("revealed_targets") or state.shared.event_targets
        targets = [state.sites[item] for item in target_ids if item in state.sites]
        for site in targets:
            site.damage = min(site.max_damage, site.damage + int(effect.get("amount", 1)))
            self._update_site(site)
        state.shared.event_instance["resolved_targets"] = [site.id for site in targets]
        state.shared.event_instance["resolution"] = [{"target_id": site.id, "label": self.content.sites[site.id]["name"], "changes": {"节点损伤": int(effect.get("amount", 1))}, "reason": "事件结算"} for site in targets]

    def _event_all_influence(self, state: GameState, player: PlayerState | None, effect: dict[str, Any], site_id: str | None = None) -> None:
        for teammate in state.players.values():
            teammate.influence += int(effect.get("amount", 1))
        state.shared.event_instance["resolution"] = [{"target_id": teammate.id, "label": teammate.name, "changes": {"个人影响": int(effect.get("amount", 1))}, "reason": "事件结算"} for teammate in state.players.values()]

    def _event_gain_resource(self, state: GameState, player: PlayerState | None, effect: dict[str, Any], site_id: str | None = None) -> None:
        state.shared.restoration_resource += int(effect.get("amount", 1))
        state.shared.event_instance["resolution"] = [{"label": "共同修护资源", "changes": {"修护资源": int(effect.get("amount", 1))}, "reason": "事件结算"}]

    def _event_weathering(self, state: GameState, player: PlayerState | None, effect: dict[str, Any], site_id: str | None = None) -> None:
        state.shared.weathering_track += int(effect.get("amount", 1))
        state.shared.event_instance["resolution"] = [{"label": "风化压力", "changes": {"风化压力": int(effect.get("amount", 1))}, "reason": "事件结算"}]

    def _prepare(self, state: GameState, player: PlayerState) -> None:
        if player.ap < 1 or not state.shared.current_event_id:
            raise ValueError("invalid_prepare")
        player.ap -= 1
        event_id = state.shared.current_event_id
        if event_id not in state.shared.prepared_event_ids:
            state.shared.prepared_event_ids.append(event_id)
        player.flags["prepared_event_id"] = event_id
        self._record_journal(state, "prepare", player.id, f"{player.name} 已准备应对事件：{self.content.events[event_id]['name']}")

    def _end_turn(self, state: GameState, player: PlayerState) -> None:
        reserved_ap = int(player.flags.pop("reserved_ap", 0))
        player.ap = player.max_ap + reserved_ap
        player.skill_used = False
        order = state.shared.player_order
        index = order.index(player.id)
        last = index == len(order) - 1
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
                "research_clues": state.shared.research_clues,
                "influence": state.shared.influence,
                "site_states": {site.id: {"damage": site.damage, "status": site.status.value if hasattr(site.status, "value") else str(site.status)} for site in state.sites.values()},
                "route_states": {route.id: {"risk": route.risk, "status": route.status} for route in state.routes.values()},
            }
            state.shared.round_snapshot = snapshot
            state.shared.phase = "event_resolution"
            state.shared.turn += 1
            self._settle_event(state)
            if state.shared.current_event_id:
                event_name = self.content.events.get(state.shared.current_event_id, {}).get("name", "世界事件")
                self._record_journal(state, "resolve_event", state.shared.active_player_id, f"事件结算：{event_name}")
            if not state.pending_choice:
                self._finalize_round(state, snapshot)

    def _finalize_round(self, state: GameState, snapshot: dict[str, Any]) -> None:
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
