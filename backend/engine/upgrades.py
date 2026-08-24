from __future__ import annotations

from typing import Any

from ..mechanisms import NODE_EFFECT_HANDLERS, TRIGGER_HANDLERS
from ..models import GameState, PlayerState


class UpgradesMixin:
    def _use_node_ability(self, state: GameState, player: PlayerState, site_id: str) -> None:
        if site_id != player.location or site_id not in self.content.sites:
            raise ValueError("invalid_node_ability_target")
        ability = self.content.sites[site_id].get("node_ability", {})
        key = f"{site_id}:use_node_ability:{state.shared.turn}"
        if ability.get("trigger") != "once_per_round" or key in state.shared.node_ability_uses:
            raise ValueError("node_ability_unavailable")
        if player.ap < int(ability.get("cost", 1)):
            raise ValueError("not_enough_ap")
        player.ap -= int(ability.get("cost", 1))
        effect = ability.get("effect", {})
        if effect.get("type") == "inspect_archive":
            cards = list(reversed(state.decks.get("archive", [])))[: int(effect.get("amount", 2))]
            if not cards:
                raise ValueError("archive_empty")
            state.pending_choice = {"kind": "archive_select", "site_id": site_id, "cards": cards}
        else:
            self._apply_node_effect(state, player, site_id, effect)
        state.shared.node_ability_uses.append(key)

    def _trigger_node_ability(self, state: GameState, player: PlayerState, site_id: str, card_id: str | None = None, trigger: str | None = None) -> None:
        ability = self.content.sites.get(site_id, {}).get("node_ability")
        if not ability or not trigger or not self._ability_matches_event(ability.get("trigger"), trigger):
            return
        if trigger not in TRIGGER_HANDLERS:
            raise ValueError(f"unsupported_trigger:{trigger}")
        ability_trigger = ability.get("trigger")
        frequency = ability.get("frequency", "round")
        key = f"{site_id}:{ability_trigger}:{state.shared.turn if frequency != 'game' else 'game'}"
        if key in state.shared.node_ability_uses:
            return
        card = self.content.cards.get(card_id, {}) if card_id else {}
        condition = ability.get("condition", {})
        if condition.get("domain") and card.get("domain") != condition["domain"]:
            return
        if ability_trigger == "first_new_domain_contribution_per_round" and card.get("domain") in state.shared.completed_domains:
            return
        if ability_trigger == "after_architecture_contribution" and card.get("domain") != "architecture":
            return
        if ability_trigger == "statue_architecture_combo" and card.get("domain") not in {"statue", "architecture"}:
            return
        if ability_trigger == "statue_architecture_combo":
            domains = {self.content.cards.get(item.get("card_id"), {}).get("domain") for item in state.sites[site_id].contributions} | {card.get("domain")}
            if not {"statue", "architecture"}.issubset(domains):
                return
        if ability_trigger == "once_per_round_pattern_contribution" and card.get("domain") != "pattern":
            return
        if ability_trigger == "frontier_trade_combo" and card.get("domain") not in {"frontier", "trade"}:
            return
        if ability_trigger == "frontier_trade_combo":
            domains = {self.content.cards.get(item.get("card_id"), {}).get("domain") for item in state.sites[site_id].contributions} | {card.get("domain")}
            if not {"frontier", "trade"}.issubset(domains):
                return
        if trigger == "second_distinct_player_action_per_round":
            count = len({item.get("player_id") for item in state.sites[site_id].contributions if item.get("player_id")})
            if count < 2:
                return
        self._apply_node_effect(state, player, site_id, ability.get("effect", {}))
        state.shared.node_ability_uses.append(key)

    @staticmethod
    def _ability_matches_event(ability_trigger: str | None, event: str) -> bool:
        if ability_trigger == event:
            return True
        return event == "after_interpret_evidence" and ability_trigger in {"first_new_domain_contribution_per_round", "after_architecture_contribution", "statue_architecture_combo", "once_per_round_pattern_contribution", "frontier_trade_combo"}

    def _apply_node_effect(self, state: GameState, player: PlayerState, site_id: str, effect: dict[str, Any]) -> None:
        self._dispatch_effect(NODE_EFFECT_HANDLERS, state, player, effect, site_id)

    def _use_upgrade(self, state: GameState, player: PlayerState, upgrade_id: str) -> None:
        if upgrade_id != "archive_retrieve" or not self._has_upgrade_effect(player, "archive_retrieve") or player.flags.get("archive_retrieve_round") == state.shared.turn:
            raise ValueError("upgrade_unavailable")
        if player.ap < 1:
            raise ValueError("not_enough_ap")
        cards = [card for card in reversed(state.decks.get("archive", [])) if self.content.cards.get(card, {}).get("domain") in {self.content.cards[item].get("domain") for item in player.hand}]
        if not cards:
            raise ValueError("archive_retrieve_needs_matching_hand")
        player.ap -= 1
        state.pending_choice = {"kind": "archive_retrieve", "cards": cards[:3]}

    def _offer_upgrade(self, state: GameState, player_id: str) -> None:
        player = state.players[player_id]
        options = [self.content.role_upgrades[item] for item in self.content.roles[player.role_id].get("upgrade_ids", []) if item in self.content.role_upgrades and item not in player.upgrades]
        if options and not state.pending_choice:
            state.pending_choice = {"kind": "role_upgrade", "options": options}

    def _upgrade_effect(self, state: GameState, player: PlayerState, effect: dict[str, Any]) -> None:
        if not effect.get("type"):
            return
        normalized = dict(effect)
        if "amount" not in normalized and "value" in normalized:
            normalized["amount"] = normalized["value"]
        player.flags.setdefault("upgrade_effects", []).append(normalized)

    def _has_upgrade_effect(self, player: PlayerState, effect_type: str) -> bool:
        return any(item.get("type") == effect_type for item in player.flags.get("upgrade_effects", []))

    def _apply_round_start_upgrades(self, state: GameState, player: PlayerState) -> None:
        # Per-round upgrades are consumed by their action handlers. Keeping this
        # hook explicit makes the turn boundary the single place for future
        # reset behavior without carrying a dead compatibility branch.
        return None

    def _skill(self, state: GameState, player: PlayerState) -> None:
        role = self.content.roles[player.role_id]
        ability = role["ability"]
        cost = ability.get("ap_cost", 1)
        if player.skill_used or player.ap < cost:
            raise ValueError("skill_unavailable")
        if ability["action"] == "fine_repair":
            site = state.sites[player.location]
            if site.damage <= 0 or state.shared.restoration_resource < 1:
                raise ValueError("nothing_to_repair")
            player.ap -= cost
            state.shared.restoration_resource -= 1
            site.damage = max(0, site.damage - 2)
            self._update_site(site)
            if self._has_upgrade_effect(player, "fine_repair_weathering_bonus") and site.damage > 0:
                state.shared.weathering_track = max(0, state.shared.weathering_track - 1)
        elif ability["action"] == "harmony_hint":
            player.ap -= cost
            player.flags["harmony_next_contribution"] = True
            player.flags["harmony_event_reduction"] = True
        elif ability["action"] == "sprint_move":
            player.ap -= cost
            player.flags["sprint_move"] = True
            player.flags["sprint_survey_available"] = self._has_upgrade_effect(player, "sprint_survey")
        elif ability["action"] == "view_select":
            player.ap -= cost
            count = 4 if self._has_upgrade_effect(player, "market_look_bonus") else 3
            preview = list(state.market)
            preview.extend(state.decks["culture"][: max(0, count - len(preview))])
            state.pending_choice = {"kind": "view_select", "cards": preview[:count]}
            player.skill_used = True
            return
        player.skill_used = True
