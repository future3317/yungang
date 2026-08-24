from __future__ import annotations

from copy import deepcopy
from typing import Any

from ..models import ActionOption, ActionType, GameState, SiteStatus


class PreviewMixin:
    def _preview_snapshot(self, state: GameState, req: dict[str, Any]) -> dict[str, int]:
        player = state.players.get(req.get("player_id"))
        site_id = req.get("target_site_id")
        if not site_id and req.get("action") in {ActionType.INTERPRET_EVIDENCE.value, ActionType.FORM_INTERPRETATION.value, ActionType.CHOOSE_INTERVENTION.value, ActionType.RESTORE.value, ActionType.USE_NODE_ABILITY.value}:
            site_id = player.location if player else None
        route_id = req.get("route_id")
        snapshot = {
            "ap": player.ap if player else 0,
            "research_clues": state.shared.research_clues,
            "restoration_resource": state.shared.restoration_resource,
            "weathering": state.shared.weathering_track,
            "influence": state.shared.influence,
            "route_connection_score": state.shared.route_connection_score,
        }
        if site_id in state.sites:
            snapshot["site_influence"] = state.sites[site_id].influence
            snapshot["damage"] = state.sites[site_id].damage
        if route_id in state.routes:
            snapshot["risk"] = state.routes[route_id].risk
        return snapshot

    def simulate_action(self, state: GameState, action: dict[str, Any]) -> dict[str, int]:
        """Run the production handler on a disposable copy and return its numeric state delta."""
        request = {
            "player_id": action.get("player_id") or state.shared.active_player_id,
            "action": action["type"],
            "target_id": action.get("target_id"),
            "target_site_id": action.get("target_site_id"),
            "card_id": action.get("card_id"),
            "recipient_id": action.get("recipient_id"),
            "route_id": action.get("route_id"),
            "upgrade_id": action.get("upgrade_id"),
            "target_ids": action.get("target_ids"),
            "_preview": True,
        }
        simulated = deepcopy(state)
        before = self._preview_snapshot(simulated, request)
        simulated = self.apply(simulated, request)
        after = self._preview_snapshot(simulated, request)
        return {key: after[key] - value for key, value in before.items() if isinstance(value, (int, float)) and after.get(key) != value}

    def _action_preview_delta(self, action: dict[str, Any], state: GameState | None = None) -> dict[str, int]:
        if state is None:
            return {}
        try:
            return self.simulate_action(state, action)
        except ValueError:
            return {}

    def _recommendation_for_option(self, option: dict[str, Any], state: GameState, active: Any, target: dict[str, Any] | None = None) -> tuple[int, str]:
        action_type = option["type"]
        candidate = target or option
        route_actions = {ActionType.SURVEY_ROUTE.value, ActionType.RESTORE_ROUTE.value, ActionType.ESTABLISH_CONNECTION.value}
        target_id = candidate.get("route_id") if action_type in route_actions else candidate.get("target_site_id") or candidate.get("target_id")
        target_route = state.routes.get(target_id) if target_id else None
        target_site = state.sites.get(target_id) if target_id else None
        target_name = self.content.sites.get(target_id, {}).get("name") if target_id else None
        if target_route:
            target_name = f"{self.content.sites.get(target_route.from_site, {}).get('name', target_route.from_site)}—{self.content.sites.get(target_route.to_site, {}).get('name', target_route.to_site)}"

        pressure = int((state.shared.weathering_track / max(1, state.shared.weathering_limit)) * 28)
        rounds_remaining = max(0, int(state.shared.max_rounds) - state.shared.turn + 1)
        time_pressure = max(0, 5 - rounds_remaining) * 7
        event_targets = set(state.shared.event_targets or [])
        if not event_targets and state.shared.event_instance:
            event_targets = set(state.shared.event_instance.get("revealed_targets", []))
        event_urgency = 18 if state.shared.current_event_id else 0
        task = state.tasks.get(self.content.sites.get(active.location, {}).get("active_task_id"), {})
        requirements = task.get("progress", {}).get("requirements", [])
        missing = sum(1 for item in requirements if not item.get("complete"))
        score = 8 + pressure + time_pressure + event_urgency
        reason = option.get("description", "执行一项可用行动。")

        target_project = next((project for project in state.projects.values() if project.status == "active" and project.site_id == target_id), None) if target_id else None
        project_gap = 0
        if target_project and target_project.stage_index < len(target_project.stages):
            stage = target_project.stages[target_project.stage_index]
            stage_id = stage.get("id", str(target_project.stage_index))
            project_gap = max(0, int(stage.get("required_progress", 1)) - int(target_project.stage_progress.get(stage_id, 0)))
            score += min(20, project_gap * 5)
        target_task_id = self.content.sites.get(target_id, {}).get("active_task_id") if target_id else None
        target_task = state.tasks.get(target_task_id, {}) if target_task_id else {}
        target_task_gap = sum(1 for item in target_task.get("progress", {}).get("requirements", []) if not item.get("complete"))
        if target_task_gap:
            score += min(16, target_task_gap * 4)

        role_action = self.content.roles.get(active.role_id, {}).get("ability", {}).get("action")
        role_fit = {"fine_repair": ActionType.RESTORE.value, "sprint_move": ActionType.MOVE.value, "view_select": ActionType.EXPLORE.value, "harmony_hint": ActionType.INTERPRET_EVIDENCE.value}
        role_fit_reason = ""
        if role_fit.get(role_action) == action_type:
            score += 14
            role_name = self.content.roles.get(active.role_id, {}).get("ability", {}).get("name")
            if role_name:
                role_fit_reason = f"当前角色的「{role_name}」正适合处理这类行动。"

        if action_type == ActionType.CHOOSE_INTERVENTION.value:
            score += 52
            reason = "研判已经完成，选择处理方式会直接推进当前地点任务。"
        elif action_type == ActionType.FORM_INTERPRETATION.value:
            score += 46
            reason = "研究台条件已经满足，现在完成研判不会再消耗行动点。"
        elif action_type == ActionType.INTERPRET_EVIDENCE.value:
            score += 28 + missing * 7
            reason = "这一步会填补当前委托的证据条件。"
        elif action_type == ActionType.EXPLORE.value:
            score += 22 + missing * 6
            card = self.content.cards.get(candidate.get("card_id"), {})
            if card.get("domain") in task.get("required_domains", []):
                score += 18
            if set(card.get("origin_tags", [])) & set(task.get("combo_requirement", {}).get("preferred_origins", [])):
                score += 10
            reason = f"推荐带回{card.get('name', '这张证据卡')}：它能补足当前地点任务的证据缺口。"
        elif action_type == ActionType.RESTORE.value:
            damage = target_site.damage if target_site else state.sites[active.location].damage
            score += int(32 * damage / max(1, target_site.max_damage if target_site else state.sites[active.location].max_damage))
            if target_id in event_targets:
                score += 18
            risk_text = "节点已接近关闭，必须优先稳住现场" if damage >= max(1, (target_site.max_damage if target_site else state.sites[active.location].max_damage) - 1) else "先降低节点损伤，避免事件结算扩大风险"
            reason = f"推荐修护{target_name or self.content.sites.get(active.location, {}).get('name', active.location)}：{risk_text}。"
        elif action_type in route_actions:
            risk = target_route.risk if target_route else 0
            score += risk * 12 + (18 if target_route and target_route.status == "blocked" else 0)
            if target_id in event_targets:
                score += 16
            reason = f"推荐处理{target_name or '这条路线'}：降低路线风险可以保留后续移动空间。"
        elif action_type == ActionType.MOVE.value:
            if target_site:
                score += int(24 * target_site.damage / max(1, target_site.max_damage))
                if target_site.id in event_targets:
                    score += 20
                target_task = self.content.sites.get(target_site.id, {}).get("active_task_id")
                if target_task and not state.tasks.get(target_task, {}).get("completed"):
                    score += 10
            movement_cost = int(candidate.get("cost", option.get("cost", {}).get("ap", 0)) or 0)
            score -= movement_cost * 8
            reason = f"推荐前往{target_name or '新的节点'}：这里的风险或地点任务缺口值得优先处理。"
        elif action_type == ActionType.USE_ACTION_CARD.value:
            score += 18 + (12 if target_id in event_targets else 0)
            reason = option.get("reason") or "策略牌适合在当前风险或目标缺口出现时使用。"
        elif action_type == ActionType.END_TURN.value:
            score = max(0, 10 - pressure)
            reason = "当前没有更高优先级的行动，结束行动让下一位同行者接手。"

        if role_fit_reason:
            reason = f"{reason} {role_fit_reason}"

        raw_cost = candidate.get("cost", option.get("cost", {}).get("ap", 0))
        cost = int(raw_cost.get("ap", 0) if isinstance(raw_cost, dict) else raw_cost or 0)
        score += 8 if cost == 0 else min(12, max(0, 18 - cost * 6))
        return max(0, min(100, int(score))), reason

    def _action_requirements(self, action_type: str, action: dict[str, Any], state: GameState | None = None, active: Any = None) -> list[str]:
        cost = action.get("cost", 0)
        if isinstance(cost, dict):
            cost = cost.get("ap", 0)
        requirements = [f"行动点至少 {int(cost)}"] if int(cost or 0) > 0 else []
        if not state or not active:
            return requirements
        site = state.sites.get(active.location)
        if action_type == ActionType.MOVE.value:
            requirements.append("目标节点开放，且路线保持通行")
        elif action_type == ActionType.EXPLORE.value:
            requirements.extend(["已抵达当前节点", "证据卡（手牌）未满（最多 3 张）", "公开市场仍有可取证据卡"])
        elif action_type == ActionType.INTERPRET_EVIDENCE.value:
            requirements.extend(["已抵达地点任务节点", "证据卡符合当前地点任务", "这件证据卡尚未归入研究台"])
        elif action_type == ActionType.FORM_INTERPRETATION.value:
            requirements.append("研究台的领域、来源和组合条件全部满足")
        elif action_type == ActionType.CHOOSE_INTERVENTION.value:
            requirements.append("当前研判已经完成，且尚未选择处理方式")
        elif action_type == ActionType.RESTORE.value:
            requirements.extend(["已抵达受损节点", "团队修护资源或个人补给至少 1 点"])
        elif action_type == ActionType.EXCHANGE.value:
            requirements.extend(["与同行者同处一处，或已获得远程交换权限", "对方证据卡未满"])
        elif action_type == ActionType.SURVEY_ROUTE.value:
            requirements.extend(["已抵达路线一端", "路线处于承压或阻断状态"])
        elif action_type == ActionType.RESTORE_ROUTE.value:
            requirements.extend(["已抵达路线一端", "路线处于承压或阻断状态", "研究点至少 1 点"])
        elif action_type == ActionType.ESTABLISH_CONNECTION.value:
            requirements.extend(["已抵达路线一端", "路线已经修护"])
        elif action_type == ActionType.PREPARE.value:
            requirements.append("当前有尚未结算的事件")
        elif action_type == ActionType.USE_SKILL.value:
            requirements.append("角色技能本回合尚未使用")
        elif action_type == ActionType.USE_NODE_ABILITY.value:
            requirements.append("当前地点能力本回合尚未使用")
        elif action_type == ActionType.USE_UPGRADE.value:
            requirements.append("该角色专长已解锁，且当前允许使用")
        elif action_type == ActionType.PLAY_CARD.value:
            requirements.append("证据卡中有这张文化牌，并确认放弃它的研究台用途")
        elif action_type == ActionType.USE_ACTION_CARD.value:
            requirements.append("这张策略牌当前处于可使用时机")
        elif action_type == ActionType.PLAN.value:
            requirements.append("本轮尚未为当前角色声明规划目标")
        elif action_type == ActionType.RESOLVE_EVENT.value:
            requirements.append("当前事件正在等待团队回应")
        elif action_type == ActionType.DISCARD.value:
            requirements.append("从当前证据卡中选择一件放下")
        elif action_type == ActionType.SELECT_MARKET_CARD.value:
            requirements.append("从当前展示的证据卡中选择一件")
        elif action_type == ActionType.SELECT_UPGRADE.value:
            requirements.append("选择一个已展示的角色专长")
        elif action_type == ActionType.END_TURN.value:
            requirements.append("可随时结束当前行动")
        if site and action_type == ActionType.RESTORE.value and site.status == SiteStatus.CLOSED:
            requirements.append("节点尚未关闭")
        return requirements

    def _build_action_options(self, actions: list[dict[str, Any]], state: GameState | None = None) -> list[ActionOption]:
        terminology = self.content.terminology.get("actions", {})
        descriptions = {
            ActionType.MOVE.value: "沿已显影的路线前往另一个开放节点。",
            ActionType.EXPLORE.value: "从公开市场取走一张证据卡，推进当前地点的研究。",
            ActionType.INTERPRET_EVIDENCE.value: "将一张证据卡归入支持、冲突或待确认，公开你的判断。",
            ActionType.FORM_INTERPRETATION.value: "根据已归位的证据卡完成当前研判，再决定如何行动。",
            ActionType.CHOOSE_INTERVENTION.value: "选择立即处理、最小干预或先记录，让研判真正改变现场。",
            ActionType.RESTORE.value: "消耗修护资源，降低当前地点的风化损伤。",
            ActionType.EXCHANGE.value: "把手中的证据卡交给同处的同行者。",
            ActionType.USE_SKILL.value: "使用当前角色的专长，改变这一回合的行动空间。",
            ActionType.PLAY_CARD.value: "立即使用一张证据卡的即时效果。",
            ActionType.USE_ACTION_CARD.value: "使用策略牌，并在需要时选择路线或同行者。",
            ActionType.SURVEY_ROUTE.value: "勘察受阻路线，降低风险并补充研究点。",
            ActionType.RESTORE_ROUTE.value: "消耗研究点，让受阻路线恢复通行。",
            ActionType.ESTABLISH_CONNECTION.value: "把已修护路线升级为稳定的区域连接。",
            ActionType.PREPARE.value: "提前准备当前事件，降低结算时的风化压力。",
            ActionType.PLAN.value: "为地点、路线或团队项目放置一枚协作标记。",
            ActionType.END_TURN.value: "结束当前角色的行动，把回合交给下一位同行者。",
            ActionType.END_PLANNING.value: "结算本轮协作标记，进入行动阶段。",
        }
        category_labels = {
            ActionType.USE_SKILL.value: "角色技能",
            ActionType.USE_NODE_ABILITY.value: "地点能力",
            ActionType.USE_UPGRADE.value: "角色专长",
            ActionType.USE_ACTION_CARD.value: "策略牌",
            ActionType.PLAY_CARD.value: "文化证据",
        }
        action_labels_by_type = {
            ActionType.USE_SKILL.value: "使用角色技能",
            ActionType.USE_NODE_ABILITY.value: "使用地点能力",
            ActionType.USE_UPGRADE.value: "使用角色专长",
            ActionType.USE_ACTION_CARD.value: "使用策略牌",
            ActionType.PLAY_CARD.value: "使用文化牌",
        }
        specific_types = set(category_labels)
        grouped = {}
        preview_cache = {}

        def preview(action: dict[str, Any]) -> dict[str, int]:
            if state is None:
                return {}
            key = repr(sorted((name, repr(value)) for name, value in action.items()))
            cache_key = (id(state), int(state.revision), key)
            if cache_key not in self._preview_cache:
                self._preview_cache[cache_key] = self._action_preview_delta(action, state)
                if len(self._preview_cache) > 2048:
                    state_id = id(state)
                    self._preview_cache = {item_key: value for item_key, value in self._preview_cache.items() if item_key[0] == state_id}
            preview_cache[key] = self._preview_cache[cache_key]
            return preview_cache[key]

        active = state.players.get(state.shared.active_player_id) if state else None
        for action in actions:
            action_type = action["type"]
            cost = int(action.get("cost", 0))
            group_key = action_type
            if action.get("card_id") and action_type in {ActionType.PLAY_CARD.value, ActionType.USE_ACTION_CARD.value}:
                group_key = f"{action_type}:{action['card_id']}"
            option = grouped.setdefault(group_key, {
                "id": f"action:{group_key}",
                "type": action_type,
                "label": action.get("label", action_type),
                "category_label": category_labels.get(action_type, "基础行动"),
                "action_label": action_labels_by_type.get(action_type, terminology.get(action_type, {}).get("name", action_type)),
                "description": descriptions.get(action_type, "执行一项可用行动。"),
                "cost": {"ap": cost},
                "enabled": action.get("enabled", True),
                "disabled_reason": action.get("disabled_reason"),
                "targets": [],
                "preview_delta": preview(action),
                "confirmation": f"确认{action.get('label', action_type)}？",
                "payload": {},
                "requirements": self._action_requirements(action_type, action, state, active),
                "recommendation_score": 0,
                "reason": "",
            })
            term = terminology.get(action_type, {})
            if action_type not in specific_types:
                option["label"] = term.get("name") or option["label"]
            option["action_label"] = action_labels_by_type.get(action_type, term.get("name") or option["action_label"])
            option["description"] = term.get("description") or option["description"]
            if action_type == ActionType.USE_ACTION_CARD.value and action.get("card_id"):
                card_definition = self.content.action_cards.get(action["card_id"], {})
                option["label"] = card_definition.get("name") or option["label"]
                option["action_label"] = "使用策略牌"
                option["description"] = card_definition.get("description") or option["description"]
                timing = self._action_card_timing_label(card_definition)
                best_use = card_definition.get("best_use") or "在合适目标上使用，改变本回合的风险或资源。"
                limitations = card_definition.get("limitations") or "使用前请确认目标和行动点。"
                option["reason"] = f"时机：{timing}。最适合：{best_use}。限制：{limitations}"
                option["payload"].update({key: card_definition.get(key) for key in ("timing", "effect", "best_use", "limitations", "combo_tags") if card_definition.get(key) is not None})
                option["confirmation"] = f"确认使用策略牌“{card_definition.get('name', '策略牌')}”吗？"
            elif action_type == ActionType.PLAY_CARD.value and action.get("card_id"):
                card_definition = self.content.cards.get(action["card_id"], {})
                option["label"] = card_definition.get("name") or option["label"]
                option["description"] = card_definition.get("instant_use_text") or option["description"]
                option["confirmation"] = f"确认发动文化牌“{card_definition.get('name', '文化牌')}”的即时效果吗？"
            elif action_type in {ActionType.USE_SKILL.value, ActionType.USE_NODE_ABILITY.value, ActionType.USE_UPGRADE.value}:
                option["label"] = action.get("label") or option["label"]
            target = action.get("target_id") or action.get("target_site_id") or action.get("route_id") or action.get("recipient_id") or action.get("upgrade_id")
            if action_type != ActionType.USE_ACTION_CARD.value:
                target = target or action.get("card_id")
            payload = {key: value for key, value in action.items() if value is not None}
            if action_type == ActionType.PLAY_CARD.value and action.get("card_id"):
                card_definition = self.content.cards.get(action["card_id"], {})
                payload.update({key: card_definition.get(key) for key in ("evidence_use_text", "instant_use_text", "effect") if card_definition.get(key) is not None})
            option["payload"].update(payload)
            if target:
                target_key = str(target)
                if action_type == ActionType.EXCHANGE.value:
                    target_key = f"{target_key}:{action.get('card_id', '')}"
                option["targets"].append({"id": target_key, "label": action.get("label", str(target)), "preview_delta": preview(action), "payload": payload, "recommendation_score": 0, "reason": ""})
            else:
                option["payload"] = payload
        if state is not None and not state.pending_choice and not state.shared.outcome:
            present = set(grouped)
            active = state.players.get(state.shared.active_player_id)
            if active:
                disabled = {}
                if state.shared.phase == "player_action":
                    if ActionType.MOVE.value not in present:
                        disabled[ActionType.MOVE.value] = "当前没有可达且开放的节点。"
                    if ActionType.EXPLORE.value not in present:
                        disabled[ActionType.EXPLORE.value] = "当前没有可取证据卡，或证据卡已满。"
                    if ActionType.INTERPRET_EVIDENCE.value not in present and ActionType.FORM_INTERPRETATION.value not in present and ActionType.CHOOSE_INTERVENTION.value not in present:
                        disabled[ActionType.INTERPRET_EVIDENCE.value] = "先寻访一张适合当前问题的证据卡，再开始研判。"
                    if ActionType.RESTORE.value not in present:
                        disabled[ActionType.RESTORE.value] = "当前地点暂时不需要修护，或修护资源不足。"
                    if ActionType.EXCHANGE.value not in present:
                        disabled[ActionType.EXCHANGE.value] = "当前地点没有可以交换的同行者。"
                    if ActionType.USE_SKILL.value not in present:
                        disabled[ActionType.USE_SKILL.value] = "角色专长本回合已使用，或行动点不足。"
                for action_type, reason in disabled.items():
                    grouped[action_type] = {
                        "id": f"action:{action_type}", "type": action_type, "label": terminology.get(action_type, {}).get("name", "当前行动"),
                        "category_label": category_labels.get(action_type, "基础行动"), "action_label": action_labels_by_type.get(action_type, terminology.get(action_type, {}).get("name", action_type)),
                        "description": terminology.get(action_type, {}).get("description", descriptions.get(action_type, "执行一项可用行动。")), "cost": {"ap": 0},
                        "enabled": False, "disabled_reason": reason, "targets": [],
                        "preview_delta": {}, "confirmation": "", "payload": {}, "requirements": self._action_requirements(action_type, {"type": action_type}, state, active), "recommendation_score": 0, "reason": reason,
                    }
        for option in grouped.values():
            if option["enabled"]:
                active = state.players.get(state.shared.active_player_id) if state else None
                if active:
                    if option["targets"]:
                        scored_targets = []
                        for target in option["targets"]:
                            candidate = dict(target["payload"])
                            candidate["type"] = option["type"]
                            candidate["cost"] = option["cost"].get("ap", 0)
                            target_score, target_reason = self._recommendation_for_option(option, state, active, candidate)
                            target["recommendation_score"] = target_score
                            target["reason"] = target_reason
                            scored_targets.append((target_score, target_reason))
                        option["recommendation_score"], generated_reason = max(scored_targets, key=lambda item: item[0])
                    else:
                        option["recommendation_score"], generated_reason = self._recommendation_for_option(option, state, active)
                    option["reason"] = option["reason"] or generated_reason
                else:
                    option["recommendation_score"] = 0
                    option["reason"] = option["reason"] or option["description"]
        return [ActionOption.model_validate(option) for option in grouped.values()]
