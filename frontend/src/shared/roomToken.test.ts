import { beforeEach, describe, expect, it } from 'vitest';
import { clearRoomToken, getRoomToken, setRoomToken } from './roomToken';

describe('room seat token storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('keeps seat credentials in the current browser session only', () => {
    setRoomToken('room-1', 'seat-secret');
    expect(getRoomToken('room-1')).toBe('seat-secret');
    expect(window.localStorage.getItem('yungang-room-token:room-1')).toBeNull();
    clearRoomToken('room-1');
    expect(getRoomToken('room-1')).toBe('');
  });
});
