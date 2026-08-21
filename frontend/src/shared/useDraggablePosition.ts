import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';

type Position = { x: number; y: number };
type DragOptions = { minVisibleWidth?: number; minVisibleHeight?: number };

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
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const movedRef = useRef(false);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(position)); } catch { /* private browsing can reject storage */ }
  }, [position, storageKey]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const nextX = drag.originX + event.clientX - drag.startX;
      const nextY = drag.originY + event.clientY - drag.startY;
      if (Math.abs(nextX - drag.originX) > 4 || Math.abs(nextY - drag.originY) > 4) movedRef.current = true;
      const maxLeft = -Math.max(0, window.innerWidth - minVisibleWidth);
      const maxTop = -Math.max(0, window.innerHeight - minVisibleHeight);
      setPosition({ x: Math.max(maxLeft, Math.min(0, nextX)), y: Math.max(maxTop, Math.min(0, nextY)) });
    };
    const end = () => { if (dragRef.current && movedRef.current) suppressClickRef.current = true; dragRef.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); };
  }, [minVisibleHeight, minVisibleWidth]);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    movedRef.current = false;
    suppressClickRef.current = false;
    dragRef.current = { startX: event.clientX, startY: event.clientY, originX: position.x, originY: position.y };
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
