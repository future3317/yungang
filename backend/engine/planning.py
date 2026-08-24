from __future__ import annotations

from typing import Any

from ..models import ActionType, GameState, PlayerState


class PlanningMixin:
    def _plan(self, state: GameState, player: PlayerState, target: str | None) -> None:
        if state.shared.phase not in {"planning", "player_action"}:
            raise ValueError("planning_not_active")
        if not target or (target not in state.sites and target not in state.projects and target not in state.routes):
            raise ValueError("invalid_plan_target")
        marks = state.shared.planning_marks.setdefault(player.id, [])
        if any(str(mark.get("turn")) == str(state.shared.turn) for mark in marks):
            raise ValueError("planning_limit_reached")
        marks.append({"target_id": target, "turn": str(state.shared.turn)})
        self._record_journal(state, "plan", player.id, self._journal_message("plan", target, {}))

    def _resolve_planning_collaboration(self, state: GameState, player: PlayerState, action: str, req: dict[str, Any]) -> None:
        target_ids = {value for value in (req.get("target_id"), req.get("target_site_id"), req.get("route_id")) if value}
        if action == ActionType.MOVE.value and req.get("_move_route_id"):
            target_ids.add(req["_move_route_id"])
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
                target_name = (
                    self.content.sites.get(mark["target_id"], {}).get("name")
                    or self.content.projects.get(mark["target_id"], {}).get("name")
                    or (route.name if route else mark["target_id"])
                )
                self._record_journal(
                    state, "plan", player.id,
                    f"{player.name} 与 {state.players[owner_id].name} 协作完成{target_name}的计划：行动点返还1，研究点+1"
                )
                return

    def _settle_planning_marks(self, state: GameState, player_id: str) -> list[dict[str, Any]]:
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
                    changes = {"行动点": 1, "研究点": 1, "路线风险": -1}
                else:
                    target_name = self.content.sites.get(target_id, {}).get("name") or self.content.projects.get(target_id, {}).get("name") or target_id or "已声明目标"
                    changes = {"行动点": 1, "研究点": 1}
                effects.append({"type": "planning_collaboration", "target_id": target_id, "label": f"协作接续：{target_name}", "changes": changes, "reason": "另一位同行者完成了这枚规划标记"})
                continue
        state.shared.planning_marks = {}
        state.shared.phase = "player_action"
        self._record_journal(
            state, "plan", state.shared.active_player_id,
            f"规划结算：{collaborated_count} 枚标记已被接续，{len(marks) - collaborated_count} 枚未接续且未改变状态"
        )
        return effects

    def _end_planning(self, state: GameState, player: PlayerState) -> None:
        if state.shared.phase != "planning":
            raise ValueError("planning_not_active")
        self._settle_planning_marks(state, player.id)
