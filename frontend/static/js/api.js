const sessionId = new URLSearchParams(location.search).get('game') || 'demo';

export async function createGame() {
  const response = await fetch(`/api/games/${sessionId}`, { method: 'POST' });
  return response.json();
}

export async function getGame() {
  const response = await fetch(`/api/games/${sessionId}`);
  if (response.status === 404) return createGame();
  return response.json();
}

export async function sendAction(action) {
  const response = await fetch(`/api/games/${sessionId}/actions`, {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(action)
  });
  const body = await response.json();
  if (!response.ok) { const error = new Error(body.detail || '动作失败'); error.payload = body; throw error; }
  return body;
}
