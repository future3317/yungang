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
