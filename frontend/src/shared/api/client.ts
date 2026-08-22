import type { Action, ArchiveSummary, GameState, Meta, PlayMode, Room, RoomCredentials, Task } from '../../types/game';
import type { components } from './generated';

type ActionRequest = components['schemas']['ActionRequest'];
type ContractGameState = components['schemas']['GameStateResponse'];

export class ApiError extends Error {
  status: number;
  payload: unknown;
  code?: string;
  recovery?: string;
  constructor(status: number, message: string, payload: unknown, code?: string, recovery?: string) { super(message); this.name = 'ApiError'; this.status = status; this.payload = payload; this.code = code; this.recovery = recovery; }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: init?.signal || controller.signal, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new ApiError(408, '连接超时，请检查本地服务后重试。', null, 'request_timeout', 'retry');
    throw error;
  } finally { window.clearTimeout(timeout); }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof body?.detail === 'string' ? { message: body.detail } : body?.detail || {};
    const message = detail.message || detail.details?.message || (response.status === 404 ? '找不到这段旅程。' : response.status === 409 ? '旅程已被更新，请同步后重试。' : `请求失败：${response.status}`);
    throw new ApiError(response.status, message, body, detail.code, detail.recovery);
  }
  return body as T;
}

function normalizeGameState(payload: ContractGameState): GameState {
  const players = payload.players || {};
  const shared = payload.shared || {};
  const tasks = Object.fromEntries(Object.entries(payload.tasks || {}).map(([id, value]) => {
    const record = value as Record<string, unknown>;
    return [id, {
      ...record,
      id: typeof record.id === 'string' ? record.id : id,
      name: typeof record.name === 'string' ? record.name : id,
      required_domains: Array.isArray(record.required_domains) ? record.required_domains.filter((item): item is string => typeof item === 'string') : [],
      required_origin_diversity: typeof record.required_origin_diversity === 'number' ? record.required_origin_diversity : 0,
      required_card_count: typeof record.required_card_count === 'number' ? record.required_card_count : 0,
      contributed_cards: Array.isArray(record.contributed_cards) ? record.contributed_cards.filter((item): item is string => typeof item === 'string') : [],
      completed: record.completed === true,
    } as Task];
  })) as Record<string, Task>;
  return {
    ...payload,
    players: Object.fromEntries(Object.entries(players).map(([id, player]) => [id, {
      ...player,
      hand: player.hand || [],
      action_hand: player.action_hand || [],
      flags: player.flags || {},
      upgrades: player.upgrades || [],
    }])) as GameState['players'],
    sites: payload.sites as GameState['sites'],
    tasks,
    shared: shared as GameState['shared'],
    decks: payload.decks || {},
    market: payload.market || [],
    pending_choice: payload.pending_choice as GameState['pending_choice'] || null,
    action_options: (payload.action_options || []) as GameState['action_options'],
    routes: (payload.routes || {}) as GameState['routes'],
    projects: (payload.projects || {}) as GameState['projects'],
    objectives: (payload.objectives || {}) as GameState['objectives'],
    feedback_events: (payload.feedback_events || []) as GameState['feedback_events'],
    goal_status: payload.goal_status,
    result: payload.result,
    score: payload.score,
    viewer: payload.viewer,
  };
}

function gameRequest(url: string, init?: RequestInit) {
  return request<ContractGameState>(url, init).then(normalizeGameState);
}

