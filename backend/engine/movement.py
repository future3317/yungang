from __future__ import annotations

from collections import deque

from ..models import GameState, PlayerState, RouteState, SiteStatus


class MovementMixin:
    def _move(self, state: GameState, player: PlayerState, target: str | None) -> None:
        route = next((item for item in self.content.routes if {item["from"], item["to"]} == {player.location, target}), None)
        sprint = bool(player.flags.get("sprint_move"))
        if not self._open(state, target):
            raise ValueError("invalid_route")
        if not route and sprint and target in self._reachable(state, player.location, 2):
            cost = 1
            route_state = None
        elif route and self._route_open(state, route["id"]):
            route_state = state.routes[route["id"]]
            discount = int(player.flags.pop("next_move_discount", 0))
            cost = self._event_action_cost(state, "move", max(0, (0 if player.flags.pop("free_move", False) else route_state.cost) - discount))
            if player.flags.pop("ignore_route_risk", False):
                cost = max(0, cost - min(route_state.risk, 1))
            if player.flags.pop("sprint_move", False):
                cost = 1
        else:
            raise ValueError("invalid_route")
        if player.ap < cost:
            raise ValueError("not_enough_ap")
        origin = player.location
        player.flags.pop("sprint_move", None)
        player.ap -= cost
        player.location = target
        self._trigger_node_ability(state, player, origin, trigger="first_move_from_site_per_round")
        self._trigger_node_ability(state, player, target, trigger="on_arrival")
        self._record_journal(state, "move", player.id, f"{player.name} 抵达 {self.content.sites[target]['name']}")

    def _reachable(self, state: GameState, start: str, hops: int) -> set[str]:
        found = {start}
        queue = deque([(start, 0)])
        while queue:
            current, distance = queue.popleft()
            if distance >= hops:
                continue
            for route in self.content.routes:
                if current not in {route["from"], route["to"]} or not self._route_open(state, route["id"]):
                    continue
                target = route["to"] if route["from"] == current else route["from"]
                if target not in found:
                    found.add(target)
                    queue.append((target, distance + 1))
        return found

    def _open(self, state: GameState, site_id: str | None) -> bool:
        return site_id in state.sites and state.sites[site_id].status != SiteStatus.CLOSED

    def _route_open(self, state: GameState, route_id: str) -> bool:
        return state.routes.get(route_id, RouteState(id=route_id, from_site="", to_site="")).status in {"open", "restored", "illuminated"}
