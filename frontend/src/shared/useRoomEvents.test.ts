import { describe, expect, it } from 'vitest';
import { fallbackPollInterval, roomStatusFromEvent } from './useRoomEvents';

describe('room SSE status parsing', () => {
  it('reads the room status from a revision event', () => {
    expect(roomStatusFromEvent('{"revision":12,"status":"completed"}')).toBe('completed');
  });

  it('does not turn malformed or empty close data into a room-ended state', () => {
    expect(roomStatusFromEvent('{}')).toBeUndefined();
    expect(roomStatusFromEvent('not-json')).toBeUndefined();
  });

  it('only enables low-frequency polling while SSE is recovering', () => {
    expect(fallbackPollInterval('connected', 'room-1')).toBe(false);
    expect(fallbackPollInterval('retrying', 'room-1')).toBe(10000);
    expect(fallbackPollInterval('ended', 'room-1')).toBe(10000);
    expect(fallbackPollInterval('unauthorized', 'room-1')).toBe(false);
  });
});
