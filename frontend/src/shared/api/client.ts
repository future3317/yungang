import type { Action, GameState, Meta } from '../../types/game';

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, message: string, payload: unknown) { super(message); this.name = 'ApiError'; this.status = status; this.payload = payload; }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const body = await response.json().catch(() => null);
  if (!response.ok) { const detail = typeof body?.detail === 'string' ? body.detail : `请求失败（${response.status}）`; throw new ApiError(response.status, detail, body); }
  return body as T;
}
export const api = {
  meta: () => request<Meta>('/api/meta'),
  game: (id: string) => request<GameState>(`/api/games/${encodeURIComponent(id)}`),
  create: (playerIds: string[], difficultyId: string) => request<GameState>('/api/games', { method: 'POST', body: JSON.stringify({ player_ids: playerIds, difficulty_id: difficultyId }) }),
  action: (id: string, action: Action, playerId: string, revision: number) => request<GameState>(`/api/games/${encodeURIComponent(id)}/actions`, { method: 'POST', body: JSON.stringify({ ...action, action: action.type, player_id: playerId, expected_revision: revision }) })
};
