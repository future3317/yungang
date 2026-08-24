from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from ..content import Content
from ..domain.rng import DeterministicRng
from ..models import (
    FeedbackChange,
    GameState,
    JournalEntry,
    PlayerState,
    ProjectState,
    RouteState,
)


class BaseEngineMixin:
    def __init__(self, content: Content | None = None):
        self.content = content or Content()
        self._preview_cache: dict[tuple[int, int, str], dict[str, int]] = {}

    def _record_journal(
        self,
        state: GameState,
        action: str,
        player_id: str,
        message: str,
        changes: list[FeedbackChange] | None = None,
        target: dict[str, Any] | None = None,
    ) -> None:
        kind = "event" if action in {"resolve_event", "prepare"} else "project" if action in {"interpret_evidence", "form_interpretation", "choose_intervention", "restore", "restore_route", "establish_connection"} else "action"
        state.shared.journal.append(JournalEntry(
            id=f"journal-{state.revision + len(state.shared.journal) + 1}",
            round=state.shared.turn,
            type=kind,
            message=message,
            effects=[change.model_dump() for change in (changes or [])],
            created_at=datetime.now(timezone.utc).isoformat(),
            player_id=player_id,
            target=target,
        ))
        del state.shared.journal[:-120]

    def _remember_request(self, state: GameState, request_id: str | None) -> None:
        if not request_id:
            return
        if request_id not in state.processed_request_ids:
            state.processed_request_ids.append(request_id)
            del state.processed_request_ids[:-200]

    def _journal_message(self, action: str, target: str | None, req: dict[str, Any]) -> str:
        labels = {
            "move": "移动", "explore": "寻访证据", "interpret_evidence": "研判证据",
            "form_interpretation": "完成研判", "choose_intervention": "选择处理方式", "restore": "修护节点",
            "exchange": "交换证据", "use_skill": "使用角色技能", "play_card": "使用文化牌",
            "use_action_card": "使用策略牌", "survey_route": "勘察路线", "restore_route": "修护路线",
            "establish_connection": "建立区域连接", "prepare": "准备事件", "end_turn": "结束回合",
            "plan": "放置规划标记", "end_planning": "开始行动",
        }
        return labels.get(action, "完成一项行动")

    def _journal_target(self, state: GameState, target: str | None, action: str | None = None, req: dict[str, Any] | None = None) -> dict[str, Any] | None:
        req = req or {}
        if action in {"survey_route", "restore_route", "establish_connection"}:
            target = req.get("route_id") or target
        if action in {"play_card", "use_action_card"} and req.get("card_id"):
            card_id = str(req["card_id"])
            card = self.content.cards.get(card_id) or self.content.action_cards.get(card_id) or {}
            return {"kind": "card", "id": card_id, "label": card.get("name", "策略牌")}
        if action == "exchange" and req.get("target_id") in state.players:
            player_id = str(req["target_id"])
            return {"kind": "player", "id": player_id, "label": state.players[player_id].name}
        if not target:
            return None
        if target in state.routes:
            route = state.routes[target]
            source = self.content.sites.get(route.from_site, {}).get("name", route.from_site)
            destination = self.content.sites.get(route.to_site, {}).get("name", route.to_site)
            return {"kind": "route", "id": target, "label": route.name or f"{source}—{destination}"}
        if target in state.sites:
            return {"kind": "site", "id": target, "label": self.content.sites.get(target, {}).get("name", target)}
        if target in state.projects:
            return {"kind": "project", "id": target, "label": self.content.projects.get(target, {}).get("name", target)}
        if target in state.players:
            return {"kind": "player", "id": target, "label": state.players[target].name}
        return {"kind": "unknown", "id": target}

    @staticmethod
    def _feedback_message(action: str) -> str:
        return {
            "move": "已抵达新地点，新的证据卡与风险已经显影。",
            "explore": "已取得证据卡，可用于当前地点的互证。",
            "interpret_evidence": "证据卡已归入研究台，关系判断已记录。",
            "form_interpretation": "当前研判已经完成，可以选择如何回应。",
            "choose_intervention": "处理方式已经写入遗产网络，现场与胜利目标已更新。",
            "use_action_card": "策略牌已结算，资源、路线与旅程记录已经更新。",
            "end_turn": "本角色行动结束，旅程正在交接给下一位同行者。",
            "restore": "节点修护完成，地点状态已经更新。",
            "survey_route": "路线勘察完成，路线信息已经写入旅程记录。",
            "restore_route": "路线修护完成，通行风险已经降低。",
            "establish_connection": "区域连接已经建立，团队路线目标向前推进。",
            "exchange": "证据已交给指定同行者。",
            "prepare": "已提前准备本轮事件，结算时会按准备效果处理。",
            "use_skill": "角色技能已生效，具体变化已列在行动反馈中。",
            "use_node_ability": "地点能力已生效，节点信息已经更新。",
            "use_upgrade": "角色专长已生效，能力变化已经写入当前旅程。",
            "plan": "团队意图已记录，后续行动可以获得协作收益。",
            "end_planning": "团队规划已结束，现在进入角色行动。",
        }.get(action, "这项行动已经完成，具体变化见下方反馈。")

    @staticmethod
    def _metric_snapshot(state: GameState, player_id: str, site_id: str | None = None, route_id: str | None = None) -> dict[str, int]:
        player = state.players.get(player_id)
        snapshot = {
            "ap": player.ap if player else 0,
            "research_clues": state.shared.research_clues,
            "restoration_resource": state.shared.restoration_resource,
            "weathering": state.shared.weathering_track,
            "influence": state.shared.influence,
        }
        if site_id and site_id in state.sites:
            snapshot["site_damage"] = state.sites[site_id].damage
            snapshot["site_influence"] = state.sites[site_id].influence
        if route_id and route_id in state.routes:
            snapshot["route_risk"] = state.routes[route_id].risk
        return snapshot

    @staticmethod
    def _feedback_changes(before: dict[str, int], after: dict[str, int]) -> list[FeedbackChange]:
        labels = {
            "ap": "行动点", "research_clues": "研究点", "restoration_resource": "修护资源",
            "weathering": "风化压力", "influence": "共同影响", "site_damage": "节点损伤",
            "site_influence": "地点影响", "route_risk": "路线风险",
        }
        return [FeedbackChange(metric=key, label=labels.get(key, key), before=before[key], after=after[key], delta=after[key] - before[key]) for key in before if after.get(key) != before[key]]

    def _draw_action_card(self, state: GameState, player: PlayerState) -> bool:
        if player.flags.get("action_card_draw_turn") == state.shared.turn:
            return False
        if not state.decks.get("action"):
            player.flags["action_card_draw_turn"] = state.shared.turn
            return False
        if len(player.action_hand) >= 3:
            card = state.decks["action"].pop(0)
            state.pending_choice = {
                "kind": "discard",
                "player_id": player.id,
                "next_action_card_id": card,
                "options": [{"id": item, "label": f"弃置 {self.content.action_cards.get(item, {}).get('name', item)}"} for item in player.action_hand],
            }
            state.shared.phase = "pending_choice"
            return False
        player.action_hand.append(state.decks["action"].pop(0))
        player.flags["action_card_draw_turn"] = state.shared.turn
        return True

    def _refill_market(self, state: GameState) -> None:
        while len(state.market) < 3 and state.decks["culture"]:
            state.market.append(state.decks["culture"].pop(0))

    def _release_reserved_market_cards(self, state: GameState) -> None:
        while state.shared.reserved_market_cards:
            card = state.shared.reserved_market_cards.pop(0)
            if card not in state.market:
                state.market.insert(0, card)
            if len(state.market) > 3:
                state.decks["culture"].append(state.market.pop())

    def _event_deck_for_scenario(self, scenario: dict[str, Any], rng: DeterministicRng) -> list[str]:
        source = [event_id for event_id in scenario.get("event_deck", self.content.events) if event_id in self.content.events]
        ordered, used = [], set()
        for chain in self.content.event_chains:
            if chain.get("id") in scenario.get("event_chain_ids", []):
                for event_id in chain.get("event_ids", []):
                    if event_id in source and event_id not in used:
                        ordered.append(event_id)
                        used.add(event_id)
        remainder = [event_id for event_id in source if event_id not in used]
        rng.shuffle(remainder)
        return ordered + remainder

    def _ensure_runtime_state(self, state: GameState) -> None:
        if not state.routes:
            state.routes = {
                route["id"]: RouteState(
                    id=route["id"],
                    from_site=route["from"],
                    to_site=route["to"],
                    cost=route.get("cost", 1),
                    status=route.get("status", "open"),
                    tags=route.get("tags", []),
                )
                for route in self.content.routes
                if route["from"] in state.sites and route["to"] in state.sites
            }
        if not state.projects:
            state.projects = {
                project_id: ProjectState(id=project_id, site_id=project["site_id"], name=project["name"], stages=project.get("stages", []))
                for project_id, project in self.content.projects.items()
            }
        for site in state.sites.values():
            if not site.active_project_id:
                project = next((item for item in state.projects.values() if item.site_id == site.id), None)
                site.active_project_id = project.id if project else None
        if not state.shared.scenario_round_baseline:
            state.shared.scenario_round_baseline = self._capture_scenario_round_baseline(state)

    @staticmethod
    def _capture_scenario_round_baseline(state: GameState) -> dict[str, Any]:
        return {
            "project_completed_stages": {project.id: len(project.completed_stages) for project in state.projects.values()},
            "route_statuses": {route.id: getattr(route.status, "value", route.status) for route in state.routes.values()},
        }

    def _scenario_round_context(self, state: GameState, snapshot: dict[str, Any] | None = None) -> dict[str, Any]:
        baseline = state.shared.scenario_round_baseline or self._capture_scenario_round_baseline(state)
        project_baseline = baseline.get("project_completed_stages", {})
        route_baseline = baseline.get("route_statuses", {})
        completed_project_stages = sum(
            max(0, len(project.completed_stages) - int(project_baseline.get(project.id, 0)))
            for project in state.projects.values()
        )
        restored_routes = sum(
            1
            for route in state.routes.values()
            if getattr(route.status, "value", route.status) in {"restored", "illuminated"}
            and route_baseline.get(route.id) not in {"restored", "illuminated"}
        )
        return {
            **(snapshot or {}),
            "completed_project_stages": completed_project_stages,
            "restored_routes": restored_routes,
        }
