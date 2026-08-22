from fastapi.testclient import TestClient

from backend.app import app, engine, repo


client = TestClient(app)

def create_for_test(session, **options):
    created = client.post('/api/games', json={'player_ids': ['p1'], 'difficulty_id': 'normal', **options})
    assert created.status_code == 200
    source = repo.get(created.json()['session_id'])
    source.session_id = session
    repo.save(source)
    return client.get(f'/api/games/{session}').json()



def test_full_hand_requires_discard_before_exploration():
    session = "release-discard-test"
    state = create_for_test(session, difficulty_id="guided")
    stored = repo.get(session)
    player = stored.players[stored.shared.active_player_id]
    player.hand = stored.market[:3]
    player.ap = 3
    engine.refresh(stored)
    repo.save(stored)
    state = client.get(f"/api/games/{session}").json()
    card = next(target["payload"]["card_id"] for option in state["action_options"] if option["type"] == "explore" for target in option["targets"])
    pending = client.post(f"/api/games/{session}/actions", json={"player_id": "p1", "action": "explore", "card_id": card, "expected_revision": state["revision"]})
    assert pending.status_code == 200
    pending_state = pending.json()
    assert pending_state["pending_choice"]["kind"] == "discard"
    discard_id = pending_state["pending_choice"]["options"][0]["id"]
    explored = client.post(f"/api/games/{session}/actions", json={"player_id": "p1", "action": "discard", "card_id": discard_id, "expected_revision": pending_state["revision"]})
    assert explored.status_code == 200
    assert card in explored.json()["players"]["p1"]["hand"]


def test_action_card_costs_ap_and_applies_declared_route_effect():
    state = create_for_test("action-card-cost")
    stored = repo.get("action-card-cost")
    player = stored.players[stored.shared.active_player_id]
    player.action_hand = ["action_01"]
    stored.decks["action"] = ["action_02"]
    route = next(route for route in stored.routes.values() if player.location in {route.from_site, route.to_site})
    route.status = "strained"
    route.risk = 2
    repo.save(stored)
    state = client.get("/api/games/action-card-cost").json()
    pending = client.post("/api/games/action-card-cost/actions", json={"player_id": "p1", "action": "use_action_card", "card_id": "action_01", "expected_revision": state["revision"]}).json()
    assert pending["players"]["p1"]["ap"] == 3
    target = pending["pending_choice"]["options"][0]["id"]
    resolved = client.post("/api/games/action-card-cost/actions", json={"player_id": "p1", "action": "use_action_card", "card_id": "action_01", "target_id": target, "expected_revision": pending["revision"]}).json()
    assert resolved["players"]["p1"]["ap"] == 2
    assert resolved["routes"][target]["risk"] == 1
    assert resolved["shared"]["research_clues"] == 1
    assert "action_01" not in resolved["players"]["p1"]["action_hand"]
    assert resolved["players"]["p1"]["action_hand"] == []


def test_culture_card_action_option_exposes_its_declared_immediate_effect():
    state = engine.new_game("culture-card-preview", ["p1"], solo_mode=True)
    card_id = next(iter(engine.content.cards))
    state.players["p1"].hand = [card_id]
    state.players["p1"].max_ap = 4
    state.players["p1"].ap = 3
    card = engine.content.cards[card_id]
    engine.refresh(state)

    option = next(item for item in state.action_options if item.type == "play_card" and item.label == card["name"])

    assert option.description == card["instant_use_text"]
    assert option.payload["instant_use_text"] == card["instant_use_text"]
    assert option.targets[0].preview_delta


def test_full_action_hand_requires_discard_before_round_draw():
    state = engine.new_game("action-card-draw", ["p1"], solo_mode=False)
    player = state.players["p1"]
    player.action_hand = ["action_01", "action_02", "action_03"]
    state.decks["action"] = ["action_04"]
    state.shared.turn = 2
    engine._draw_action_card(state, player)
    assert state.pending_choice["kind"] == "discard"
    assert state.pending_choice["next_action_card_id"] == "action_04"
    engine._resolve_choice(state, {"action": "discard", "card_id": "action_01"})
    assert player.action_hand == ["action_02", "action_03", "action_04"]
    assert "action_01" in state.decks["action_discard"]


def test_pingcheng_artisan_upgrade_fine_repair_weathering_bonus():
    state = engine.new_game("upgrade-fine", ["p1"])
    player = state.players["p1"]
    site = state.sites[player.location]
    site.damage = 3
    state.shared.restoration_resource = 1
    state.shared.weathering_track = 2
    engine._upgrade_effect(state, player, {"type": "fine_repair_weathering_bonus", "value": 1})
    engine._skill(state, player)
    assert site.damage == 1
    assert state.shared.weathering_track == 1


