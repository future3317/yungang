from __future__ import annotations

from typing import Any

from ..models import GameState, PlayerState, ProjectState, SiteStatus, StageEvidence


class ProjectsMixin:
    def _restore_costs(self, state: GameState, player: PlayerState, site_id: str | None) -> tuple[int, int]:
        action_cost = self._event_action_cost(state, "restore", 1)
        if not site_id or site_id not in state.sites:
            return action_cost, 1
        discount = int(player.flags.get("restore_discount", 0))
        if self._has_upgrade_effect(player, "project_restore_discount") and player.flags.get("project_restore_discount_round") != state.shared.turn:
            discount = max(discount, 1)
        return action_cost, 0 if discount else 1

    def _can_restore(self, state: GameState, player: PlayerState, site_id: str | None) -> bool:
        if not site_id or player.location != site_id or site_id not in state.sites:
            return False
        site = state.sites[site_id]
        action_cost, resource_cost = self._restore_costs(state, player, site_id)
        return site.damage > 0 and site.status != SiteStatus.CLOSED and player.ap >= action_cost and (resource_cost == 0 or state.shared.restoration_resource >= resource_cost or player.supplies >= resource_cost)

    def _advance_project(self, state: GameState, project: ProjectState | None, player_id: str, action_type: str = "interpret_evidence", card_id: str | None = None, receipts: dict[str, int] | None = None) -> None:
        if not project or project.status != "active" or project.stage_index >= len(project.stages):
            return
        stage = project.stages[project.stage_index]
        if stage.get("action_type", "interpret_evidence") != action_type:
            return
        stage_id = stage.get("id", str(project.stage_index))
        project.stage_evidence.append(StageEvidence(stage_id=stage_id, card_id=card_id, player_id=player_id, action_type=action_type))
        project.stage_progress[stage_id] = project.stage_progress.get(stage_id, 0) + 1
        stage_receipts = project.stage_receipts.setdefault(stage_id, {})
        for key, amount in (receipts or {}).items():
            stage_receipts[key] = stage_receipts.get(key, 0) + int(amount)
        project.stage_contributors.setdefault(stage_id, [])
        if player_id not in project.stage_contributors[stage_id]:
            project.stage_contributors[stage_id].append(player_id)
        project.progress += 1
        if player_id not in project.contributors:
            project.contributors.append(player_id)
        while project.stage_index < len(project.stages):
            current_stage = project.stages[project.stage_index]
            current_stage_id = current_stage.get("id", str(project.stage_index))
            if project.progress < current_stage.get("required_progress", 1) or not self._project_stage_ready(state, project, current_stage):
                break
            project.completed_stages.append(current_stage_id)
            self._apply_reward(state, current_stage.get("reward") or self._default_stage_reward(current_stage))
            self._record_journal(state, "project_advance", player_id, f"项目阶段完成：{current_stage.get('name', current_stage_id)}，阶段奖励已到账")
            project.progress = 0
            project.stage_index += 1
        if project.stage_index >= len(project.stages):
            project.status = "completed"
            self._apply_reward(state, self.content.projects[project.id].get("reward", {}))
            self._offer_upgrade(state, player_id)
        if project.stage_index < len(project.stages):
            project.available_choices = project.stages[project.stage_index].get("choices", [])
        self._record_journal(state, "project_advance", player_id, f"项目 {project.name} 进入第 {project.stage_index + 1} 阶段")

    @staticmethod
    def _default_stage_reward(stage: dict[str, Any]) -> dict[str, int]:
        action_type = stage.get("action_type")
        if action_type == "explore":
            return {"research_clues": 1}
        if action_type == "restore":
            return {"restoration_resource": 1}
        return {"influence": 1}

    def _project_stage_ready(self, state: GameState, project: ProjectState, stage: dict[str, Any]) -> bool:
        requirements = stage.get("requirements", {})
        stage_id = stage.get("id", str(project.stage_index))
        cards = [self.content.cards[item["card_id"]] for item in project.stage_evidence if item.get("stage_id") == stage_id and item.get("card_id") in self.content.cards]
        domains = {card.get("domain") for card in cards}
        origins = {origin for card in cards for origin in card.get("origin_tags", [])}
        contributors = {item.get("player_id") for item in project.stage_evidence if item.get("stage_id") == stage_id}
        receipts = project.stage_receipts.get(stage_id, {})
        return (
            set(requirements.get("domains", [])).issubset(domains)
            and len(origins) >= requirements.get("origin_diversity", 0)
            and len(contributors) >= requirements.get("contributors", 0)
            and receipts.get("research_clues", 0) >= requirements.get("clues", 0)
            and receipts.get("restoration_resource", 0) >= requirements.get("restoration_resource", 0)
        )

    def _apply_reward(self, state: GameState, reward: dict[str, Any]) -> None:
        state.shared.influence += int(reward.get("influence", 0))
        state.shared.research_clues += int(reward.get("research_clues", 0))
        state.shared.restoration_resource += int(reward.get("restoration_resource", 0))
        state.shared.route_connection_score += int(reward.get("route_connection", 0))
        state.shared.weathering_track = max(0, state.shared.weathering_track - int(reward.get("weathering_reduction", 0)))

    def _restore(self, state: GameState, player: PlayerState, site_id: str | None) -> None:
        if player.location != site_id:
            raise ValueError("invalid_restore")
        action_cost, resource_cost = self._restore_costs(state, player, site_id)
        if player.ap < action_cost:
            raise ValueError("not_enough_ap")
        site = state.sites[site_id]
        if site.damage <= 0 or site.status == SiteStatus.CLOSED:
            raise ValueError("site_does_not_need_restoration")
        discount = int(player.flags.get("restore_discount", 0))
        if self._has_upgrade_effect(player, "project_restore_discount") and player.flags.get("project_restore_discount_round") != state.shared.turn:
            player.flags["project_restore_discount_round"] = state.shared.turn
        if resource_cost and state.shared.restoration_resource < resource_cost and player.supplies < resource_cost:
            raise ValueError("not_enough_restoration_resource")
        player.ap -= action_cost
        if resource_cost:
            if state.shared.restoration_resource >= resource_cost:
                state.shared.restoration_resource -= resource_cost
            else:
                player.supplies -= resource_cost
        elif player.flags.get("restore_discount", 0):
            player.flags["restore_discount"] -= 1
        site.damage -= 1
        self._update_site(site)
        self._advance_project(state, state.projects.get(site.active_project_id or ""), player.id, "restore", receipts={"restoration_resource": resource_cost})
        self._emit_scenario_rule(state, "after_restore", {"player_id": player.id, "site_id": site_id})
