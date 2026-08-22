import type { Action, ArchiveSummary, GameState, Meta, PlayMode, Room, RoomCredentials, Task } from '../../types/game';
import type { components, paths } from './generated';

type ActionRequest = components['schemas']['ActionRequest'];
type ContractGameState = components['schemas']['GameStateResponse'];

export class ApiError extends Error {
  status: number;
  payload: unknown;
  code?: string;
  recovery?: string;
  constructor(status: number, message: string, payload: unknown, code?: string, recovery?: string) { super(message); this.name = 'ApiError'; this.status = status; this.payload = payload; this.code = code; this.recovery = recovery; }
}

type HttpMethod = 'get' | 'post';
type PathOperation<P extends keyof paths, M extends HttpMethod> = P extends keyof paths
  ? M extends keyof paths[P] ? paths[P][M] : never
  : never;
type JsonBody<O> = O extends { requestBody?: { content: { 'application/json': infer Body } } } ? Body : never;
type JsonResponse<O> = O extends { responses: infer Responses }
  ? Responses extends { 200: { content: { 'application/json': infer Body } } } ? Body : never
  : never;

async function requestRaw(url: string, init?: RequestInit): Promise<unknown> {
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
  return body;
}

async function requestPath<P extends keyof paths, M extends HttpMethod>(path: P, method: M, options: {
  path?: Record<string, string>;
  body?: JsonBody<PathOperation<P, M>>;
  headers?: HeadersInit;
} = {}): Promise<JsonResponse<PathOperation<P, M>>> {
  const url = String(path).replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = options.path?.[key];
    if (!value) throw new Error(`缺少接口路径参数：${key}`);
    return encodeURIComponent(value);
  });
  const body = options.body === undefined ? undefined : JSON.stringify(options.body);
  return await requestRaw(url, { method: method.toUpperCase(), body, headers: options.headers }) as JsonResponse<PathOperation<P, M>>;
}

function requiredArray<T>(value: T[] | undefined, field: string): T[] {
  if (!Array.isArray(value)) throw new Error(`服务器返回缺少 ${field}，无法继续显示这段旅程。`);
  return value;
}

function requiredNumber(value: number | undefined, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`服务器返回缺少 ${field}，无法继续显示这段旅程。`);
  return value;
}

function requiredBoolean(value: boolean | undefined, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`服务器返回缺少 ${field}，无法继续显示这段旅程。`);
  return value;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`服务器返回缺少 ${field}，无法继续显示这段旅程。`);
  return value;
}

function requiredRecord<T extends object>(value: T | undefined, field: string): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`服务器返回缺少 ${field}，无法继续显示这段旅程。`);
  return value;
}

