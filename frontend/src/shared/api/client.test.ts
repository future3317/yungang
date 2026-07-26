import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './client';

afterEach(() => vi.unstubAllGlobals());

describe('API client', () => {
  it('requests a game session through its encoded API path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ session_id: 'a b' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.game('a b')).resolves.toMatchObject({ session_id: 'a b' });
    expect(fetchMock).toHaveBeenCalledWith('/api/games/a%20b', expect.objectContaining({ headers: expect.any(Object) }));
  });
});
