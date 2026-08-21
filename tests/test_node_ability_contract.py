from backend.engine import GameEngine


def _site_with_effect(engine, effect_type):
    return next(
        site_id
        for site_id, site in engine.content.sites.items()
        if (site.get("node_ability") or {}).get("effect", {}).get("type") == effect_type
    )


def _state_at_ability(effect_type):
    engine = GameEngine()
    state = engine.new_game(f"node-{effect_type}", ["p1", "p2"], solo_mode=False)
    site_id = _site_with_effect(engine, effect_type)
    player = state.players["p1"]
    player.location = site_id
    state.shared.phase = "player_action"
    return engine, state, player, site_id


def test_restore_discount_is_consumed_by_the_next_repair():
    engine, state, player, site_id = _state_at_ability("restore_discount")
    site = state.sites[site_id]
    site.damage = 1
    state.shared.restoration_resource = 1
    engine._apply_node_effect(state, player, site_id, {"type": "restore_discount", "amount": 1})
    engine._restore(state, player, site_id)
    assert site.damage == 0
    assert state.shared.restoration_resource == 1
    assert player.flags.get("restore_discount") == 0


def test_exchange_discount_is_consumed_by_the_next_exchange():
    engine, state, player, site_id = _state_at_ability("exchange_discount")
    recipient = state.players["p2"]
    recipient.location = site_id
    card_id = next(iter(engine.content.cards))
    player.hand = [card_id]
    before_ap = player.ap
    engine._apply_node_effect(state, player, site_id, {"type": "exchange_discount", "amount": 1})
    engine._exchange(state, player, recipient.id, card_id)
    assert player.ap == before_ap
    assert card_id in recipient.hand
    assert not player.flags.get("exchange_discount")


def test_material_exchange_uses_declared_clue_and_resource_amounts():
    engine, state, player, site_id = _state_at_ability("clue_to_restoration")
    state.shared.research_clues = 4
    state.shared.restoration_resource = 0
    engine._apply_node_effect(
        state,
        player,
        site_id,
        {"type": "clue_to_restoration", "clues": 2, "restoration": 1},
    )
    assert state.shared.research_clues == 2
    assert state.shared.restoration_resource == 1


def test_route_action_discount_is_consumed_by_route_restoration():
    engine, state, player, site_id = _state_at_ability("route_action_discount")
    route = next(route for route in state.routes.values() if site_id in {route.from_site, route.to_site})
    route.status = "strained"
    route.risk = 2
    state.shared.research_clues = 1
    before_clues = state.shared.research_clues
    engine._apply_node_effect(state, player, site_id, {"type": "route_action_discount", "amount": 1})
    engine._restore_route(state, player, route.id)
    assert route.status == "restored"
    assert state.shared.research_clues == before_clues


def test_reserve_market_card_is_consumed_during_exploration():
    engine, state, player, site_id = _state_at_ability("reserve_market_card")
    player.ap = 3
    card_id = state.market[0]
    engine._apply_node_effect(state, player, site_id, {"type": "reserve_market_card"})
    engine._explore(state, player, card_id)
    assert state.shared.reserved_market_cards
    assert card_id in player.hand


def test_ignore_route_risk_reduces_the_next_move_cost_once():
    engine, state, player, site_id = _state_at_ability("ignore_route_risk")
    route = next(iter(state.routes.values()))
    player.location = route.from_site
    site_id = route.from_site
    route.status = "open"
    route.cost = 2
    route.risk = 1
    target = route.to_site if route.from_site == site_id else route.from_site
    before_ap = player.ap
    engine._apply_node_effect(state, player, site_id, {"type": "ignore_route_risk"})
    engine._move(state, player, target)
    assert player.ap == before_ap - 1
    assert not player.flags.get("ignore_route_risk")
