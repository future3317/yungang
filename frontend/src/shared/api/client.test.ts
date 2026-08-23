import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from './client';

afterEach(() => vi.unstubAllGlobals());

function makeGameResponse() {
  return {
    session_id: 'game-1',
    mode: 'heritage_network',
    schema_version: 3,
    revision: 0,
    players: { p1: { id: 'p1', name: 'A', role_id: 'pingcheng_artisan', location: 'yungang', ap: 3, max_ap: 3, hand: [], action_hand: [], upgrades: [], influence: 0, contributions: 0, supplies: 0, flags: {}, skill_used: false } },
    sites: {},
    tasks: {},
    routes: {},
    projects: {},
    objectives: {},
    deck_counts: { culture: 0, events: 0, discard: 0, archive: 0, action: 0 },
    market: [],
    action_options: [],
    feedback_events: [],
    shared: {
      active_player_id: 'p1',
      player_order: ['p1'],
      max_rounds: 4,
      turn: 1,
      phase: 'player_action',
      scenario_id: 'tutorial',
      difficulty_id: 'guided',
      restoration_resource: 3,
      research_clues: 0,
      weathering_track: 0,
      weathering_limit: 5,
      influence: 0,
      event_history: [],
      journal: [],
      prepared_event_ids: [],
      node_ability_uses: [],
      completed_domains: [],
      solo_mode: false,
      controlled_character_ids: [],
    },
    goal_status: {},
    result: {},
    score: { tasks: 0, routes: 0, diversity: 0, protection: 0, discovery: 0, resources: 0, efficiency: 0, total: 0, grade: 'bronze' },
    viewer: { seat_id: 'seat-1', player_id: 'p1', controlled_player_ids: ['p1'], can_act: true, can_manage_room: true, play_mode: 'solo', paused: false, room_id: 'room-1', room_status: 'in_progress', seats: [] },
  };
}

describe('API client', () => {
  it('requests the room game state with the seat token header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(makeGameResponse()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await api.roomGame('room-1', 'token-abc');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/rooms/room-1/game',
      expect.objectContaining({ headers: expect.objectContaining({ 'X-Seat-Token': 'token-abc' }) })
    );
  });

  it('keeps the recovery instruction from a structured API error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: { code: 'revision_conflict', message: '状态已更新', recovery: 'sync_current_state' },
        }),
        { status: 409 }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.roomGame('room-1', 'token')).rejects.toMatchObject({
      status: 409,
      message: '状态已更新',
      code: 'revision_conflict',
      recovery: 'sync_current_state',
    } satisfies Partial<ApiError>);
  });
});
