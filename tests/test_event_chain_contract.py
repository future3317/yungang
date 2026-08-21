from backend.content import Content
from backend.engine import GameEngine
from backend.mechanisms import ACTION_CARD_EFFECT_HANDLERS, NODE_EFFECT_HANDLERS


def test_event_chain_preserves_previous_event_before_revealing_next():
    engine = GameEngine()
    state = engine.new_game("event-chain-contract", ["p1"], scenario_id="sand_and_stone", solo_mode=False)
    state.shared.player_order = ["p1"]
    state.shared.active_player_id = "p1"
    state.shared.current_event_id = "sandstorm"
    state.shared.event_targets = ["yungang"]
    state.shared.event_instance = {"event_id": "sandstorm", "revealed_targets": ["yungang"], "resolution": [], "status": "forecast"}
    engine._end_turn(state, state.players["p1"])
    assert state.shared.round_summary["event_id"] == "sandstorm"
    assert state.shared.round_summary["event_targets"] == ["yungang"]
    assert any(item.get("event_id") == "sandstorm" for item in state.shared.event_history)
    assert state.shared.current_event_id != "sandstorm"


def test_all_action_cards_and_node_abilities_have_registered_effects():
    content = Content()
    for card in content.action_cards.values():
        effect_type = card.get("effect", {}).get("type")
        assert effect_type in ACTION_CARD_EFFECT_HANDLERS, card["id"]
    for site in content.sites.values():
        ability = site.get("node_ability") or {}
        if ability:
            assert ability.get("effect", {}).get("type") in NODE_EFFECT_HANDLERS, site["id"]
