import { describe, expect, it } from 'vitest';
import { roomStatusFromEvent } from './useRoomEvents';

describe('room SSE status parsing', () => {
  it('reads the room status from a revision event', () => {
    expect(roomStatusFromEvent('{"revision":12,"status":"completed"}')).toBe('completed');
  });

  it('does not turn malformed or empty close data into a room-ended state', () => {
    expect(roomStatusFromEvent('{}')).toBeUndefined();
    expect(roomStatusFromEvent('not-json')).toBeUndefined();
  });
});
