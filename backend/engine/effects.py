from __future__ import annotations

from typing import Any

from ..mechanisms import CULTURE_EFFECT_HANDLERS
from ..models import GameState, PlayerState


class EffectsMixin:
    def _effect(self, state: GameState, player: PlayerState, effect: dict[str, Any]) -> None:
        self._dispatch_effect(CULTURE_EFFECT_HANDLERS, state, player, effect)

    def _dispatch_effect(self, registry: dict[str, str], state: GameState, player: PlayerState, effect: dict[str, Any], site_id: str | None = None) -> None:
        typ = effect.get("type")
        handler_name = registry.get(typ or "")
        if not handler_name:
            raise ValueError(f"unsupported_effect:{typ}")
        getattr(self, handler_name)(state, player, effect, site_id)

    def _effect_gain_ap(self, state: GameState, player: PlayerState, effect: dict[str, Any], site_id: str | None = None) -> None:
        player.ap = min(player.max_ap, player.ap + int(effect.get("amount", 1)))

    def _effect_next_contribute_bonus(self, state: GameState, player: PlayerState, effect: dict[str, Any], site_id: str | None = None) -> None:
        player.flags["next_contribute_bonus"] = player.flags.get("next_contribute_bonus", 0) + int(effect.get("amount", 1))

    def _effect_free_move(self, state: GameState, player: PlayerState, effect: dict[str, Any], site_id: str | None = None) -> None:
        player.flags["free_move"] = True

    def _effect_restore_and_influence(self, state: GameState, player: PlayerState, effect: dict[str, Any], site_id: str | None = None) -> None:
        state.shared.restoration_resource += int(effect.get("resource", 1))
        player.influence += int(effect.get("influence", 1))

    def _effect_reduce_weathering(self, state: GameState, player: PlayerState, effect: dict[str, Any], site_id: str | None = None) -> None:
        state.shared.weathering_track = max(0, state.shared.weathering_track - int(effect.get("amount", 1)))

    def _effect_influence(self, state: GameState, player: PlayerState, effect: dict[str, Any], site_id: str | None = None) -> None:
        state.shared.influence += int(effect.get("amount", 1))

    def _effect_gain_influence(self, state: GameState, player: PlayerState, effect: dict[str, Any], site_id: str | None = None) -> None:
        amount = int(effect.get("amount", 1))
        state.shared.influence += amount
        player.influence += amount

    def _effect_restore_discount(self, state: GameState, player: PlayerState, effect: dict[str, Any], site_id: str | None = None) -> None:
        player.flags["restore_discount"] = int(effect.get("amount", 1))

    def _effect_gain_clue(self, state: GameState, player: PlayerState, effect: dict[str, Any], site_id: str | None = None) -> None:
        state.shared.research_clues += int(effect.get("amount", 1))

    def _effect_preview_event(self, state: GameState, player: PlayerState, effect: dict[str, Any], site_id: str | None = None) -> None:
        player.flags["event_preview"] = True

    def _effect_exchange_discount(self, state: GameState, player: PlayerState, effect: dict[str, Any], site_id: str | None = None) -> None:
        player.flags["exchange_discount"] = int(effect.get("amount", 1))

    def _effect_reserve_market_card(self, state: GameState, player: PlayerState, effect: dict[str, Any], site_id: str | None = None) -> None:
        player.flags["reserve_market_card"] = True

    def _effect_inspect_archive(self, state: GameState, player: PlayerState, effect: dict[str, Any], site_id: str | None = None) -> None:
        player.flags["archive_inspect"] = True

    def _effect_clue_to_restoration(self, state: GameState, player: PlayerState, effect: dict[str, Any], site_id: str | None = None) -> None:
        clues = int(effect.get("clues", 1))
        restoration = int(effect.get("restoration", effect.get("amount", 1)))
        if state.shared.research_clues < clues:
            raise ValueError("not_enough_research_clues")
        state.shared.research_clues -= clues
        state.shared.restoration_resource += restoration

    def _effect_project_progress(self, state: GameState, player: PlayerState, effect: dict[str, Any], site_id: str | None = None) -> None:
        if not site_id:
            return
        project = state.projects.get(state.sites[site_id].active_project_id or "")
        if not project or project.status != "active" or project.stage_index >= len(project.stages):
            return
        amount = int(effect.get("amount", 1))
        stage = project.stages[project.stage_index]
        stage_id = stage.get("id", str(project.stage_index))
        project.progress += amount
        project.stage_progress[stage_id] = project.stage_progress.get(stage_id, 0) + amount
        while project.stage_index < len(project.stages):
            current = project.stages[project.stage_index]
            current_id = current.get("id", str(project.stage_index))
            if project.progress < int(current.get("required_progress", 1)) or not self._project_stage_ready(state, project, current):
                break
            project.completed_stages.append(current_id)
            self._apply_reward(state, current.get("reward") or self._default_stage_reward(current))
            project.progress = 0
            project.stage_index += 1
        if project.stage_index >= len(project.stages):
            project.status = "completed"
            self._apply_reward(state, self.content.projects[project.id].get("reward", {}))

    def _effect_temporary_origin_tag(self, state: GameState, player: PlayerState, effect: dict[str, Any], site_id: str | None = None) -> None:
        player.flags["temporary_origin_tag"] = effect.get("tag", "cross_origin")

    def _effect_ignore_route_risk(self, state: GameState, player: PlayerState, effect: dict[str, Any], site_id: str | None = None) -> None:
        player.flags["ignore_route_risk"] = True

    def _effect_free_exchange(self, state: GameState, player: PlayerState, effect: dict[str, Any], site_id: str | None = None) -> None:
        player.flags["free_exchange"] = True

    def _effect_preview_event_target(self, state: GameState, player: PlayerState, effect: dict[str, Any], site_id: str | None = None) -> None:
        player.flags["event_preview_target"] = True

    def _effect_route_action_discount(self, state: GameState, player: PlayerState, effect: dict[str, Any], site_id: str | None = None) -> None:
        player.flags["route_action_discount"] = int(effect.get("amount", 1))

    def _effect_inspect_adjacent_routes(self, state: GameState, player: PlayerState, effect: dict[str, Any], site_id: str | None = None) -> None:
        player.flags["inspect_adjacent_routes"] = True

    def _effect_trigger_role_upgrade(self, state: GameState, player: PlayerState, effect: dict[str, Any], site_id: str | None = None) -> None:
        self._offer_upgrade(state, player.id)
