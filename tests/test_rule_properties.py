from hypothesis import given, strategies as st

from backend.engine.engine import GameEngine


@given(st.integers(min_value=0, max_value=1))
def test_route_repair_cost_matches_one_time_discount(discount: int):
    engine = GameEngine()
    state = engine.new_game("property-route", ["p1"], solo_mode=False)
    player = state.players["p1"]
    route = next(route for route in state.routes.values() if player.location in {route.from_site, route.to_site})
    route.status = "strained"
    state.shared.research_clues = 1
    player.flags["route_action_discount"] = discount

    engine._restore_route(state, player, route.id)

    assert route.status == "restored"
    assert state.shared.research_clues == 1 - (0 if discount else 1)
    assert "route_action_discount" not in player.flags
