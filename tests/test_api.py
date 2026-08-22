import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient
from backend.app import app, content, repo
from backend.engine import GameEngine

client = TestClient(app)

def create(session, players=None):
    created = client.post('/api/games', json={'player_ids': players or ['p1', 'p2'], 'difficulty_id': 'normal'})
    assert created.status_code == 200
    source = repo.get(created.json()['session_id'])
    source.session_id = session
    repo.save(source)
    return client.get(f'/api/games/{session}').json()

def action(session, state, player, kind, **extra):
    payload = {'player_id':player, 'action':kind, 'expected_revision':state['revision'], **extra}
    return client.post(f'/api/games/{session}/actions', json=payload)

def test_meta_and_v3_game_setup():
    meta = client.get('/api/meta').json()
    assert meta['schema_version'] == 3
    assert len(meta['roles']) == 4
    assert len(meta['regions']) == 4
    assert len(meta['sites']) >= 18
    state = create('test-v3')
    assert state['mode'] == 'heritage_network'
    assert state['schema_version'] == 3
    assert state['shared']['current_event_id'] in {item['id'] for item in meta['events']}
    assert len(state['market']) == 3
    assert state['players']['p1']['location'] == 'pingcheng_ruins'
    assert state['action_options']

@pytest.mark.parametrize('raw_code,base_code', [
    ('invalid_action_card_discard', 'invalid_action_card_discard'),
    ('unsupported_action_card_effect:unknown_effect', 'unsupported_action_card_effect'),
    ('unsupported_effect:unknown_effect', 'unsupported_effect'),
    ('unsupported_trigger:unknown_trigger', 'unsupported_trigger'),
])
def test_dynamic_engine_errors_use_catalog_messages(monkeypatch, raw_code, base_code):
    state = create(f'error-catalog-{base_code}', ['p1'])

    def fail_dispatch(*_args, **_kwargs):
        raise ValueError(raw_code)

    monkeypatch.setattr('backend.app.dispatch', fail_dispatch)
    response = action(f'error-catalog-{base_code}', state, 'p1', 'end_turn')
    detail = response.json()['detail']
    errors = content.terminology['errors']

    assert response.status_code == 400
    assert detail['code'] == raw_code
    assert detail['message'] == errors[base_code]
    assert 'unknown_' not in detail['message']

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
    option_types = {item['type'] for item in ended['action_options']}
    assert 'resolve_event' in option_types
    assert all(item['label'] for item in ended['action_options'] if item['type'] == 'use_action_card')
    resources_before = ended['shared']['restoration_resource']
    resolved = action(session, ended, 'p1', 'resolve_event', target_id='mitigate').json()
    assert resolved['pending_choice'] is None
    assert resolved['shared']['restoration_resource'] == resources_before - 1

def test_move_is_route_driven():
    session = 'test-move-route-current'
    state = create(session)
    updated = action(session, state, 'p1', 'move', target_id='yungang').json()
    assert updated['players']['p1']['location'] == 'yungang'
    assert updated['players']['p1']['ap'] == 2

def test_same_seed_reproduces_opening_and_different_seed_changes_it():
    first = client.post('/api/games', json={'player_ids': ['p1', 'p2'], 'scenario_id': 'sand_and_stone', 'seed': 42}).json()
    second = client.post('/api/games', json={'player_ids': ['p1', 'p2'], 'scenario_id': 'sand_and_stone', 'seed': 42}).json()
    other = client.post('/api/games', json={'player_ids': ['p1', 'p2'], 'scenario_id': 'sand_and_stone', 'seed': 43}).json()
    assert first['seed'] == second['seed'] == 42
    assert first['market'] == second['market']
    assert first['shared']['current_event_id'] == second['shared']['current_event_id']
    assert first['market'] != other['market'] or first['shared']['current_event_id'] != other['shared']['current_event_id']

def test_scenario_changes_initial_rules_and_route_state():
    state = client.post('/api/games', json={'player_ids': ['p1', 'p2'], 'scenario_id': 'market_reopening', 'seed': 7}).json()
    assert state['scenario_id'] == 'market_reopening'
    scenario = GameEngine().content.scenarios['market_reopening']
    assert state['shared']['max_rounds'] == scenario['max_rounds']
    assert sum(route['status'] == 'blocked' for route in state['routes'].values()) == scenario['blocked_route_count']

