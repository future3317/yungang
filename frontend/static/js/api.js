const sessionId = new URLSearchParams(location.search).get('game') || 'demo';

export async function createGame() {
  const response = await fetch(`/api/games/${sessionId}`, { method: 'POST' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.detail || `HTTP ${response.status}`);
  return body;
}

export async function getGame() {
  const response = await fetch(`/api/games/${sessionId}`);
  if (response.status === 404) return createGame();
  const body = await response.json();
  if (!response.ok) throw new Error(body.detail || `HTTP ${response.status}`);
  return body;
}

export async function sendAction(action) {
  const response = await fetch(`/api/games/${sessionId}/actions`, {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(action)
  });
  const body = await response.json();
  if (!response.ok) { const error = new Error(body.detail || '\u52a8\u4f5c\u5931\u8d25'); error.payload = body; throw error; }
  return body;
}
