import { useEffect, useRef } from 'react';
import { ApiError, api } from './api/client';

export type RoomEventState = 'connected' | 'retrying' | 'ended' | 'unauthorized' | 'room_ended';
type RoomEventOptions = {
  roomId: string;
  token: string;
  onRevision: () => void;
  onState?: (state: RoomEventState) => void;
};

const MAX_RETRY_DELAY = 8000;

export function roomStatusFromEvent(data: string): string | undefined {
  try {
    const payload = JSON.parse(data) as { status?: unknown };
    return typeof payload.status === 'string' ? payload.status : undefined;
  } catch {
    return undefined;
  }
}

export function useRoomEvents({ roomId, token, onRevision, onState }: RoomEventOptions) {
  const onRevisionRef = useRef(onRevision);
  const onStateRef = useRef(onState);
  onRevisionRef.current = onRevision;
  onStateRef.current = onState;

  useEffect(() => {
    if (!roomId || !token) return undefined;

    let cancelled = false;
    let stream: EventSource | undefined;
    let retryTimer: number | undefined;
    let retryCount = 0;
    let connecting = false;
    let lastRoomStatus: string | undefined;

    const clearRetryTimer = () => {
      if (retryTimer !== undefined) {
        window.clearTimeout(retryTimer);
        retryTimer = undefined;
      }
    };

    const scheduleReconnect = (normalEnd = false) => {
      if (cancelled || retryTimer !== undefined) return;
      const delay = normalEnd ? 500 : Math.min(MAX_RETRY_DELAY, 500 * 2 ** retryCount);
      retryCount = normalEnd ? 0 : Math.min(retryCount + 1, 5);
      onStateRef.current?.(normalEnd ? 'ended' : 'retrying');
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        void connect();
      }, delay);
    };

    const connect = async () => {
      if (cancelled || connecting) return;
      connecting = true;
      clearRetryTimer();
      try {
        const { ticket } = await api.roomEventTicket(roomId, token);
        if (cancelled) return;
        stream?.close();
        stream = new EventSource(`/api/rooms/${encodeURIComponent(roomId)}/events?ticket=${encodeURIComponent(ticket)}`);
        stream.onopen = () => {
          retryCount = 0;
          onStateRef.current?.('connected');
        };
        stream.addEventListener('revision', event => {
          lastRoomStatus = roomStatusFromEvent((event as MessageEvent<string>).data);
          retryCount = 0;
          onStateRef.current?.('connected');
          onRevisionRef.current();
        });
        stream.addEventListener('close', () => {
          stream?.close();
          stream = undefined;
          if (lastRoomStatus === 'completed' || lastRoomStatus === 'abandoned') {
            onStateRef.current?.('room_ended');
            return;
          }
          scheduleReconnect(true);
        });
        stream.onerror = () => {
          stream?.close();
          stream = undefined;
          scheduleReconnect(false);
        };
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          onStateRef.current?.('unauthorized');
          return;
        }
        if (error instanceof ApiError && error.status === 404) {
          onStateRef.current?.('room_ended');
          return;
        }
        scheduleReconnect(false);
      } finally {
        connecting = false;
      }
    };

    void connect();
    return () => {
      cancelled = true;
      clearRetryTimer();
      stream?.close();
      stream = undefined;
    };
  }, [roomId, token]);
}
