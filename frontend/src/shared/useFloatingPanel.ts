import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export type FloatingPanelSize = { width: number; height: number };
export type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';

type FloatingPanelOptions = {
  initialSize: FloatingPanelSize;
  minWidth: number;
  minHeight: number;
  maxHeightInset?: number;
  maxHeightFloor?: number;
};

type DragStart = { x: number; y: number; offsetX: number; offsetY: number };
type ResizeStart = FloatingPanelSize & { x: number; y: number; corner: ResizeCorner };

export function useFloatingPanel<T extends HTMLElement = HTMLElement>({
  initialSize,
  minWidth,
  minHeight,
  maxHeightInset = 32,
  maxHeightFloor = 0,
}: FloatingPanelOptions) {
  const panelRef = useRef<T | null>(null);
  const dragStart = useRef<DragStart | null>(null);
  const resizeStart = useRef<ResizeStart | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState(initialSize);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);

  const beginDrag = (event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y };
    setDragging(true);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const start = dragStart.current;
    const panel = panelRef.current;
    const parent = panel?.parentElement;
    if (!start || !panel || !parent) return;
    const panelBox = panel.getBoundingClientRect();
    const parentBox = parent.getBoundingClientRect();
    const nextX = start.offsetX + event.clientX - start.x;
    const nextY = start.offsetY + event.clientY - start.y;
    const maxX = Math.max(140, parentBox.width * 0.42);
    const maxY = Math.max(180, parentBox.height + panelBox.height);
    setOffset({
      x: Math.max(-maxX, Math.min(maxX, nextX)),
      y: Math.max(-maxY, Math.min(maxY, nextY)),
    });
  };

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    dragStart.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const beginResize = (event: ReactPointerEvent<HTMLElement>, corner: ResizeCorner) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeStart.current = { x: event.clientX, y: event.clientY, width: size.width, height: size.height, corner };
    setResizing(true);
  };

  const moveResize = (event: ReactPointerEvent<HTMLElement>) => {
    const start = resizeStart.current;
    const parent = panelRef.current?.parentElement;
    if (!start || !parent) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const fromLeft = start.corner.includes('w');
    const fromTop = start.corner.includes('n');
    const maxWidth = Math.max(minWidth, parent.clientWidth - 32);
    const maxHeight = Math.max(minHeight, Math.max(maxHeightFloor, parent.clientHeight - maxHeightInset));
    const nextWidth = Math.max(minWidth, Math.min(maxWidth, start.width + (fromLeft ? -dx : dx)));
    const nextHeight = Math.max(minHeight, Math.min(maxHeight, start.height + (fromTop ? -dy : dy)));
    setSize({ width: nextWidth, height: nextHeight });
    if (fromLeft || fromTop) {
      setOffset((current) => ({
        x: fromLeft ? current.x + (start.width - nextWidth) : current.x,
        y: fromTop ? current.y + (start.height - nextHeight) : current.y,
      }));
    }
  };

  const endResize = (event: ReactPointerEvent<HTMLElement>) => {
    resizeStart.current = null;
    setResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return {
    panelRef,
    offset,
    size,
    dragging,
    resizing,
    beginDrag,
    moveDrag,
    endDrag,
    beginResize,
    moveResize,
    endResize,
  };
}
