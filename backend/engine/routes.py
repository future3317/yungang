from __future__ import annotations

from ..models import GameState, PlayerState


class RoutesMixin:
    def _survey_route(self, state: GameState, player: PlayerState, route_id: str) -> None:
        route = state.routes.get(route_id)
        if not route or player.location not in {route.from_site, route.to_site} or route.status not in {"strained", "blocked"}:
            raise ValueError("invalid_route_survey")
        self._trigger_node_ability(state, player, player.location, trigger="after_route_action")
        cost = 0 if player.flags.pop("sprint_survey_available", False) else max(0, 1 - int(player.flags.pop("route_action_discount", 0)))
        cost = self._event_action_cost(state, "survey_route", cost)
        if player.ap < cost:
            raise ValueError("not_enough_ap")
        player.ap -= cost
        state.shared.research_clues += 1
        route.status = "strained"
        route.risk = max(0, route.risk - 1)

    def _restore_route(self, state: GameState, player: PlayerState, route_id: str) -> None:
        route = state.routes.get(route_id)
        action_cost = self._event_action_cost(state, "restore_route", 1)
        if (
            player.ap < action_cost
            or not route
            or player.location not in {route.from_site, route.to_site}
            or route.status not in {"strained", "blocked"}
        ):
            raise ValueError("invalid_route_restoration")
        self._trigger_node_ability(state, player, player.location, trigger="after_route_action")
        clue_cost = 0 if player.flags.pop("route_action_discount", 0) or (self._has_upgrade_effect(player, "route_action_discount") and player.flags.get("route_discount_round") != state.shared.turn) else 1
        if state.shared.research_clues < clue_cost:
            raise ValueError("not_enough_research_clues")
        player.ap -= action_cost
        state.shared.research_clues -= clue_cost
        player.flags["route_discount_round"] = state.shared.turn
        route.status = "restored"
        route.risk = 0
        route.connection_level = max(1, route.connection_level)

    def _establish_connection(self, state: GameState, player: PlayerState, route_id: str) -> None:
        route = state.routes.get(route_id)
        action_cost = self._event_action_cost(state, "establish_connection", 1)
        if player.ap < action_cost or not route or player.location not in {route.from_site, route.to_site} or route.status != "restored":
            raise ValueError("invalid_connection")
        player.ap -= action_cost
        route.status = "illuminated"
        route.connection_level = 2
        state.shared.route_connection_score += 1
        self._emit_scenario_rule(state, "after_establish_connection", {"player_id": player.id, "route_id": route_id})
