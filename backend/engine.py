from collections import deque
from .content import Content
from .models import GameOutcome, GameState, PlayerState, SiteState, SiteStatus

class GameEngine:
    def __init__(self, content=None):
        self.content = content or Content()

    def new_game(self, session_id="demo", player_ids=None, difficulty_id="normal"):
        ids = player_ids or ["p1", "p2"]
        if not 2 <= len(ids) <= 4: raise ValueError("game needs 2 to 4 players")
        difficulty = self.content.difficulty.get(difficulty_id, self.content.difficulty.get("normal", {}))
        role_ids = list(self.content.roles)
        players = {}
        for index, pid in enumerate(ids):
            role_id = role_ids[index % len(role_ids)]; role = self.content.roles[role_id]
            players[pid] = PlayerState(id=pid, name=role["name"], role_id=role_id, location=role.get("start_site_id", "yungang"))
        sites = {}
        for sid, content in self.content.sites.items():
            damage = content.get("start_damage", 0); maximum = content.get("max_damage", 3)
            sites[sid] = SiteState(id=sid, damage=damage, max_damage=maximum, durability=max(0, maximum - damage), max_durability=maximum, domains=content.get("domains", []))
        tasks = {tid: {**task, "contributed_cards": [], "completed": False} for tid, task in self.content.tasks.items()}
        state = GameState(session_id=session_id, difficulty_id=difficulty_id, players=players, sites=sites, tasks=tasks,
                          shared={"max_rounds":difficulty.get("max_rounds", 8), "active_player_id":ids[0], "player_order":ids, "restoration_resource":difficulty.get("restoration_resource", 6)},
                          decks={"culture":list(self.content.cards) * 3, "events":list(self.content.events)})
        for site in state.sites.values(): self._update_site(site)
        self._refill_market(state)
        self._reveal_event(state)
        state.shared.log.append("旅程开始：先观察事件预告，再决定本回合的节点行动。")
        return self.refresh(state)

    def refresh(self, state):
        if state.shared.outcome:
            state.legal_actions = []
            return state
        active = state.players[state.shared.active_player_id]
        if state.pending_choice:
            kind = state.pending_choice.get("kind")
            if kind == "event":
                state.legal_actions = [{"type":"resolve_event","target_id":option["id"],"label":option["label"]} for option in state.pending_choice["options"]]
            elif kind == "view_select":
                state.legal_actions = [{"type":"select_market_card","card_id":card,"label":f"选择 {self.content.cards[card]['name']}"} for card in state.pending_choice["cards"]]
            elif kind == "discard":
                state.legal_actions = [{"type":"discard","card_id":card,"label":f"弃置 {self.content.cards[card]['name']}"} for card in active.hand]
            return state
        actions = [{"type":"end_turn","label":"结束回合"}]
        site = state.sites[active.location]
        if site.status != "closed" and active.ap > 0:
            for route in self.content.routes:
                if route["from"] == active.location and self._open(state, route["to"]):
                    actions.append({"type":"move","target_id":route["to"],"label":f"前往 {self.content.sites[route['to']]['name']}","cost":0 if active.flags.get("free_move") else route["cost"]})
            if active.flags.get("sprint_move"):
                for target in self._reachable(state, active.location, 2):
                    if target != active.location and not any(a.get("target_id") == target for a in actions): actions.append({"type":"move","target_id":target,"label":f"疾行至 {self.content.sites[target]['name']}","cost":1})
            if active.ap >= 1 and len(active.hand) < 3:
                actions += [{"type":"explore","target_id":active.location,"card_id":card,"label":f"探索并选择 {self.content.cards[card]['name']}","cost":1} for card in state.market]
            if active.ap >= 1 and state.shared.restoration_resource > 0 and site.damage > 0:
                actions.append({"type":"restore","target_id":active.location,"label":"共同修护当前节点","cost":1})
            task = state.tasks.get(self.content.sites[active.location].get("active_task_id"))
            if active.ap >= 1 and task and not task["completed"]:
                actions += [{"type":"contribute","target_id":active.location,"card_id":card,"label":f"贡献 {self.content.cards[card]['name']}","cost":1} for card in active.hand if self._card_can_contribute(card, task)]
            actions += [{"type":"play_card","card_id":card,"label":f"使用 {self.content.cards[card]['name']}"} for card in active.hand]
            for other_id, other in state.players.items():
                if other_id != active.id and other.location == active.location:
                    actions += [{"type":"exchange","target_id":other_id,"card_id":card,"label":f"交给 {other.name}：{self.content.cards[card]['name']}","cost":1} for card in active.hand]
        role = self.content.roles[active.role_id]
        if active.ap >= role.get("ability", {}).get("ap_cost", 1) and not active.skill_used:
            actions.append({"type":"use_skill","label":role["ability"]["name"],"skill":role["ability"]["action"],"cost":role["ability"].get("ap_cost", 1)})
        state.legal_actions = actions
        return state

    def apply(self, state, req):
        if state.shared.outcome: raise ValueError("game is over")
        if state.pending_choice: return self._resolve_choice(state, req)
        pid, action = req["player_id"], req["action"]
        if pid != state.shared.active_player_id: raise ValueError("not active player")
        player = state.players[pid]; target = req.get("target_site_id") or req.get("target_id")
        if action == "move": self._move(state, player, target)
        elif action == "explore": self._explore(state, player, req.get("card_id"))
        elif action == "contribute": self._contribute(state, player, target, req.get("card_id"))
        elif action == "restore": self._restore(state, player, target)
        elif action == "exchange": self._exchange(state, player, target, req.get("card_id"))
        elif action == "use_skill": self._skill(state, player)
        elif action == "play_card": self._play_card(state, player, req.get("card_id"))
        elif action == "end_turn": self._end_turn(state, player)
        else: raise ValueError("unknown action")
        state.revision += 1
        self._check_outcome(state)
        return self.refresh(state)

    def _move(self, state, player, target):
        routes = [r for r in self.content.routes if r["from"] == player.location and r["to"] == target]
        if player.flags.get("sprint_move") and target in self._reachable(state, player.location, 2): routes = routes or [{"cost":1}]
        if not routes or not self._open(state, target): raise ValueError("invalid route")
        cost = 0 if player.flags.pop("free_move", False) else routes[0]["cost"]
        if player.flags.pop("sprint_move", False): cost = 1
        if player.ap < cost: raise ValueError("not enough AP")
        player.ap -= cost; player.location = target
        state.shared.log.append(f"{player.name} 抵达 {self.content.sites[target]['name']}。")

    def _explore(self, state, player, card):
        if player.ap < 1 or card not in state.market or len(player.hand) >= 3: raise ValueError("invalid explore")
        player.ap -= 1; player.hand.append(card); state.market.remove(card); self._refill_market(state); state.sites[player.location].discovered = True
        state.shared.log.append(f"{player.name} 在 {self.content.sites[player.location]['name']} 发现了 {self.content.cards[card]['name']}。")

    def _contribute(self, state, player, site_id, card):
        task = state.tasks.get(self.content.sites[site_id].get("active_task_id"))
        if player.ap < 1 or player.location != site_id or not task or task["completed"] or card not in player.hand or not self._card_can_contribute(card, task): raise ValueError("invalid contribution")
        player.ap -= 1; player.hand.remove(card); player.contributions += 1
        site = state.sites[site_id]; site.contributions.append({"player_id":player.id,"card_id":card,"origin_tags":self.content.cards[card].get("origin_tags",[])})
        task["contributed_cards"].append(card)
        if player.flags.pop("harmony_active", False): task["harmony_bonus"] = True
        site.influence += 1; state.shared.influence += 1
        if self._task_complete(task):
            task["completed"] = True; domain = task["reward"]["domain"]
            if domain not in state.shared.completed_domains: state.shared.completed_domains.append(domain)
            state.shared.influence += 1; state.shared.restoration_resource += task["reward"].get("restoration_delta", 0); site.damage = max(0, site.damage - task["reward"].get("restoration_delta", 1)); self._update_site(site)
            state.shared.log.append(f"任务完成：{task['name']}。{task['culture_explanation']}")
        else: state.shared.log.append(f"{player.name} 为 {task['name']} 贡献了证据。")

    def _restore(self, state, player, site_id):
        if player.ap < 1 or player.location != site_id or state.shared.restoration_resource < 1: raise ValueError("invalid restore")
        site = state.sites[site_id]
        if site.damage <= 0 or site.status == "closed": raise ValueError("site does not need restoration")
        player.ap -= 1; state.shared.restoration_resource -= 1; site.damage -= 1; self._update_site(site); state.shared.log.append(f"{player.name} 修复了 {self.content.sites[site_id]['name']} 的一处损伤。")

    def _exchange(self, state, player, recipient_id, card):
        recipient = state.players.get(recipient_id)
        if player.ap < 1 or not recipient or recipient.location != player.location or card not in player.hand or len(recipient.hand) >= 3: raise ValueError("invalid exchange")
        player.ap -= 1; player.hand.remove(card); recipient.hand.append(card); state.shared.log.append(f"{player.name} 将 {self.content.cards[card]['name']} 交给了 {recipient.name}。")

    def _skill(self, state, player):
        role = self.content.roles[player.role_id]; ability = role["ability"]; cost = ability.get("ap_cost", 1)
        if player.skill_used or player.ap < cost: raise ValueError("skill unavailable")
        action = ability["action"]
        if action == "fine_repair":
            site = state.sites[player.location]
            if site.damage <= 0 or state.shared.restoration_resource < 1: raise ValueError("nothing to repair")
            player.ap -= cost; state.shared.restoration_resource -= 1; site.damage = max(0, site.damage - 2); self._update_site(site)
        elif action == "harmony_hint": player.ap -= cost; player.flags["harmony_active"] = True
        elif action == "sprint_move": player.ap -= cost; player.flags["sprint_move"] = True
        elif action == "view_select":
            player.ap -= cost; state.pending_choice = {"kind":"view_select","cards":state.market[:3]}; player.skill_used = True; return
        player.skill_used = True; state.shared.log.append(f"{player.name} 使用技能：{ability['name']}。")

    def _play_card(self, state, player, card):
        if card not in player.hand: raise ValueError("card not in hand")
        player.hand.remove(card); self._effect(state, player, self.content.cards[card].get("effect", {}))

    def _effect(self, state, player, effect):
        typ = effect.get("type")
        if typ == "gain_ap": player.ap = min(player.max_ap, player.ap + effect.get("amount", 1))
        elif typ == "next_contribute_bonus": player.flags["next_contribute_bonus"] = effect.get("amount", 1)
        elif typ == "free_move": player.flags["free_move"] = True
        elif typ == "restore_and_influence": state.shared.restoration_resource += effect.get("resource", 1); player.influence += effect.get("influence", 1)
        elif typ == "reduce_threat": state.shared.threat = max(0, state.shared.threat - effect.get("amount", 1))
        elif typ == "influence": state.shared.influence += effect.get("amount", 1)

    def _end_turn(self, state, player):
        player.ap = player.max_ap; player.skill_used = False; player.flags.pop("harmony_active", None)
        order = state.shared.player_order; index = order.index(player.id); last = index == len(order) - 1
        state.shared.active_player_id = order[0] if last else order[index + 1]
        if last:
            state.shared.turn += 1; self._settle_event(state)
            if not state.pending_choice: self._reveal_event(state)
            state.shared.log.append(f"第 {state.shared.turn} 回合开始。")

    def _settle_event(self, state):
        event_id = state.shared.current_event_id
        if not event_id: return
        event = self.content.events[event_id]
        if event_id == "route_blocked":
            state.pending_choice = {"kind":"event","event_id":event_id,"options":[{"id":"mitigate","label":"消耗 1 修复资源，缓和道路阻断"},{"id":"accept","label":"接受阻断，威胁上升 1"}]}
            return
        self._event_effect(state, event.get("effect", {})); state.shared.log.append(f"事件结算：{event['name']}。")

    def _resolve_choice(self, state, req):
        action = req["action"]
        choice = req.get("target_id")
        if state.pending_choice["kind"] == "event":
            if action != "resolve_event" or choice not in {"mitigate", "accept"}: raise ValueError("invalid event choice")
            if choice == "mitigate":
                if state.shared.restoration_resource < 1: raise ValueError("not enough restoration resource")
                state.shared.restoration_resource -= 1; state.shared.log.append("团队用修复资源缓和了道路阻断。")
            else: state.shared.threat += 1; state.shared.log.append("团队接受道路阻断，威胁上升。")
            state.pending_choice = None; self._reveal_event(state)
        elif state.pending_choice["kind"] == "view_select":
            player = state.players[state.shared.active_player_id]; card = req.get("card_id")
            if action != "select_market_card" or card not in state.pending_choice["cards"]: raise ValueError("invalid market choice")
            player.hand.append(card); state.market.remove(card); self._refill_market(state); state.pending_choice = None; state.shared.log.append(f"{player.name} 通过博览选择了 {self.content.cards[card]['name']}。")
        elif state.pending_choice["kind"] == "discard":
            player = state.players[state.shared.active_player_id]; card = req.get("card_id")
            if action != "discard" or card not in player.hand: raise ValueError("invalid discard")
            player.hand.remove(card); state.pending_choice = None
        state.revision += 1; self._check_outcome(state); return self.refresh(state)

    def _event_effect(self, state, effect):
        typ = effect.get("type")
        if typ == "damage_open_sites":
            for site in [s for s in state.sites.values() if s.status != "closed"][:2]: site.damage = min(site.max_damage, site.damage + effect.get("amount", 1)); self._update_site(site)
        elif typ == "all_influence":
            for player in state.players.values(): player.influence += effect.get("amount", 1)
        elif typ == "gain_resource": state.shared.restoration_resource += effect.get("amount", 1)
        elif typ == "threat": state.shared.threat += effect.get("amount", 1)

    def _reveal_event(self, state):
        if not state.decks["events"]: state.shared.current_event_id = None; return
        state.shared.current_event_id = state.decks["events"].pop(0)

    def _refill_market(self, state):
        while len(state.market) < 3 and state.decks["culture"]: state.market.append(state.decks["culture"].pop(0))

    def _card_can_contribute(self, card, task):
        data = self.content.cards[card]
        return data.get("domain") in task.get("required_domains", [])

    def _task_complete(self, task):
        cards = [self.content.cards[c] for c in task["contributed_cards"]]
        domains = {c.get("domain") for c in cards}; origins = {origin for c in cards for origin in c.get("origin_tags", [])}
        if task.get("harmony_bonus"): origins.add("harmony")
        return len(cards) >= task["required_card_count"] and len(origins) >= task["required_origin_diversity"] and set(task["required_domains"]).issubset(domains)

    def _reachable(self, state, start, hops):
        found={start}; queue=deque([(start,0)])
        while queue:
            current, distance=queue.popleft()
            if distance >= hops: continue
            for route in self.content.routes:
                if route["from"] == current and route["to"] not in found and self._open(state, route["to"]): found.add(route["to"]); queue.append((route["to"],distance+1))
        return found

    def _open(self, state, site_id): return state.sites[site_id].status != "closed"

    def _update_site(self, site):
        site.status = SiteStatus.CLOSED if site.damage >= site.max_damage else SiteStatus.AT_RISK if site.damage else SiteStatus.STABLE
        site.durability = max(0, site.max_damage - site.damage); site.max_durability = site.max_damage

    def _check_outcome(self, state):
        closed = sum(site.status == "closed" for site in state.sites.values())
        if len(state.shared.completed_domains) >= 5 and state.shared.influence >= 10 and closed < 2 and state.shared.turn <= state.shared.max_rounds: state.shared.outcome = GameOutcome.VICTORY
        elif closed >= 2 or state.shared.turn > state.shared.max_rounds: state.shared.outcome = GameOutcome.DEFEAT
