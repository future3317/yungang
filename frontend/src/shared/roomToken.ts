const tokenKey = (roomId: string) => `yungang-room-token:${roomId}`;
const recoveryKey = (roomId: string) => `yungang-room-recovery:${roomId}`;
const recoverySeatKey = (roomId: string) => `yungang-room-recovery-seat:${roomId}`;
const knownRoomsKey = 'yungang-known-rooms';

export function getRoomToken(roomId: string): string {
  try {
    return window.sessionStorage.getItem(tokenKey(roomId)) || '';
  } catch {
    return '';
  }
}

export function setRoomToken(roomId: string, token: string): void {
  window.sessionStorage.setItem(tokenKey(roomId), token);
  rememberRoom(roomId);
}

export function getRoomRecoveryToken(roomId: string): string {
  return window.localStorage.getItem(recoveryKey(roomId)) || '';
}

export function getRoomRecoverySeatId(roomId: string): string {
  return window.localStorage.getItem(recoverySeatKey(roomId)) || '';
}

export function setRoomRecoveryToken(roomId: string, token: string, seatId?: string | null): void {
  if (token) window.localStorage.setItem(recoveryKey(roomId), token);
  if (seatId) window.localStorage.setItem(recoverySeatKey(roomId), seatId);
  rememberRoom(roomId);
}

export function rememberRoom(roomId: string): void {
  const rooms = new Set(JSON.parse(window.localStorage.getItem(knownRoomsKey) || '[]') as string[]);
  rooms.add(roomId);
  window.localStorage.setItem(knownRoomsKey, JSON.stringify([...rooms].slice(-20)));
}

export function getKnownRoomIds(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(knownRoomsKey) || '[]') as string[];
  } catch {
    return [];
  }
}

export function clearRoomToken(roomId: string): void {
  window.sessionStorage.removeItem(tokenKey(roomId));
}