def test_pingcheng_artisan_upgrade_project_restore_discount_is_once_per_round():
    state = engine.new_game("upgrade-restore", ["p1"])
    player = state.players["p1"]
    site = state.sites[player.location]
    site.damage = 2
    state.shared.restoration_resource = 1
    engine._upgrade_effect(state, player, {"type": "project_restore_discount", "value": 1})
    engine._restore(state, player, site.id)
    assert state.shared.restoration_resource == 1
    engine._restore(state, player, site.id)
    assert state.shared.restoration_resource == 0


def test_western_dancer_upgrade_adds_origin_and_combo_tags():
    state = engine.new_game("upgrade-harmony", ["p1"])
    player = state.players["p1"]
    player.role_id = "western_dancer"
    task = state.tasks[engine.content.sites[player.location]["active_task_id"]]
    card = next(card for card in engine.content.cards if engine._card_can_contribute(card, task))
    player.hand = [card]
    player.flags["harmony_active"] = True
    engine._upgrade_effect(state, player, {"type": "harmony_origin_bonus", "value": 1})
    engine._interpret_evidence(state, player, player.location, card, "support")
    record = state.sites[player.location].contributions[-1]
    assert "harmony_origin" in record["origin_tags"]
    assert "cross_origin" in record["combo_tags"]


def test_contribution_closes_a_satisfied_task_and_updates_heritage_state():
    """The vertical slice ends in a real state transition, not only a UI message."""
    state = engine.new_game("task-closure", ["p1"])
    player = state.players["p1"]
    site = state.sites[player.location]
    task = state.tasks[engine.content.sites[player.location]["active_task_id"]]
    card = next(card_id for card_id, definition in engine.content.cards.items() if definition.get("domain") in task["required_domains"])
    task["required_card_count"] = 1
    task["required_origin_diversity"] = 1
    task["required_domains"] = [engine.content.cards[card]["domain"]]
    task["combo_requirement"] = {}
    player.hand = [card]
    site.damage = 1
    before_influence = state.shared.influence
    before_resource = state.shared.restoration_resource

    engine.apply(state, {"player_id": player.id, "action": "interpret_evidence", "target_site_id": player.location, "target_id": "support", "card_id": card})
    engine.apply(state, {"player_id": player.id, "action": "form_interpretation", "target_id": player.location})
    engine.apply(state, {"player_id": player.id, "action": "choose_intervention", "target_site_id": player.location, "target_id": "act_now"})

    assert task["completed"] is True
    assert task["contributed_cards"] == [card]
    assert state.shared.influence == before_influence + 2
    assert state.shared.restoration_resource == before_resource + task["reward"].get("restoration_delta", 0)
    assert site.damage == 0


def test_interpretation_path_requires_a_judgement_before_intervention():
    state = engine.new_game("interpretation-path", ["p1"])
    player = state.players["p1"]
    site = state.sites[player.location]
    task = state.tasks[engine.content.sites[player.location]["active_task_id"]]
    card = next(card_id for card_id, definition in engine.content.cards.items() if definition.get("domain") in task["required_domains"])
    task["required_card_count"] = 1
    task["required_origin_diversity"] = 1
    task["required_domains"] = [engine.content.cards[card]["domain"]]
    task["combo_requirement"] = {}
    player.hand = [card]
    player.ap = 2

    state = engine.apply(state, {"player_id": player.id, "action": "interpret_evidence", "target_site_id": player.location, "target_id": "support", "card_id": card})
    assert task["interpretation"]["formed"] is False
    assert task["interpretation"]["placements"][0]["relation"] == "support"
    assert engine._interpretation_ready(task) is True

    state = engine.apply(state, {"player_id": player.id, "action": "form_interpretation", "target_id": player.location})
    state = engine.apply(state, {"player_id": player.id, "action": "choose_intervention", "target_site_id": player.location, "target_id": "record"})

    assert task["completed"] is True
    assert task["interpretation"]["intervention"] == "record"
    assert state.shared.research_clues >= 2


