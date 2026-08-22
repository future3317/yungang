import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';

type Position = { x: number; y: number };
type DragOptions = { minVisibleWidth?: number; minVisibleHeight?: number };
type DragState = { startX: number; startY: number; originX: number; originY: number; rect: DOMRect };

function loadPosition(storageKey: string): Position {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || '{}') as Partial<Position>;
    return { x: typeof saved.x === 'number' ? saved.x : 0, y: typeof saved.y === 'number' ? saved.y : 0 };
  } catch {
    return { x: 0, y: 0 };
  }
}

export function useDraggablePosition(storageKey: string, options: DragOptions = {}) {
  const { minVisibleWidth = 120, minVisibleHeight = 56 } = options;
  const [position, setPosition] = useState<Position>(() => loadPosition(storageKey));
  const dragRef = useRef<DragState | null>(null);
  const movedRef = useRef(false);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(position)); } catch { /* private browsing can reject storage */ }
  }, [position, storageKey]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) movedRef.current = true;
      const minDeltaX = minVisibleWidth - drag.rect.right;
      const maxDeltaX = window.innerWidth - minVisibleWidth - drag.rect.left;
      const minDeltaY = minVisibleHeight - drag.rect.bottom;
      const maxDeltaY = window.innerHeight - minVisibleHeight - drag.rect.top;
      const boundedX = Math.max(minDeltaX, Math.min(maxDeltaX, deltaX));
      const boundedY = Math.max(minDeltaY, Math.min(maxDeltaY, deltaY));
      setPosition({ x: drag.originX + boundedX, y: drag.originY + boundedY });
    };
    const end = () => { if (dragRef.current && movedRef.current) suppressClickRef.current = true; dragRef.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
  }, [minVisibleHeight, minVisibleWidth]);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    movedRef.current = false;
    suppressClickRef.current = false;
    const surface = event.currentTarget.closest<HTMLElement>('[data-draggable-surface]') || event.currentTarget.parentElement;
    dragRef.current = { startX: event.clientX, startY: event.clientY, originX: position.x, originY: position.y, rect: surface?.getBoundingClientRect() || event.currentTarget.getBoundingClientRect() };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onClickCapture = (event: ReactMouseEvent<HTMLElement>) => {
    if (!movedRef.current && !suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    movedRef.current = false;
    suppressClickRef.current = false;
  };
  const style = { '--drag-x': `${position.x}px`, '--drag-y': `${position.y}px` } as CSSProperties;
  return { style, onPointerDown, onClickCapture };
}
