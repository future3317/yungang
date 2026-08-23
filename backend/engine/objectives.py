from __future__ import annotations

from typing import Any

from ..models import (
    GameState,
    GoalStatus,
    RoundSummary,
    SiteState,
    SiteStatus,
)


class ObjectivesMixin:
    def _update_site(self, site: SiteState) -> None:
        site.status = SiteStatus.CLOSED if site.damage >= site.max_damage else SiteStatus.AT_RISK if site.damage else SiteStatus.STABLE
        site.durability = max(0, site.max_damage - site.damage)
        site.max_durability = site.max_damage

    def _update_objectives(self, state: GameState) -> None:
        completed_projects = sum(project.status == "completed" for project in state.projects.values())
        restored_routes = sum(route.status in {"restored", "illuminated"} for route in state.routes.values())
        protected_sites = sum(site.status == SiteStatus.STABLE and site.discovered for site in state.sites.values())
        all_evidence = [card for player in state.players.values() for card in player.hand] + state.decks.get("archive", [])
        for task in state.tasks.values():
            all_evidence.extend(task.get("contributed_cards", []))
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
        _core_target = len(core_ids)
        _objective_target = len(state.objectives)

        def related_labels(ids: list[str]) -> list[str]:
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

    def _check_outcome(self, state: GameState) -> None:
        self._update_objectives(state)
        scenario = self.content.scenarios.get(state.scenario_id, {})
        closed = sum(site.status == SiteStatus.CLOSED for site in state.sites.values())
        objectives_done = sum(objective.completed for objective in state.objectives.values())
        core = state.projects.get(scenario.get("core_project_id", ""))
        core_complete = bool(core and core.status == "completed")
        victory = (core_complete and objectives_done == len(state.objectives) and objectives_done > 0) or (not scenario.get("core_project_id") and len(state.shared.completed_domains) >= len(self.content.domains) and state.shared.influence >= scenario.get("influence_goal", 10))
        if victory and closed < scenario.get("closed_site_limit", 2) and state.shared.weathering_track < state.shared.weathering_limit and state.shared.turn <= state.shared.max_rounds:
            state.shared.outcome = "victory"
            state.shared.outcome_reason = "core_project_and_objectives_completed" if core_complete else "domain_interpretation_completed"
        elif closed >= scenario.get("closed_site_limit", 2):
            state.shared.outcome = "defeat"
            state.shared.outcome_reason = "too_many_closed_sites"
        elif state.shared.weathering_track >= state.shared.weathering_limit:
            state.shared.outcome = "defeat"
            state.shared.outcome_reason = "weathering_track_reached_limit"
        elif state.shared.turn > state.shared.max_rounds:
            state.shared.outcome = "defeat"
            state.shared.outcome_reason = "round_limit_reached"
        if state.shared.outcome:
            state.shared.phase = "game_over"
            from ..models import GameOutcome, ResultState
            state.result = ResultState(
                outcome=GameOutcome(state.shared.outcome),
                outcome_reason=state.shared.outcome_reason,
                outcome_summary=scenario.get("victory_brief") if state.shared.outcome == "victory" else scenario.get("failure_brief", ""),
                score=state.score,
                completed_objectives=[item.id for item in state.objectives.values() if item.completed],
                completed_projects=[item.id for item in state.projects.values() if item.status == "completed"],
                seed=state.seed,
            )

    def _build_round_summary(self, state: GameState, snapshot: dict[str, Any] | None = None, round_effects: list[dict[str, Any]] | None = None) -> RoundSummary:
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
        return RoundSummary.model_validate({
            "round": snapshot.get("round", state.shared.turn - 1),
            "event_id": snapshot.get("event_id", state.shared.current_event_id),
            "event_targets": event_targets,
            "planning_marks": sum(len(items) for items in snapshot.get("planning_marks", state.shared.planning_marks).values()),
            "planning_mark_count": sum(len(items) for items in snapshot.get("planning_marks", state.shared.planning_marks).values()),
            "before": {
                "weathering": snapshot.get("weathering_track", state.shared.weathering_track),
                "restoration_resource": snapshot.get("restoration_resource", state.shared.restoration_resource),
                "research_clues": snapshot.get("research_clues", state.shared.research_clues),
                "influence": snapshot.get("influence", state.shared.influence),
            },
            "after": {
                "weathering": state.shared.weathering_track,
                "restoration_resource": state.shared.restoration_resource,
                "research_clues": state.shared.research_clues,
                "influence": state.shared.influence,
            },
            "event_resolution": list(state.shared.event_instance.get("resolution", [])),
            "weathering_track": state.shared.weathering_track,
            "restoration_resource": state.shared.restoration_resource,
            "round_effects": list(round_effects or []),
            "site_changes": site_changes,
            "route_changes": route_changes,
            "next_priority": priority,
        })
