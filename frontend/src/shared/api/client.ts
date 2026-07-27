import type { Action, GameState, Meta } from '../../types/game';
import type { components } from './generated';

type ActionRequest = components['schemas']['ActionRequest'];

export class ApiError extends Error {
  status: number;
  payload: unknown;
  code?: string;
  recovery?: string;
  constructor(status: number, message: string, payload: unknown, code?: string, recovery?: string) { super(message); this.name = 'ApiError'; this.status = status; this.payload = payload; this.code = code; this.recovery = recovery; }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof body?.detail === 'string' ? { message: body.detail } : body?.detail || {};
    const message = detail.message || (response.status === 404 ? '找不到这段旅程。' : response.status === 409 ? '旅程已被更新，请同步后重试。' : `请求失败：${response.status}`);
    throw new ApiError(response.status, message, body, detail.code, detail.recovery);
  }
  return body as T;
}

export const api = {
  meta: () => request<Meta>('/api/meta'),
  game: (id: string) => request<GameState>(`/api/games/${encodeURIComponent(id)}`),
  create: (playerIds: string[], difficultyId: string, options?: { scenario_id?: string; seed?: number; daily_seed?: string }) => request<GameState>('/api/games', { method: 'POST', body: JSON.stringify({ player_ids: playerIds, difficulty_id: difficultyId, scenario_id: options?.scenario_id || 'sand_and_stone', seed: options?.seed, daily_seed: options?.daily_seed }) }),
  action: (id: string, action: Action, playerId: string, revision: number) => { const payload: ActionRequest = { player_id: playerId, action: action.type, expected_revision: revision, target_id: action.target_id, target_site_id: action.target_site_id, card_id: action.card_id, recipient_id: action.recipient_id, route_id: action.route_id, upgrade_id: action.upgrade_id }; return request<GameState>(`/api/games/${encodeURIComponent(id)}/actions`, { method: 'POST', body: JSON.stringify(payload) }); }
};
