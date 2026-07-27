from fastapi.testclient import TestClient

from backend.app import app, engine, repo


client = TestClient(app)


def test_full_hand_requires_discard_before_exploration():
    session = "release-discard-test"
    state = client.post(f"/api/games/{session}", json={"player_ids": ["p1"], "difficulty_id": "guided"}).json()
    stored = repo.get(session)
    player = stored.players[stored.shared.active_player_id]
    player.hand = stored.market[:3]
    player.ap = 3
    engine.refresh(stored)
    repo.save(stored)
    state = client.get(f"/api/games/{session}").json()
    card = next(item["card_id"] for item in state["legal_actions"] if item["type"] == "explore")
    pending = client.post(f"/api/games/{session}/actions", json={"player_id": "p1", "action": "explore", "card_id": card, "expected_revision": state["revision"]})
    assert pending.status_code == 200
    pending_state = pending.json()
    assert pending_state["pending_choice"]["kind"] == "discard"
    discard_id = pending_state["pending_choice"]["options"][0]["id"]
    explored = client.post(f"/api/games/{session}/actions", json={"player_id": "p1", "action": "discard", "card_id": discard_id, "expected_revision": pending_state["revision"]})
    assert explored.status_code == 200
    assert card in explored.json()["players"]["p1"]["hand"]


def test_action_card_costs_ap_and_applies_declared_route_effect():
    state = client.post("/api/games/action-card-cost", json={"player_ids": ["p1"]}).json()
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
    assert len(resolved["players"]["p1"]["action_hand"]) == 1


def test_pingcheng_artisan_upgrade_fine_repair_threat_bonus():
    state = engine.new_game("upgrade-fine", ["p1"])
    player = state.players["p1"]
    site = state.sites[player.location]
    site.damage = 3
    state.shared.restoration_resource = 1
    state.shared.threat = 2
    engine._upgrade_effect(state, player, {"type": "fine_repair_threat_bonus", "value": 1})
    engine._skill(state, player)
    assert site.damage == 1
    assert state.shared.threat == 1


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
    engine._contribute(state, player, player.location, card)
    record = state.sites[player.location].contributions[-1]
    assert "harmony_origin" in record["origin_tags"]
    assert "cross_origin" in record["combo_tags"]


def test_western_dancer_upgrade_rewards_cross_origin_contribution_with_clue():
    state = engine.new_game("upgrade-clue", ["p1"])
    player = state.players["p1"]
    task = state.tasks[engine.content.sites[player.location]["active_task_id"]]
    card = next(card for card in engine.content.cards if engine._card_can_contribute(card, task))
    task["contributed_cards"] = [next(iter(engine.content.cards))]
    task["contribution_records"] = [{"origin_tags": ["earlier_origin"], "combo_tags": []}]
    player.hand = [card]
    engine._upgrade_effect(state, player, {"type": "post_contribution_clue", "value": 1})
    before = state.shared.research_clues
    engine._contribute(state, player, player.location, card)
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
