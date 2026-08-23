from __future__ import annotations

from typing import Any

from ..mechanisms import ACTION_CARD_EFFECT_HANDLERS
from ..models import ActionType, GameState, PlayerState


class ActionCardsMixin:
    def _action_card_timing_allowed(self, state: GameState, card: dict[str, Any]) -> bool:
        timing = str(card.get("timing", "")).strip()
        if state.pending_choice and state.pending_choice.get("kind") == "event":
            return "事件响应" in timing
        if "事件响应" in timing:
            return bool(state.pending_choice and state.pending_choice.get("kind") == "event")
        if "事件预告" in timing:
            return state.shared.phase == "player_action" and bool(state.shared.current_event_id)
        return state.shared.phase == "player_action" and not state.pending_choice

    def _action_card_target_available(self, state: GameState, player: PlayerState, definition: dict[str, Any]) -> bool:
        typ = definition.get("effect", {}).get("type")
        adjacent = [route for route in state.routes.values() if player.location in {route.from_site, route.to_site}]
        route_effects = {"survey_route", "survey_and_mitigate", "survey_multiple_routes", "reduce_route_risk", "restore_route", "establish_connection", "restore_and_move"}
        if typ in route_effects:
            statuses = {"restored"} if typ == "establish_connection" else {"blocked", "strained"}
            return any(route.status in statuses for route in adjacent)
        if typ == "remote_exchange_or_connect":
            return any(item.id != player.id for item in state.players.values()) or any(route.status == "restored" for route in adjacent)
        if typ == "transfer_resource":
            return any(item.id != player.id and item.location == player.location for item in state.players.values())
        if typ == "team_prepare":
            return bool(state.players)
        return True

    def _use_action_card(self, state: GameState, player: PlayerState, card: str, target_id: str | None = None, target_ids: list[str] | None = None, force_event_response: bool = False) -> None:
        if card not in player.action_hand or card not in self.content.action_cards:
            raise ValueError("action_card_unavailable")
        definition = self.content.action_cards[card]
        effect = definition.get("effect", {})
        typ = effect.get("type")
        if not self._action_card_timing_allowed(state, definition) and not (force_event_response and "事件响应" in str(definition.get("timing", ""))):
            raise ValueError("action_card_wrong_timing")
        cost = int(definition.get("cost", 1))
        if player.ap < cost:
            raise ValueError("not_enough_ap")
        adjacent = [route for route in state.routes.values() if player.location in {route.from_site, route.to_site}]
        route_effects = {"survey_route", "survey_and_mitigate", "survey_multiple_routes", "reduce_route_risk", "restore_route", "establish_connection", "restore_and_move"}
        candidates = [route for route in adjacent if route.status in ({"restored"} if typ == "establish_connection" else {"blocked", "strained"})]
        if typ == "remote_exchange_or_connect" and not target_id:
            options = [{"id": item.id, "label": f"队友 · {item.name}"} for item in state.players.values() if item.id != player.id] + [{"id": route.id, "label": "路线 · 已修复连接"} for route in adjacent if route.status == "restored"]
            if not options:
                raise ValueError("no_valid_action_card_target")
            self._set_action_card_choice(state, card, options)
            return
        if typ == "transfer_resource" and not target_id:
            options = [{"id": item.id, "label": f"队友 · {item.name}"} for item in state.players.values() if item.id != player.id and item.location == player.location]
            if not options:
                raise ValueError("no_valid_action_card_target")
            self._set_action_card_choice(state, card, options)
            return
        if typ == "team_prepare" and not target_id and not target_ids:
            options = [{"id": item.id, "label": f"值守 · {item.name}"} for item in state.players.values()]
            self._set_action_card_choice(state, card, options)
            return
        if typ in route_effects and not target_id:
            if not candidates:
                raise ValueError("no_valid_action_card_target")
            self._set_action_card_choice(state, card, [{"id": route.id, "label": f"{self.content.sites[route.from_site]['name']} → {self.content.sites[route.to_site]['name']} · {route.status}"} for route in candidates])
            return
        stressed = next((route for route in candidates if route.id == target_id), None)
        if typ in route_effects and not stressed:
            raise ValueError("invalid_action_card_target")
        if typ == "remote_exchange_or_connect" and target_id not in {item.id for item in state.players.values() if item.id != player.id} | {route.id for route in adjacent if route.status == "restored"}:
            raise ValueError("invalid_action_card_target")
        if typ == "transfer_resource" and target_id not in {item.id for item in state.players.values() if item.id != player.id and item.location == player.location}:
            raise ValueError("invalid_action_card_target")
        if typ == "team_prepare":
            selected = list(dict.fromkeys(target_ids or ([target_id] if target_id else [])))
            if not selected or any(item not in state.players for item in selected):
                raise ValueError("invalid_action_card_target")
            effect = {**effect, "_target_ids": selected}
        if typ == "restore_route" and not effect.get("ignore_clue_cost") and state.shared.research_clues < 1:
            raise ValueError("not_enough_research_clues")
        player.ap -= cost
        player.action_hand.remove(card)
        state.decks.setdefault("action_discard", []).append(card)
        self._dispatch_action_card_effect(state, player, effect, target_id, adjacent, stressed)

    def _set_action_card_choice(self, state: GameState, card: str, options: list[dict[str, Any]]) -> None:
        resume = state.pending_choice if state.pending_choice and state.pending_choice.get("kind") == "event" else None
        choice = {"kind": "action_card", "card_id": card, "options": options}
        if resume:
            choice["resume_choice"] = resume
        state.pending_choice = choice

    def _dispatch_action_card_effect(self, state: GameState, player: PlayerState, effect: dict[str, Any], target_id: str | None, adjacent: list, stressed: Any) -> None:
        handler_name = ACTION_CARD_EFFECT_HANDLERS.get(effect.get("type", ""))
        if not handler_name:
            raise ValueError(f"unsupported_action_card_effect:{effect.get('type')}")
        getattr(self, handler_name)(state, player, effect, target_id, adjacent, stressed)

    def _action_card_survey_route(self, state: GameState, player: PlayerState, effect: dict[str, Any], target_id: str | None, adjacent: list, stressed: Any) -> None:
        self._action_card_survey_routes(state, effect, stressed)

    def _action_card_survey_multiple_routes(self, state: GameState, player: PlayerState, effect: dict[str, Any], target_id: str | None, adjacent: list, stressed: Any) -> None:
        routes = [route for route in adjacent if route.status in {"blocked", "strained"}]
        ordered = [stressed, *[route for route in routes if route is not stressed]] if stressed else routes
        for route in ordered[: int(effect.get("max_targets", effect.get("count", 2)))]:
            self._action_card_survey_routes(state, effect, route)

    def _action_card_survey_and_mitigate(self, state: GameState, player: PlayerState, effect: dict[str, Any], target_id: str | None, adjacent: list, stressed: Any) -> None:
        if not stressed:
            raise ValueError("invalid_action_card_target")
        self._action_card_survey_routes(state, effect, stressed)

    def _action_card_reduce_route_risk(self, state: GameState, player: PlayerState, effect: dict[str, Any], target_id: str | None, adjacent: list, stressed: Any) -> None:
        risk_delta = int(effect.get("risk_delta", -int(effect.get("amount", 1))))
        stressed.risk = max(0, stressed.risk + risk_delta)
        state.shared.research_clues += int(effect.get("clues", 0))
        state.shared.weathering_track = max(0, state.shared.weathering_track + int(effect.get("weathering_delta", 0)))

    def _action_card_survey_routes(self, state: GameState, effect: dict[str, Any], route: Any) -> None:
        if route:
            route.status = "strained"
            route.risk = max(0, route.risk + int(effect.get("risk_delta", -1)))
            state.shared.research_clues += int(effect.get("clues", 0))
            state.shared.weathering_track = max(0, state.shared.weathering_track + int(effect.get("weathering_delta", 0)))

    def _action_card_restore_route(self, state: GameState, player: PlayerState, effect: dict[str, Any], target_id: str | None, adjacent: list, stressed: Any) -> None:
        if stressed:
            stressed.status = "restored"
            stressed.risk = 0
            stressed.connection_level = max(1, stressed.connection_level)

    def _action_card_establish_connection(self, state: GameState, player: PlayerState, effect: dict[str, Any], target_id: str | None, adjacent: list, stressed: Any) -> None:
        restored = next((route for route in adjacent if route.id == target_id and route.status == "restored"), None) or next((route for route in adjacent if route.status == "restored"), None)
        if restored:
            restored.status = "illuminated"
            restored.connection_level = 2
            state.shared.route_connection_score += 1

    def _action_card_prepare_event(self, state: GameState, player: PlayerState, effect: dict[str, Any], target_id: str | None, adjacent: list, stressed: Any) -> None:
        self._action_card_team_prepare(state, player, effect, target_id, adjacent, stressed)

    def _action_card_team_prepare(self, state: GameState, player: PlayerState, effect: dict[str, Any], target_id: str | None, adjacent: list, stressed: Any) -> None:
        if state.shared.current_event_id:
            selected = list(dict.fromkeys(effect.get("_target_ids", []) + [player.id]))[: int(effect.get("max_targets", 2))]
            for player_id in selected:
                state.players[player_id].flags["prepared_event_id"] = state.shared.current_event_id
            if state.shared.current_event_id not in state.shared.prepared_event_ids:
                state.shared.prepared_event_ids.append(state.shared.current_event_id)

    def _action_card_restore_and_move(self, state: GameState, player: PlayerState, effect: dict[str, Any], target_id: str | None, adjacent: list, stressed: Any) -> None:
        if stressed:
            stressed.status = "restored"
            stressed.risk = 0
            stressed.connection_level = max(1, stressed.connection_level)
        player.flags["free_move"] = bool(effect.get("move_after_restore", False))

    def _action_card_remote_exchange_or_connect(self, state: GameState, player: PlayerState, effect: dict[str, Any], target_id: str | None, adjacent: list, stressed: Any) -> None:
        recipient = state.players.get(target_id or "")
        if recipient:
            player.flags["remote_exchange_player_id"] = recipient.id
        else:
            restored = next((route for route in adjacent if route.id == target_id and route.status == "restored"), None)
            if restored:
                restored.status = "illuminated"
                restored.connection_level = 2
                state.shared.route_connection_score += 1

    def _action_card_reserve_ap(self, state: GameState, player: PlayerState, effect: dict[str, Any], target_id: str | None, adjacent: list, stressed: Any) -> None:
        # The card turns this action into a banked AP for this player's next turn.
        # Applying it immediately would only refund the card cost and have no effect.
        player.flags["reserved_ap"] = player.flags.get("reserved_ap", 0) + int(effect.get("amount", 1))

    def _action_card_transfer_resource(self, state: GameState, player: PlayerState, effect: dict[str, Any], target_id: str | None, adjacent: list, stressed: Any) -> None:
        recipient = state.players.get(target_id or "")
        amount = int(effect.get("amount", 1))
        if not recipient:
            raise ValueError("invalid_action_card_target")
        if effect.get("resource") == "ap":
            recipient.ap = min(recipient.max_ap, recipient.ap + amount)
            return
        if state.shared.restoration_resource < amount:
            raise ValueError("not_enough_restoration_resource")
        state.shared.restoration_resource -= amount
        recipient.supplies += amount

    def _resolve_choice(self, state: GameState, req: dict[str, Any]) -> GameState:
        action = req["action"]
        choice = req.get("target_id")
        if state.pending_choice["kind"] == "event":
            if action == ActionType.USE_ACTION_CARD.value:
                self._use_action_card(state, state.players[state.shared.active_player_id], req.get("card_id"), req.get("target_id"), req.get("target_ids"))
                state.revision += 1
                self._check_outcome(state)
                return self.refresh(state)
            if action != ActionType.RESOLVE_EVENT.value or choice not in {"mitigate", "accept"}:
                raise ValueError("invalid_event_choice")
            if choice == "mitigate":
                if state.shared.restoration_resource < 1:
                    raise ValueError("not_enough_restoration_resource")
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
            player = state.players[state.shared.active_player_id]
            card = req.get("card_id")
            if action != ActionType.SELECT_MARKET_CARD.value or card not in state.pending_choice["cards"]:
                raise ValueError("invalid_market_choice")
            selected = list(state.pending_choice["cards"])
            if card in state.market:
                state.market.remove(card)
            elif card in state.decks.get("culture", []):
                state.decks["culture"].remove(card)
            else:
                raise ValueError("invalid_market_choice")
            player.hand.append(card)
            if self._has_upgrade_effect(player, "market_look_bonus"):
                reserve = next((item for item in selected if item != card and (item in state.market or item in state.decks.get("culture", []))), None)
                if reserve:
                    if reserve in state.market:
                        state.market.remove(reserve)
                    else:
                        state.decks["culture"].remove(reserve)
                    state.shared.reserved_market_cards.append(reserve)
            self._refill_market(state)
            state.pending_choice = None
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
                return state
            next_card = state.pending_choice.get("next_card_id")
            if action != ActionType.DISCARD.value or discard_id not in player.hand or next_card not in state.market:
                raise ValueError("invalid_discard_choice")
            player.hand.remove(discard_id)
            state.decks.setdefault("discard", []).append(discard_id)
            state.pending_choice = None
            state.shared.phase = "player_action"
            self._explore(state, player, next_card)
        elif state.pending_choice["kind"] == "role_upgrade":
            player = state.players[state.shared.active_player_id]
            upgrade_id = req.get("upgrade_id")
            if action != ActionType.SELECT_UPGRADE.value or upgrade_id not in {item["id"] for item in state.pending_choice["options"]}:
                raise ValueError("invalid_upgrade_choice")
            player.upgrades.append(upgrade_id)
            self._upgrade_effect(state, player, self.content.role_upgrades.get(upgrade_id, {}).get("effect", {}))
            state.pending_choice = None
        elif state.pending_choice["kind"] == "action_card":
            player = state.players[state.shared.active_player_id]
            card = state.pending_choice["card_id"]
            target_id = req.get("target_id")
            if action != ActionType.USE_ACTION_CARD.value or target_id not in {item["id"] for item in state.pending_choice["options"]}:
                raise ValueError("invalid_action_card_target")
            resume_choice = state.pending_choice.get("resume_choice")
            state.pending_choice = None
            self._use_action_card(state, player, card, target_id, req.get("target_ids"), force_event_response=bool(resume_choice))
            if resume_choice and state.pending_choice is None:
                state.pending_choice = resume_choice
        elif state.pending_choice["kind"] == "archive_select":
            player = state.players[state.shared.active_player_id]
            card = req.get("card_id")
            if action != ActionType.SELECT_MARKET_CARD.value or card not in state.pending_choice.get("cards", []):
                raise ValueError("invalid_archive_choice")
            player.flags["archive_hint_card"] = card
            self._record_journal(state, "archive_select", player.id, f"档案提示：{self.content.cards[card]['name']}")
            state.pending_choice = None
        elif state.pending_choice["kind"] == "archive_retrieve":
            player = state.players[state.shared.active_player_id]
            card = req.get("card_id")
            if action != ActionType.SELECT_MARKET_CARD.value or card not in state.pending_choice.get("cards", []):
                raise ValueError("invalid_archive_choice")
            domain = self.content.cards[card].get("domain")
            replacement = next((item for item in player.hand if self.content.cards[item].get("domain") == domain), None)
            if not replacement:
                raise ValueError("archive_retrieve_needs_matching_hand")
            state.decks["archive"].remove(card)
            player.hand.remove(replacement)
            state.decks["archive"].append(replacement)
            player.hand.append(card)
            player.flags["archive_retrieve_round"] = state.shared.turn
            state.pending_choice = None
        state.revision += 1
        self._check_outcome(state)
        return self.refresh(state)
