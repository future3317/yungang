from __future__ import annotations

from typing import Any

from ..models import (
    GameState,
    InterpretationEvaluation,
    InterpretationPlacement,
    PlayerState,
)


class EvidenceMixin:
    def _explore(self, state: GameState, player: PlayerState, card: str) -> None:
        if player.ap < 1 or card not in state.market or len(player.hand) >= 3:
            raise ValueError("invalid_explore")
        player.ap -= 1
        player.hand.append(card)
        state.market.remove(card)
        if player.flags.pop("reserve_market_card", False) and state.market:
            state.shared.reserved_market_cards.append(state.market.pop(0))
        self._refill_market(state)
        state.sites[player.location].discovered = True
        state.shared.research_clues += 1
        project = state.projects.get(state.sites[player.location].active_project_id or "")
        self._advance_project(state, project, player.id, "explore", card, {"research_clues": 1})
        self._trigger_node_ability(state, player, player.location, card_id=card, trigger="first_explore")
        self._trigger_node_ability(state, player, player.location, card_id=card, trigger="after_explore")
        self._emit_scenario_rule(state, "after_explore", {"player_id": player.id, "site_id": player.location, "card_id": card})
        self._record_journal(state, "explore", player.id, f"{player.name} 在 {self.content.sites[player.location]['name']} 发现了 {self.content.cards[card]['name']}")

    def _request_explore(self, state: GameState, player: PlayerState, card: str) -> None:
        if player.ap < 1 or card not in state.market:
            raise ValueError("invalid_explore")
        if len(player.hand) >= 3:
            state.pending_choice = {
                "kind": "discard",
                "next_card_id": card,
                "options": [{"id": item, "label": f"放下 {self.content.cards[item]['name']}"} for item in player.hand],
            }
            state.shared.phase = "pending_choice"
            return
        self._explore(state, player, card)

    def _ensure_interpretation(self, task: dict[str, Any]) -> dict[str, Any]:
        interpretation = task.setdefault("interpretation", {})
        interpretation.setdefault("placements", [])
        interpretation.setdefault("formed", False)
        interpretation.setdefault("intervention", None)
        interpretation.setdefault("confidence", 0)
        return interpretation

    @staticmethod
    def _placement_value(item: Any, key: str, default: Any = None) -> Any:
        return item.get(key, default) if isinstance(item, dict) else getattr(item, key, default)

    def _interpret_evidence(self, state: GameState, player: PlayerState, site_id: str, card: str, relation: str) -> None:
        task_id = self.content.sites.get(site_id, {}).get("active_task_id")
        task = state.tasks.get(task_id)
        action_cost = self._event_action_cost(state, "interpret_evidence", 1)
        if (
            relation not in {"support", "conflict", "pending"}
            or player.ap < action_cost
            or player.location != site_id
            or not task
            or task["completed"]
            or card not in player.hand
            or not self._card_can_contribute(card, task)
        ):
            raise ValueError("invalid_interpretation_evidence")
        interpretation = self._ensure_interpretation(task)
        if interpretation["formed"] or any(self._placement_value(item, "card_id") == card for item in interpretation["placements"]):
            raise ValueError("evidence_already_placed")
        player.ap -= action_cost
        player.hand.remove(card)
        player.contributions += 1
        definition = self.content.cards[card]
        origin_tags, combo_tags = list(definition.get("origin_tags", [])), list(definition.get("combo_tags", []))
        if player.flags.pop("temporary_origin_tag", None):
            origin_tags.append("temporary_cross_origin")
        if player.flags.get("harmony_active") and self._has_upgrade_effect(player, "harmony_origin_bonus"):
            origin_tags.append("harmony_origin")
            combo_tags.append("cross_origin")
        placement = {"player_id": player.id, "card_id": card, "relation": relation, "origin_tags": origin_tags, "combo_tags": combo_tags}
        placement_model = InterpretationPlacement.model_validate(placement)
        interpretation["placements"].append(placement_model)
        task["contributed_cards"].append(card)
        task.setdefault("contribution_records", []).append(placement_model)
        task.setdefault("contributed_by_player", {})[player.id] = task.setdefault("contributed_by_player", {}).get(player.id, 0) + 1
        if player.id not in task.setdefault("contributing_player_ids", []):
            task["contributing_player_ids"].append(player.id)
        site = state.sites[site_id]
        site.contributions.append(InterpretationPlacement.model_validate(placement))
        site.influence += 1
        project = state.projects.get(site.active_project_id or "")
        if project and project.status == "active" and relation != "conflict":
            self._advance_project(state, project, player.id, "interpret_evidence", card)
        state.decks.setdefault("archive", []).append(card)
        bonus = player.flags.pop("next_contribute_bonus", 0)
        if bonus:
            player.influence += bonus
            state.shared.influence += bonus
            self._record_journal(state, "interpret_evidence", player.id, f"{player.name} 的协作加成生效：影响力 +{bonus}")
        self._trigger_node_ability(state, player, site_id, card_id=card, trigger="after_interpret_evidence")
        self._emit_scenario_rule(state, "after_interpret_evidence", {"player_id": player.id, "site_id": site_id, "task": task})
        if player.flags.pop("post_contribution_clue", False):
            state.shared.research_clues += 1
        if self._has_upgrade_effect(player, "post_contribution_clue"):
            task_origins = {origin for item in site.contributions if item.get("card_id") in task["contributed_cards"] for origin in item.get("origin_tags", [])}
            if len(task_origins) >= 2:
                state.shared.research_clues += 1

    def _evaluate_interpretation(self, task: dict[str, Any]) -> InterpretationEvaluation:
        interpretation = self._ensure_interpretation(task)
        usable = [item for item in interpretation["placements"] if self._placement_value(item, "relation") != "conflict"]
        cards = [self.content.cards[self._placement_value(item, "card_id")] for item in usable if self._placement_value(item, "card_id") in self.content.cards]
        origins = {origin for item in usable for origin in self._placement_value(item, "origin_tags", [])}
        domains = {item.get("domain") for item in cards}
        tags = {tag for item in usable for tag in self._placement_value(item, "combo_tags", [])}
        combo = task.get("combo_requirement", {})
        missing_domains = sorted(set(task.get("required_domains", [])) - domains)
        preferred_origins = set(combo.get("preferred_origins", []))
        missing_origins = sorted(preferred_origins - origins) if preferred_origins else []
        origin_target = len(preferred_origins) or int(task.get("required_origin_diversity", 0))
        missing_tags = sorted(set(combo.get("required_combo_tags", [])) - tags)
        has_support = any(self._placement_value(item, "relation") == "support" for item in usable)
        support = sum(self._placement_value(item, "relation") == "support" for item in interpretation["placements"])
        conflict = sum(self._placement_value(item, "relation") == "conflict" for item in interpretation["placements"])
        confidence = max(0, support * 2 - conflict)
        required_domains = set(task.get("required_domains", []))
        contributors = {self._placement_value(item, "player_id") for item in interpretation["placements"] if self._placement_value(item, "player_id")}
        contributor_target = int(combo.get("minimum_distinct_players", 1))
        missing_contributors = max(0, contributor_target - len(contributors))
        requirements = [
            {"key": "cards", "label": "证据数量", "current": len(cards), "target": int(task.get("required_card_count", 0)), "complete": len(cards) >= int(task.get("required_card_count", 0))},
            {"key": "domains", "label": "研究领域", "current": len(domains & required_domains), "target": len(required_domains), "complete": not missing_domains, "missing": missing_domains},
            {"key": "origins", "label": "证据来源", "current": len(origins & preferred_origins) if preferred_origins else len(origins), "target": origin_target, "complete": len(origins) >= origin_target and not missing_origins, "missing": missing_origins},
            {"key": "combos", "label": "组合证据卡", "current": len(tags & set(combo.get("required_combo_tags", []))), "target": len(combo.get("required_combo_tags", [])), "complete": not missing_tags, "missing": missing_tags},
            {"key": "contributors", "label": "共同参与", "current": len(contributors), "target": contributor_target, "complete": missing_contributors == 0, "missing": [f"还需要 {missing_contributors} 位不同同行者"] if missing_contributors else []},
        ]
        reason_parts = []
        if not has_support:
            reason_parts.append("还需要至少一件支持证据")
        if len(cards) < int(task.get("required_card_count", 0)):
            reason_parts.append(f"还需要 {int(task.get('required_card_count', 0)) - len(cards)} 件证据")
        if missing_domains:
            reason_parts.append("还需要补齐研究领域")
        if missing_origins:
            reason_parts.append("还需要不同来源的证据")
        if missing_tags:
            reason_parts.append("还需要完成关键组合互证")
        if missing_contributors:
            reason_parts.append(f"还需要 {missing_contributors} 位不同同行者参与")
        if not reason_parts:
            reason_parts.append("条件已经满足，可以完成研判")
        return InterpretationEvaluation.model_validate({
            "cards": len(cards), "cards_target": int(task.get("required_card_count", 0)),
            "domains": sorted(domains), "missing_domains": missing_domains,
            "origins": sorted(origins), "origins_target": origin_target, "missing_origins": missing_origins,
            "missing_tags": missing_tags, "has_support": has_support,
            "contributors": sorted(contributors), "contributors_target": contributor_target, "missing_contributors": missing_contributors,
            "support": support, "conflict": conflict, "pending": sum(self._placement_value(item, "relation") == "pending" for item in interpretation["placements"]),
            "confidence": confidence, "requirements": requirements, "reason": "；".join(reason_parts),
            "can_form": bool(has_support and len(cards) >= int(task.get("required_card_count", 0)) and not missing_domains and len(origins) >= origin_target and not missing_origins and not missing_tags and missing_contributors == 0),
        })

    def _interpretation_ready(self, task: dict[str, Any]) -> bool:
        return self._evaluate_interpretation(task)["can_form"]

    def _form_interpretation(self, state: GameState, player: PlayerState, site_id: str) -> None:
        task = state.tasks.get(self.content.sites.get(site_id, {}).get("active_task_id"))
        if player.location != site_id or not task or task["completed"] or not self._interpretation_ready(task):
            raise ValueError("interpretation_not_ready")
        interpretation = self._ensure_interpretation(task)
        if interpretation["formed"]:
            raise ValueError("interpretation_already_formed")
        interpretation["formed"] = True
        interpretation["confidence"] = self._evaluate_interpretation(task)["confidence"]

    def _choose_intervention(self, state: GameState, player: PlayerState, site_id: str, intervention: str) -> None:
        task = state.tasks.get(self.content.sites.get(site_id, {}).get("active_task_id"))
        if intervention not in {"act_now", "minimal", "record"} or player.location != site_id or not task or task["completed"]:
            raise ValueError("invalid_intervention")
        interpretation = self._ensure_interpretation(task)
        if not interpretation["formed"] or interpretation["intervention"]:
            raise ValueError("intervention_not_available")
        site = state.sites[site_id]
        reward = task.get("reward", {})
        confidence = int(interpretation.get("confidence", self._evaluate_interpretation(task)["confidence"]))
        interpretation["intervention"] = intervention
        task["completed"] = True
        domain = reward.get("domain")
        if domain and domain not in state.shared.completed_domains:
            state.shared.completed_domains.append(domain)
        if intervention == "act_now":
            state.shared.influence += 2
            state.shared.restoration_resource += int(reward.get("restoration_delta", 0))
            site.damage = max(0, site.damage - 1)
            if confidence <= 2:
                state.shared.weathering_track += 1
        elif intervention == "minimal":
            state.shared.influence += 1
            state.shared.weathering_track = max(0, state.shared.weathering_track - 1)
            site.damage = max(0, site.damage - 1)
        else:
            state.shared.research_clues += 3 if confidence <= 2 else 2
            state.shared.weathering_track = max(0, state.shared.weathering_track - 1)
        project = state.projects.get(site.active_project_id or "")
        if project and intervention != "record":
            self._advance_project(state, project, player.id, "choose_intervention")
        self._update_site(site)
        self._trigger_node_ability(state, player, site_id, trigger="task_completed")

    def _card_can_contribute(self, card: str, task: dict[str, Any]) -> bool:
        definition = self.content.cards[card]
        required_tags = set(task.get("combo_requirement", {}).get("required_combo_tags", []))
        return definition.get("domain") in task.get("required_domains", []) or bool(required_tags & set(definition.get("combo_tags", [])))

    def _task_complete(self, task: dict[str, Any]) -> bool:
        return bool(self._evaluate_interpretation(task)["can_form"])

    def _task_progress(self, task: dict[str, Any]) -> dict[str, Any]:
        evaluation = self._evaluate_interpretation(task)
        return {"requirements": evaluation["requirements"], "complete": evaluation["can_form"], "interpretation": evaluation}

    def _exchange(self, state: GameState, player: PlayerState, recipient_id: str, card: str) -> None:
        recipient = state.players.get(recipient_id)
        remote = player.flags.get("remote_exchange_player_id") == recipient_id
        free = bool(player.flags.pop("free_exchange", False) or player.flags.pop("exchange_discount", 0))
        if not recipient or (recipient.location != player.location and not remote) or card not in player.hand or len(recipient.hand) >= 3:
            raise ValueError("invalid_exchange")
        cost = 0 if free else self._event_action_cost(state, "exchange", 1)
        if player.ap < cost:
            raise ValueError("not_enough_ap")
        player.ap -= cost
        player.hand.remove(card)
        recipient.hand.append(card)
        if remote:
            player.flags.pop("remote_exchange_player_id", None)
        self._trigger_node_ability(state, player, player.location, trigger="after_exchange")

    def _play_card(self, state: GameState, player: PlayerState, card: str) -> None:
        if card not in player.hand:
            raise ValueError("card_not_in_hand")
        player.hand.remove(card)
        state.decks.setdefault("discard", []).append(card)
        self._effect(state, player, self.content.cards[card].get("effect", {}))
