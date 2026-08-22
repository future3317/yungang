const tokenKey = (roomId: string) => `yungang-room-token:${roomId}`;

export function getRoomToken(roomId: string): string {
  try {
    return window.sessionStorage.getItem(tokenKey(roomId)) || '';
  } catch {
    return '';
  }
}

export function setRoomToken(roomId: string, token: string): void {
  window.sessionStorage.setItem(tokenKey(roomId), token);
}

export function clearRoomToken(roomId: string): void {
  window.sessionStorage.removeItem(tokenKey(roomId));
}
