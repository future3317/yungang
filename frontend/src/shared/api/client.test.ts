import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from './client';

afterEach(() => vi.unstubAllGlobals());

describe('API client', () => {
  it('requests a game session through its encoded API path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ session_id: 'a b' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.game('a b')).resolves.toMatchObject({ session_id: 'a b' });
    expect(fetchMock).toHaveBeenCalledWith('/api/games/a%20b', expect.objectContaining({ headers: expect.any(Object) }));
  });

  it('keeps the recovery instruction from a structured API error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: { code: 'revision_conflict', message: '状态已更新', recovery: 'sync_current_state' } }), { status: 409 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.game('session')).rejects.toMatchObject({ status: 409, message: '状态已更新', code: 'revision_conflict', recovery: 'sync_current_state' } satisfies Partial<ApiError>);
  });
});