def test_low_confidence_immediate_intervention_increases_weathering():
    state = engine.new_game("low-confidence-intervention", ["p1"])
    player = state.players["p1"]
    site = state.sites[player.location]
    task = state.tasks[engine.content.sites[player.location]["active_task_id"]]
    card = next(card_id for card_id, definition in engine.content.cards.items() if definition.get("domain") in task["required_domains"])
    task["required_card_count"] = 1
    task["required_origin_diversity"] = 1
    task["required_domains"] = [engine.content.cards[card]["domain"]]
    task["combo_requirement"] = {}
    player.hand = [card]
    site.damage = 1
    before_weathering = state.shared.weathering_track

    engine.apply(state, {"player_id": player.id, "action": "interpret_evidence", "target_site_id": player.location, "target_id": "support", "card_id": card})
    engine.apply(state, {"player_id": player.id, "action": "form_interpretation", "target_id": player.location})
    assert task["interpretation"]["confidence"] == 2
    engine.apply(state, {"player_id": player.id, "action": "choose_intervention", "target_site_id": player.location, "target_id": "act_now"})

    assert state.shared.weathering_track == before_weathering + 1


def test_low_confidence_recording_grants_extra_research_value():
    state = engine.new_game("low-confidence-record", ["p1"])
    player = state.players["p1"]
    task = state.tasks[engine.content.sites[player.location]["active_task_id"]]
    card = next(card_id for card_id, definition in engine.content.cards.items() if definition.get("domain") in task["required_domains"])
    task["required_card_count"] = 1
    task["required_origin_diversity"] = 1
    task["required_domains"] = [engine.content.cards[card]["domain"]]
    task["combo_requirement"] = {}
    player.hand = [card]
    before_clues = state.shared.research_clues

    engine.apply(state, {"player_id": player.id, "action": "interpret_evidence", "target_site_id": player.location, "target_id": "support", "card_id": card})
    engine.apply(state, {"player_id": player.id, "action": "form_interpretation", "target_id": player.location})
    engine.apply(state, {"player_id": player.id, "action": "choose_intervention", "target_site_id": player.location, "target_id": "record"})

    assert state.shared.research_clues == before_clues + 3


def test_conflict_is_counted_once_in_immediate_intervention_penalty():
    state = engine.new_game("confidence-conflict", ["p1"])
    player = state.players["p1"]
    task = state.tasks[engine.content.sites[player.location]["active_task_id"]]
    first_domain = task["required_domains"][0]
    cards = [card_id for card_id, definition in engine.content.cards.items() if definition.get("domain") == first_domain][:2]
    assert len(cards) == 2
    task["required_card_count"] = 1
    task["required_origin_diversity"] = 1
    task["required_domains"] = [engine.content.cards[cards[0]]["domain"]]
    task["combo_requirement"] = {}
    player.hand = list(cards)
    engine.apply(state, {"player_id": player.id, "action": "interpret_evidence", "target_site_id": player.location, "target_id": "support", "card_id": cards[0]})
    engine.apply(state, {"player_id": player.id, "action": "interpret_evidence", "target_site_id": player.location, "target_id": "conflict", "card_id": cards[1]})
    engine.apply(state, {"player_id": player.id, "action": "form_interpretation", "target_id": player.location})
    assert task["interpretation"]["confidence"] == 1
    before_weathering = state.shared.weathering_track
    engine.apply(state, {"player_id": player.id, "action": "choose_intervention", "target_site_id": player.location, "target_id": "act_now"})
    assert state.shared.weathering_track == before_weathering + 1


def test_direct_contribution_path_is_not_available():
    assert not hasattr(engine, "_contribute")


def test_player_learning_chain_has_real_state_transitions():
    """The core teaching loop must change the real game state at every step."""
    state = engine.new_game("learning-chain", ["p1"], solo_mode=True)
    player = state.players["p1"]
    player.max_ap = 8
    player.ap = 8
    player.action_hand = ["action_08"]

    before_ap = player.ap
    engine._use_action_card(state, player, "action_08")
    assert player.ap == before_ap - 1
    assert "action_08" not in player.action_hand
    assert "action_08" in state.decks["action_discard"]

    engine.refresh(state)
    move_option = next(option for option in state.action_options if option.type == "move" and option.targets)
    move_target = move_option.targets[0].id
    engine.apply(state, {"player_id": player.id, "action": "move", "target_id": move_target})
    assert player.location == move_target

    engine.refresh(state)
    explore_option = next(option for option in state.action_options if option.type == "explore" and option.targets)
    explore_target = explore_option.targets[0]
    card_id = explore_target.payload["card_id"]
    engine.apply(state, {"player_id": player.id, "action": "explore", "target_id": player.location, "card_id": card_id})
    assert card_id in player.hand
    assert state.shared.research_clues >= 1

    site = state.sites[player.location]
    task = state.tasks[engine.content.sites[player.location]["active_task_id"]]
    card = engine.content.cards[card_id]
    task["required_card_count"] = 1
    task["required_origin_diversity"] = 1
    task["required_domains"] = [card["domain"]]
    task["combo_requirement"] = {}
    engine.apply(state, {"player_id": player.id, "action": "interpret_evidence", "target_site_id": player.location, "target_id": "support", "card_id": card_id})
    engine.apply(state, {"player_id": player.id, "action": "form_interpretation", "target_id": player.location})
    before_influence = state.shared.influence
    before_damage = site.damage
    engine.apply(state, {"player_id": player.id, "action": "choose_intervention", "target_site_id": player.location, "target_id": "minimal"})

    assert task["completed"] is True
    assert task["interpretation"]["formed"] is True
    assert task["interpretation"]["intervention"] == "minimal"
    assert state.shared.influence == before_influence + 1
    assert site.damage == max(0, before_damage - 1)


