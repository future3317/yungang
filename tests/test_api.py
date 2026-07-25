import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from backend.app import app, repo
from backend.engine import GameEngine

client = TestClient(app)

def create(session, players=None):
    return client.post(f'/api/games/{session}', json={'player_ids': players or ['p1', 'p2'], 'difficulty_id':'normal'}).json()

def action(session, state, player, kind, **extra):
    payload = {'player_id':player, 'action':kind, 'expected_revision':state['revision'], **extra}
    return client.post(f'/api/games/{session}/actions', json=payload)

def test_meta_and_v2_game_setup():
    meta = client.get('/api/meta').json()
    assert meta['schema_version'] == 2
    assert len(meta['roles']) == 4
    state = create('test-v2')
    assert state['mode'] == 'heritage_network'
    assert state['shared']['current_event_id'] == 'sandstorm'
    assert len(state['market']) == 3
    assert state['players']['p1']['location'] == 'pingcheng_ruins'

def test_market_explore_and_revision_conflict():
    session = 'test-market'
    state = create(session)
    card = state['market'][0]
    updated = action(session, state, 'p1', 'explore', target_id='pingcheng_ruins', card_id=card).json()
    assert updated['revision'] == 1
    assert card in updated['players']['p1']['hand']
    assert len(updated['market']) == 3
    conflict = action(session, state, 'p1', 'explore', target_id='pingcheng_ruins', card_id=card)
    assert conflict.status_code == 409
    assert conflict.json()['detail']['code'] == 'revision_conflict'

def test_role_skill_uses_ap_and_once_per_round():
    session = 'test-skill'
    state = create(session)
    state_obj = repo.get(session)
    state_obj.sites['pingcheng_ruins'].damage = 2
    state_obj.sites['pingcheng_ruins'].status = 'at_risk'
    repo.save(state_obj)
    state = client.get(f'/api/games/{session}').json()
    updated = action(session, state, 'p1', 'use_skill').json()
    assert updated['players']['p1']['skill_used'] is True
    assert updated['sites']['pingcheng_ruins']['damage'] == 0
    assert updated['players']['p1']['ap'] == 2

def test_event_choice_is_server_driven():
    session = 'test-event-choice'
    state = create(session)
    state_obj = repo.get(session)
    state_obj.shared.current_event_id = 'route_blocked'
    state_obj.shared.player_order = ['p1']
    state_obj.players.pop('p2')
    repo.save(state_obj)
    state = client.get(f'/api/games/{session}').json()
    ended = action(session, state, 'p1', 'end_turn').json()
    assert ended['pending_choice']['kind'] == 'event'
    assert {item['type'] for item in ended['legal_actions']} == {'resolve_event'}
    resolved = action(session, ended, 'p1', 'resolve_event', target_id='mitigate').json()
    assert resolved['pending_choice'] is None
    assert resolved['shared']['restoration_resource'] == 5

def test_join_game_before_first_action():
    session = 'test-join'
    create(session, ['p1', 'p2'])
    joined = client.post(f'/api/games/{session}/players', json={'player_id':'p3','role_id':'grassland_rider'}).json()
    assert 'p3' in joined['players']
    assert joined['players']['p3']['role_id'] == 'grassland_rider'

def test_move_is_route_driven():
    session = 'test-move-v2'
    state = create(session)
    updated = action(session, state, 'p1', 'move', target_id='yungang').json()
    assert updated['players']['p1']['location'] == 'yungang'
    assert updated['players']['p1']['ap'] == 2