export const api = {
  meta: () => request<Meta>('/api/meta'),
  archives: () => request<ArchiveSummary[]>('/api/archives'),
  game: (id: string) => gameRequest(`/api/games/${encodeURIComponent(id)}`),
  create: (playerIds: string[], difficultyId: string, options?: { scenario_id?: string; seed?: number; daily_seed?: string }) => gameRequest('/api/games', { method: 'POST', body: JSON.stringify({ player_ids: playerIds, difficulty_id: difficultyId, scenario_id: options?.scenario_id || 'sand_and_stone', seed: options?.seed, daily_seed: options?.daily_seed }) }),
  action: (id: string, action: Action, playerId: string, revision: number) => { const payload: ActionRequest = { player_id: playerId, action: action.type, expected_revision: revision, target_id: action.target_id, target_site_id: action.target_site_id, card_id: action.card_id, recipient_id: action.recipient_id, route_id: action.route_id, upgrade_id: action.upgrade_id, target_ids: action.target_ids, request_id: action.request_id }; return gameRequest(`/api/games/${encodeURIComponent(id)}/actions`, { method: 'POST', body: JSON.stringify(payload) }); },
  createRoom: (options: { play_mode: PlayMode; name: string; role_id?: string; scenario_id: string; difficulty_id: string; seed?: number; max_players?: number }) => request<RoomCredentials>('/api/rooms', { method: 'POST', body: JSON.stringify(options) }),
  room: (roomId: string, token?: string) => request<Room>(`/api/rooms/${encodeURIComponent(roomId)}`, { headers: token ? { 'X-Seat-Token': token } : undefined }),
  joinRoom: (roomId: string, name: string, role_id?: string) => request<RoomCredentials>(`/api/rooms/${encodeURIComponent(roomId)}/join`, { method: 'POST', body: JSON.stringify({ name, role_id }) }),
  roomReconnect: (roomId: string, seatId: string) => request<RoomCredentials>(`/api/rooms/${encodeURIComponent(roomId)}/reconnect`, { method: 'POST', body: JSON.stringify({ seat_id: seatId }) }),
  roomReady: (roomId: string, token: string, ready: boolean) => request<Room>(`/api/rooms/${encodeURIComponent(roomId)}/ready`, { method: 'POST', headers: { 'X-Seat-Token': token }, body: JSON.stringify({ ready }) }),
  roomRole: (roomId: string, token: string, role_id: string) => request<Room>(`/api/rooms/${encodeURIComponent(roomId)}/role`, { method: 'POST', headers: { 'X-Seat-Token': token }, body: JSON.stringify({ role_id }) }),
  roomSeat: (roomId: string, token: string, seatId: string, update: { name?: string; role_id?: string; ready?: boolean }) => request<Room>(`/api/rooms/${encodeURIComponent(roomId)}/seats/${encodeURIComponent(seatId)}`, { method: 'POST', headers: { 'X-Seat-Token': token }, body: JSON.stringify(update) }),
  roomStart: (roomId: string, token: string) => request<{ room: Room; session_id: string }>(`/api/rooms/${encodeURIComponent(roomId)}/start`, { method: 'POST', headers: { 'X-Seat-Token': token } }),
  roomPause: (roomId: string, token: string) => request<Room>(`/api/rooms/${encodeURIComponent(roomId)}/pause`, { method: 'POST', headers: { 'X-Seat-Token': token } }),
  roomResume: (roomId: string, token: string) => request<Room>(`/api/rooms/${encodeURIComponent(roomId)}/resume`, { method: 'POST', headers: { 'X-Seat-Token': token } }),
  roomLeave: (roomId: string, token: string) => request<Room>(`/api/rooms/${encodeURIComponent(roomId)}/leave`, { method: 'POST', headers: { 'X-Seat-Token': token } }),
  roomGame: (roomId: string, token: string) => gameRequest(`/api/rooms/${encodeURIComponent(roomId)}/game`, { headers: { 'X-Seat-Token': token } }),
  roomEventTicket: (roomId: string, token: string) => request<{ ticket: string; expires_in: number }>(`/api/rooms/${encodeURIComponent(roomId)}/events-ticket`, { headers: { 'X-Seat-Token': token } }),
  roomAction: (roomId: string, token: string, action: Action, revision: number) => gameRequest(`/api/rooms/${encodeURIComponent(roomId)}/actions`, { method: 'POST', headers: { 'X-Seat-Token': token }, body: JSON.stringify({ action: action.type, expected_revision: revision, target_id: action.target_id, target_site_id: action.target_site_id, card_id: action.card_id, recipient_id: action.recipient_id, route_id: action.route_id, upgrade_id: action.upgrade_id, target_ids: action.target_ids, request_id: action.request_id }) })
};
