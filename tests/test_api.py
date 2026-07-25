import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from backend.app import app

client = TestClient(app)

def test_create_and_read_v2_game():
    state = client.post('/api/games/test-v2').json()
    assert state['schema_version'] == 2
    assert state['mode'] == 'heritage_network'
    assert client.get('/api/games/test-v2').json()['revision'] == 0

def test_action_revision_and_conflict():
    state = client.post('/api/games/test-revision').json()
    action = {'player_id':'p1','action':'explore','expected_revision':state['revision']}
    updated = client.post('/api/games/test-revision/actions', json=action).json()
    assert updated['revision'] == 1
    conflict = client.post('/api/games/test-revision/actions', json=action)
    assert conflict.status_code == 409
    assert conflict.json()['detail']['code'] == 'revision_conflict'

def test_move_is_ap_driven():
    state = client.post('/api/games/test-move').json()
    updated = client.post('/api/games/test-move/actions', json={'player_id':'p1','action':'move','target_id':'huayan_temple','expected_revision':state['revision']}).json()
    assert updated['players']['p1']['location'] == 'huayan_temple'
    assert updated['players']['p1']['ap'] == 2
