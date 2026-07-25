from .content import Content
from .models import GameState, PlayerState, SiteState

class GameEngine:
    def __init__(self, content=None): self.content = content or Content()

    def new_game(self, session_id="demo", player_ids=None):
        ids = player_ids or ["p1", "p2"]
        players = {pid: PlayerState(id=pid, name=f"玩家 {pid[1:]}", role_id=list(self.content.roles)[i % len(self.content.roles)]) for i, pid in enumerate(ids)}
        sites = {sid: SiteState(id=sid, durability=max(0, s.get("max_damage", 3) - s.get("start_damage", 0)), max_durability=s.get("max_damage", 3), domains=s.get("domains", [])) for sid, s in self.content.sites.items()}
        return self.refresh(GameState(session_id=session_id, players=players, sites=sites, decks={"culture": list(self.content.cards), "events": list(self.content.events)}))

    def refresh(self, state):
        player = state.players[state.shared.active_player_id]
        actions = [{"type":"end_turn", "label":"结束回合"}]
        if player.ap > 0:
            actions += [{"type":"explore", "label":"探索当前节点"}, {"type":"restore", "label":"修复遗产", "target_id":player.location}]
            for route in self.content.routes:
                if route["from"] == player.location and player.ap >= route["cost"]:
                    actions.append({"type":"move", "label":f"前往 {self.content.sites[route['to']].get('name', route['to'])}", "target_id":route["to"], "cost":route["cost"]})
            if state.sites[player.location].discovered: actions.append({"type":"contribute", "label":"贡献影响力", "target_id":player.location})
        actions += [{"type":"play_card", "label":f"使用 {self.content.cards[c]['name']}", "card_id":c} for c in player.hand]
        state.legal_actions = actions
        return state

    def apply(self, state, req):
        pid, action = req["player_id"], req["action"]
        if pid != state.shared.active_player_id: raise ValueError("not active player")
        player, target = state.players[pid], req.get("target_id")
        if action == "move":
            route = next((r for r in self.content.routes if r["from"] == player.location and r["to"] == target), None)
            if not route or player.ap < route["cost"]: raise ValueError("invalid route or AP")
            player.location, player.ap = target, player.ap - route["cost"]
        elif action == "explore":
            if player.ap < 1: raise ValueError("not enough AP")
            player.ap -= 1; site = state.sites[player.location]; site.discovered = True; player.influence += 1
            if state.decks["culture"]: player.hand.append(state.decks["culture"].pop(0))
        elif action == "contribute":
            if player.ap < 1: raise ValueError("not enough AP")
            player.ap -= 1; amount = 1 + int(player.flags.pop("next_contribute_bonus", 0)); state.sites[player.location].influence += amount; state.shared.influence += amount
        elif action == "restore":
            if player.ap < 1 or target != player.location: raise ValueError("invalid restore")
            player.ap -= 1; site = state.sites[target]; site.durability = min(site.max_durability, site.durability + 1)
        elif action == "play_card":
            card = req.get("card_id")
            if card not in player.hand: raise ValueError("card not in hand")
            player.hand.remove(card); self._effect(state, player, self.content.cards[card]["effect"])
        elif action == "end_turn":
            player.ap = player.max_ap; ids = list(state.players); state.shared.active_player_id = ids[(ids.index(pid) + 1) % len(ids)]; state.shared.turn += 1
            if state.decks["events"]: self._effect(state, player, self.content.events[state.decks["events"].pop(0)]["effect"])
        else: raise ValueError("unknown action")
        state.revision += 1
        return self.refresh(state)

    def _effect(self, state, player, effect):
        typ = effect["type"]
        if typ == "gain_ap": player.ap = min(player.max_ap, player.ap + effect["amount"])
        elif typ == "next_contribute_bonus": player.flags["next_contribute_bonus"] = effect["amount"]
        elif typ == "free_move": player.flags["free_move"] = True
        elif typ == "restore_and_influence": player.durability += effect.get("durability", 0); player.influence += effect.get("influence", 0)
        elif typ == "threat": state.shared.threat += effect["amount"]
        elif typ == "all_influence":
            for p in state.players.values(): p.influence += effect["amount"]
        elif typ == "restore_site":
            site = state.sites[player.location]; site.durability = min(site.max_durability, site.durability + effect["amount"])