def test_learning_chain_closes_two_player_round_and_keeps_summary():
    state = engine.new_game("learning-chain-round", ["p1", "p2"], solo_mode=False)
    active = state.players[state.shared.active_player_id]
    active.ap = 0
    engine.apply(state, {"player_id": active.id, "action": "end_turn"})
    next_player = state.players[state.shared.active_player_id]
    next_player.ap = 0
    engine.apply(state, {"player_id": next_player.id, "action": "end_turn"})

    summary = state.shared.round_summary
    assert state.shared.turn == 2
    assert summary["round"] == 1
    assert summary["event_id"] is not None
    assert summary.before is not None and summary.after is not None
    assert isinstance(summary.event_resolution, list)


def test_western_dancer_upgrade_rewards_cross_origin_contribution_with_clue():
    state = engine.new_game("upgrade-clue", ["p1"])
    player = state.players["p1"]
    task = state.tasks[engine.content.sites[player.location]["active_task_id"]]
    card = next(card for card in engine.content.cards if engine._card_can_contribute(card, task))
    task["contributed_cards"] = [next(iter(engine.content.cards))]
    task["contribution_records"] = [{"player_id": "p2", "card_id": next(iter(engine.content.cards)), "relation": "support", "origin_tags": ["earlier_origin"], "combo_tags": []}]
    player.hand = [card]
    engine._upgrade_effect(state, player, {"type": "post_contribution_clue", "value": 1})
    before = state.shared.research_clues
    engine._interpret_evidence(state, player, player.location, card, "support")
    assert state.shared.research_clues == before + 1


def test_grassland_rider_upgrade_makes_sprint_survey_free():
    state = engine.new_game("upgrade-sprint", ["p1"])
    player = state.players["p1"]
    route = next(route for route in state.routes.values() if player.location in {route.from_site, route.to_site})
    route.status = "strained"
    player.flags["sprint_survey_available"] = True
    engine._upgrade_effect(state, player, {"type": "sprint_survey", "value": 1})
    before = player.ap
    engine._survey_route(state, player, route.id)
    assert player.ap == before


def test_grassland_rider_upgrade_discounts_first_route_repair():
    state = engine.new_game("upgrade-route", ["p1"])
    player = state.players["p1"]
    route = next(route for route in state.routes.values() if player.location in {route.from_site, route.to_site})
    route.status = "strained"
    state.shared.research_clues = 0
    engine._upgrade_effect(state, player, {"type": "route_action_discount", "value": 1})
    engine._restore_route(state, player, route.id)
    assert route.status == "restored"
    assert state.shared.research_clues == 0


def test_central_scribe_upgrade_views_and_reserves_an_extra_market_card():
    state = engine.new_game("upgrade-market", ["p1"])
    player = state.players["p1"]
    player.role_id = "central_scribe"
    engine._upgrade_effect(state, player, {"type": "market_look_bonus", "value": 1})
    engine._skill(state, player)
    assert state.pending_choice["kind"] == "view_select"
    assert len(state.pending_choice["cards"]) == 4
    selected = state.pending_choice["cards"][0]
    engine._resolve_choice(state, {"action": "select_market_card", "card_id": selected})
    assert state.shared.reserved_market_cards


def test_central_scribe_upgrade_retrieves_matching_archive_evidence():
    state = engine.new_game("upgrade-archive", ["p1"])
    player = state.players["p1"]
    hand_card = next(iter(engine.content.cards))
    replacement = next(card for card in engine.content.cards if card != hand_card and engine.content.cards[card].get("domain") == engine.content.cards[hand_card].get("domain"))
    player.hand = [hand_card]
    state.decks["archive"] = [replacement]
    engine._upgrade_effect(state, player, {"type": "archive_retrieve", "value": 1})
    engine._use_upgrade(state, player, "archive_retrieve")
    engine._resolve_choice(state, {"action": "select_market_card", "card_id": replacement})
    assert replacement in player.hand
    assert hand_card in state.decks["archive"]