function normalizeGameState(payload: ContractGameState): GameState {
  const players = requiredRecord(payload.players, 'players');
  const shared = requiredRecord(payload.shared, 'shared');
  const tasks = Object.fromEntries(Object.entries(payload.tasks || {}).map(([id, value]) => {
    const record = value as Record<string, unknown>;
    return [id, {
      ...record,
      id: requiredString(record.id, `tasks.${id}.id`),
      name: requiredString(record.name, `tasks.${id}.name`),
      required_domains: requiredArray(record.required_domains as string[] | undefined, `tasks.${id}.required_domains`),
      required_origin_diversity: requiredNumber(record.required_origin_diversity as number | undefined, `tasks.${id}.required_origin_diversity`),
      required_card_count: requiredNumber(record.required_card_count as number | undefined, `tasks.${id}.required_card_count`),
      contributed_cards: requiredArray(record.contributed_cards as string[] | undefined, `tasks.${id}.contributed_cards`),
      completed: requiredBoolean(record.completed as boolean | undefined, `tasks.${id}.completed`),
    } as Task];
  })) as Record<string, Task>;
  return {
    ...payload,
    players: Object.fromEntries(Object.entries(players).map(([id, player]) => [id, {
      ...player,
      hand: requiredArray(player.hand, `players.${id}.hand`),
      action_hand: requiredArray(player.action_hand, `players.${id}.action_hand`),
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

function gameResponse(body: ContractGameState) {
  return normalizeGameState(body);
}

function roomResponse(body: components['schemas']['RoomPublic'], sessionId?: string | null): Room {
  return { ...body, seats: body.seats || [], session_id: sessionId || null };
}

function credentialsResponse(body: components['schemas']['RoomCredentials']): RoomCredentials {
  return { ...body, room: roomResponse(body.room, body.session_id) };
}

function metaResponse(body: components['schemas']['MetaResponse']): Meta {
  if (!body || typeof body !== 'object' || !Array.isArray(body.scenarios) || !Array.isArray(body.sites) || !Array.isArray(body.roles)) {
    throw new Error('服务器返回的内容目录不完整，无法开始旅程。');
  }
  const normalized = {
    ...body,
    terminology: body.terminology,
    domain_meta: body.domain_meta || {},
    regions: body.regions || [],
    scenarios: body.scenarios || [],
    roles: body.roles || [],
    sites: body.sites || [],
    cards: body.cards || [],
    action_cards: body.action_cards || [],
    events: body.events || [],
    tasks: body.tasks || [],
    projects: body.projects || [],
    objectives: body.objectives || [],
    facets: body.facets || [],
    difficulty: body.difficulty || [],
    effective_rules_preview: body.effective_rules_preview || {},
  };
  // Content contracts and runtime site ViewModels intentionally meet at this one boundary.
  // No server state is defaulted here; nullability is normalized only for content presentation.
  // Content contracts and runtime site ViewModels intentionally meet at this one boundary.
  // No server state is defaulted here; nullability is normalized only for content presentation.
  return normalized as unknown as Meta;
}

function archivesResponse(body: components['schemas']['ArchiveSummary'][]): ArchiveSummary[] {
  if (!Array.isArray(body)) throw new Error('服务器返回的存档列表格式不正确。');
  return body.map(item => ({ ...item, players: item.players || [] }));
}

function actionRequest(action: Action, playerId: string, revision: number): ActionRequest {
  return { player_id: playerId, action: action.type, expected_revision: revision, target_id: action.target_id, target_site_id: action.target_site_id, card_id: action.card_id, recipient_id: action.recipient_id, route_id: action.route_id, upgrade_id: action.upgrade_id, target_ids: action.target_ids, request_id: action.request_id };
}

export const api = {
  meta: () => requestPath('/api/meta', 'get').then(metaResponse),
  archives: () => requestPath('/api/archives', 'get').then(archivesResponse),
  game: (id: string) => requestPath('/api/games/{session_id}', 'get', { path: { session_id: id } }).then(gameResponse),
  create: (playerIds: string[], difficultyId: string, options?: { scenario_id?: string; seed?: number; daily_seed?: string }) => requestPath('/api/games', 'post', { body: { player_ids: playerIds, difficulty_id: difficultyId, scenario_id: options?.scenario_id || 'sand_and_stone', seed: options?.seed, daily_seed: options?.daily_seed } }).then(gameResponse),
  action: (id: string, action: Action, playerId: string, revision: number) => requestPath('/api/games/{session_id}/actions', 'post', { path: { session_id: id }, body: actionRequest(action, playerId, revision) }).then(gameResponse),
  createRoom: (options: { play_mode: PlayMode; name: string; role_id?: string; scenario_id: string; difficulty_id: string; seed?: number; max_players?: number }) => requestPath('/api/rooms', 'post', { body: { ...options, max_players: options.max_players || 4 } }).then(credentialsResponse),
  room: (roomId: string, token?: string) => requestPath('/api/rooms/{room_id}', 'get', { path: { room_id: roomId }, headers: token ? { 'X-Seat-Token': token } : undefined }).then(body => roomResponse(body)),
  joinRoom: (roomId: string, name: string, role_id?: string) => requestPath('/api/rooms/{room_id}/join', 'post', { path: { room_id: roomId }, body: { name, role_id } }).then(credentialsResponse),
  roomReconnect: (roomId: string, seatId: string) => requestPath('/api/rooms/{room_id}/reconnect', 'post', { path: { room_id: roomId }, body: { seat_id: seatId } }).then(credentialsResponse),
  roomReady: (roomId: string, token: string, ready: boolean) => requestPath('/api/rooms/{room_id}/ready', 'post', { path: { room_id: roomId }, headers: { 'X-Seat-Token': token }, body: { ready } }).then(body => roomResponse(body)),
  roomRole: (roomId: string, token: string, role_id: string) => requestPath('/api/rooms/{room_id}/role', 'post', { path: { room_id: roomId }, headers: { 'X-Seat-Token': token }, body: { role_id } }).then(body => roomResponse(body)),
  roomSeat: (roomId: string, token: string, seatId: string, update: { name?: string; role_id?: string; ready?: boolean }) => requestPath('/api/rooms/{room_id}/seats/{seat_id}', 'post', { path: { room_id: roomId, seat_id: seatId }, headers: { 'X-Seat-Token': token }, body: update }).then(body => roomResponse(body)),
  roomStart: (roomId: string, token: string) => requestPath('/api/rooms/{room_id}/start', 'post', { path: { room_id: roomId }, headers: { 'X-Seat-Token': token } }).then(body => ({ ...body, room: roomResponse(body.room, body.session_id) })),
  roomPause: (roomId: string, token: string) => requestPath('/api/rooms/{room_id}/pause', 'post', { path: { room_id: roomId }, headers: { 'X-Seat-Token': token } }).then(body => roomResponse(body)),
  roomResume: (roomId: string, token: string) => requestPath('/api/rooms/{room_id}/resume', 'post', { path: { room_id: roomId }, headers: { 'X-Seat-Token': token } }).then(body => roomResponse(body)),
  roomLeave: (roomId: string, token: string) => requestPath('/api/rooms/{room_id}/leave', 'post', { path: { room_id: roomId }, headers: { 'X-Seat-Token': token } }).then(body => roomResponse(body)),
  roomGame: (roomId: string, token: string) => requestPath('/api/rooms/{room_id}/game', 'get', { path: { room_id: roomId }, headers: { 'X-Seat-Token': token } }).then(gameResponse),
  roomEventTicket: (roomId: string, token: string) => requestPath('/api/rooms/{room_id}/events-ticket', 'get', { path: { room_id: roomId }, headers: { 'X-Seat-Token': token } }),
  roomAction: (roomId: string, token: string, action: Action, revision: number) => requestPath('/api/rooms/{room_id}/actions', 'post', { path: { room_id: roomId }, headers: { 'X-Seat-Token': token }, body: { action: action.type, expected_revision: revision, target_id: action.target_id, target_site_id: action.target_site_id, card_id: action.card_id, recipient_id: action.recipient_id, route_id: action.route_id, upgrade_id: action.upgrade_id, target_ids: action.target_ids, request_id: action.request_id } }).then(gameResponse)
};
