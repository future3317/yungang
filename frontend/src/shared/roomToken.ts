const tokenKey = (roomId: string) => `yungang-room-token:${roomId}`;

export function getRoomToken(roomId: string): string {
  try {
    const key = tokenKey(roomId);
    const stored = window.localStorage.getItem(key);
    if (stored) return stored;
    const legacy = window.sessionStorage.getItem(key);
    if (legacy) {
      window.localStorage.setItem(key, legacy);
      window.sessionStorage.removeItem(key);
    }
    return legacy || '';
  } catch {
    return '';
  }
}

export function setRoomToken(roomId: string, token: string): void {
  window.localStorage.setItem(tokenKey(roomId), token);
}

export function clearRoomToken(roomId: string): void {
  window.localStorage.removeItem(tokenKey(roomId));
  window.sessionStorage.removeItem(tokenKey(roomId));
}
