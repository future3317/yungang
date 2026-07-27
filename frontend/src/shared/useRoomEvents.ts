import { useEffect, useRef } from 'react';
import { ApiError, api } from './api/client';

type RoomEventOptions = { roomId: string; token: string; onRevision: () => void; onState?: (state: 'connected' | 'retrying' | 'ended' | 'unauthorized') => void };

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
    let retry = 0;

    const connect = async () => {
      try {
        const { ticket } = await api.roomEventTicket(roomId, token);
        if (cancelled) return;
        stream = new EventSource(`/api/rooms/${encodeURIComponent(roomId)}/events?ticket=${encodeURIComponent(ticket)}`);
        stream.addEventListener('revision', () => { retry = 0; onStateRef.current?.('connected'); onRevisionRef.current(); });
        stream.addEventListener('close', () => {
          stream?.close();
          if (!cancelled) { onStateRef.current?.('ended'); retryTimer = window.setTimeout(connect, 500); }
        });
        stream.onerror = () => {
          stream?.close();
          if (cancelled) return;
          const delay = Math.min(30000, 800 * 2 ** retry++);
          onStateRef.current?.('retrying');
          retryTimer = window.setTimeout(connect, delay);
        };
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) { onStateRef.current?.('unauthorized'); return; }
        const delay = Math.min(30000, 800 * 2 ** retry++);
        onStateRef.current?.('retrying');
        retryTimer = window.setTimeout(connect, delay);
      }
    };
    void connect();
    return () => { cancelled = true; stream?.close(); if (retryTimer) window.clearTimeout(retryTimer); };
  }, [roomId, token]);
}