def test_routes_are_single_records_and_move_from_either_endpoint():
    session = 'test-undirected-route'
    state = create(session)
    pairs = {tuple(sorted((route['from_site'], route['to_site']))) for route in state['routes'].values()}
    assert len(pairs) == len(state['routes'])
    stored = repo.get(session)
    stored.players['p1'].location = 'yungang'
    repo.save(stored)
    state = client.get(f'/api/games/{session}').json()
    updated = action(session, state, 'p1', 'move', target_id='pingcheng_ruins').json()
    assert updated['players']['p1']['location'] == 'pingcheng_ruins'

def test_prepare_event_consumes_flag_and_prevents_event_choice():
    session = 'test-prepare-effect'
    state = create(session)
    stored = repo.get(session)
    stored.shared.current_event_id = 'route_blocked'
    stored.shared.player_order = ['p1']
    stored.players.pop('p2')
    repo.save(stored)
    state = client.get(f'/api/games/{session}').json()
    prepared = action(session, state, 'p1', 'prepare').json()
    assert prepared['players']['p1']['flags']['prepared_event_id'] == 'route_blocked'
    ended = action(session, prepared, 'p1', 'end_turn').json()
    assert ended['pending_choice'] is None
    assert ended['shared']['prepared_event_ids'] == []

def test_route_blocked_event_changes_a_real_route_state():
    session = 'test-route-blocked-target'
    state = create(session)
    stored = repo.get(session)
    stored.shared.current_event_id = 'route_blocked'
    stored.shared.player_order = ['p1']
    stored.players.pop('p2')
    open_before = sum(route.status in {'open', 'strained'} for route in stored.routes.values())
    repo.save(stored)
    ended = action(session, client.get(f'/api/games/{session}').json(), 'p1', 'end_turn').json()
    open_after = sum(route['status'] in {'open', 'strained'} for route in ended['routes'].values())
    assert open_after == open_before - 1
    assert ended['pending_choice']['kind'] == 'event'

def test_action_card_requires_a_route_target_before_resolution():
    session = 'test-action-card-target'
    state = create(session)
    stored = repo.get(session)
    stored.players['p1'].action_hand = ['action_01']
    route = next(route for route in stored.routes.values() if stored.players['p1'].location in {route.from_site, route.to_site})
    route.status = 'strained'
    repo.save(stored)
    choosing = action(session, client.get(f'/api/games/{session}').json(), 'p1', 'use_action_card', card_id='action_01').json()
    assert choosing['pending_choice']['kind'] == 'action_card'
    target = choosing['action_options'][0]['targets'][0]['id']
    resolved = action(session, choosing, 'p1', 'use_action_card', card_id='action_01', target_id=target).json()
    assert resolved['pending_choice'] is None
    assert 'action_01' not in resolved['players']['p1']['action_hand']

def test_card_has_archive_and_discard_paths():
    session = 'test-card-dual-use'
    state = create(session)
    assert state['decks']['action']
    card = state['market'][0]
    explored = action(session, state, 'p1', 'explore', target_id='pingcheng_ruins', card_id=card).json()
    played = action(session, explored, 'p1', 'play_card', card_id=card).json()
    assert card in played['decks']['discard']

def test_round_enters_player_action_without_manual_planning_step():
    session = 'test-planning-phase'
    state = create(session)
    stored = repo.get(session)
    stored.shared.current_event_id = 'pilgrims'
    repo.save(stored)
    first = action(session, client.get(f'/api/games/{session}').json(), 'p1', 'end_turn').json()
    second = action(session, first, 'p2', 'end_turn').json()
    assert second['shared']['phase'] == 'player_action'
    assert second['shared']['planning_marks'] == {}
    assert any(item['type'] == 'move' for item in second['action_options'])

def test_event_targets_are_seed_deterministic():
    first = client.post('/api/games', json={'player_ids': ['p1', 'p2'], 'scenario_id': 'sand_and_stone', 'seed': 91}).json()
    second = client.post('/api/games', json={'player_ids': ['p1', 'p2'], 'scenario_id': 'sand_and_stone', 'seed': 91}).json()
    assert first['shared']['event_targets'] == second['shared']['event_targets']
    assert first['shared']['event_instance']['revealed_targets'] == second['shared']['event_instance']['revealed_targets']

def test_non_route_action_card_requires_human_target():
    session = 'test-action-card-player-target'
    state = create(session)
    stored = repo.get(session)
    stored.players['p1'].action_hand = ['action_11']
    stored.players['p2'].location = stored.players['p1'].location
    repo.save(stored)
    choosing = action(session, client.get(f'/api/games/{session}').json(), 'p1', 'use_action_card', card_id='action_11').json()
    assert choosing['pending_choice']['kind'] == 'action_card'
    assert choosing['action_options'][0]['targets'][0]['id'] == 'p2'
