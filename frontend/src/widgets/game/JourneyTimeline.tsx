import { ChevronDown, Clock3, GripVertical } from 'lucide-react';
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { StateChangeList } from './StateChangeList';
import { metricLabel } from './gameUi';

type TimelineChange = {
  label?: string;
  before?: string | number | null;
  after?: string | number | null;
  delta?: number | null;
};
type TimelineEntry = {
  id: string;
  round: number;
  type: string;
  message: string;
  player_name?: string;
  effects?: unknown[];
  changes?: unknown[];
};

function structuredEffects(effects: unknown[] | undefined): TimelineChange[] {
  return (effects || [])
    .filter((effect): effect is Record<string, unknown> => Boolean(effect) && typeof effect === 'object')
    .map((effect) => ({
      label:
        typeof effect.label === 'string'
          ? effect.label
          : typeof effect.metric === 'string'
            ? metricLabel(effect.metric)
            : typeof effect.key === 'string'
              ? metricLabel(effect.key)
              : undefined,
      before: typeof effect.before === 'string' || typeof effect.before === 'number' ? effect.before : null,
      after: typeof effect.after === 'string' || typeof effect.after === 'number' ? effect.after : null,
      delta: typeof effect.delta === 'number' ? effect.delta : null,
    }))
    .filter((effect) => effect.label || effect.before !== null || effect.after !== null || effect.delta !== null);
}
type TimelineFilter = 'all' | 'action' | 'event' | 'project' | 'choice' | 'system';

const filters: Array<{ id: TimelineFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'action', label: '行动' },
  { id: 'event', label: '事件' },
  { id: 'project', label: '团队项目' },
  { id: 'choice', label: '共同决定' },
  { id: 'system', label: '旅程记录' },
];
const entryTypeLabels: Record<string, string> = {
  action: '行动',
  event: '事件',
  project: '团队项目',
  choice: '共同决定',
  system: '旅程记录',
};

export function JourneyTimeline({ entries }: { entries: TimelineEntry[] }) {
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const visibleEntries = entries.filter((entry) => filter === 'all' || entry.type === filter).reverse();

  const beginDrag = (event: ReactPointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y };
    setDragging(true);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (!dragStart.current) return;
    setOffset({
      x: dragStart.current.offsetX + event.clientX - dragStart.current.x,
      y: dragStart.current.offsetY + event.clientY - dragStart.current.y,
    });
  };
  const endDrag = (event: ReactPointerEvent<HTMLSpanElement>) => {
    dragStart.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <details
      className={`timeline-drawer ${dragging ? 'is-dragging' : ''}`}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
    >
      <summary aria-label="旅程时间线">
        <span
          className="timeline-drag-handle"
          aria-label="拖动旅行时间线"
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <GripVertical size={16} aria-hidden="true" />
        </span>
        <Clock3 size={15} aria-hidden="true" />
        <span>旅程时间线</span>
        <small>{entries.length} 条记录</small>
        <ChevronDown size={15} aria-hidden="true" />
      </summary>
      <div className="timeline-body">
        <div className="timeline-filter" role="tablist" aria-label="时间线筛选">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="timeline-events" aria-live="polite">
          {visibleEntries.length ? (
            visibleEntries.map((entry, index) => (
              <p key={`${entry.id}-${index}`}>
                <b>
                  回合 {entry.round}
                  <small>{entryTypeLabels[entry.type] || '旅程记录'}</small>
                </b>
                <span>
                  {entry.player_name ? `${entry.player_name} · ` : ''}
                  {entry.message}
                  <StateChangeList compact changes={structuredEffects(entry.effects || entry.changes)} />
                </span>
              </p>
            ))
          ) : (
            <p className="timeline-empty">这个筛选下还没有记录。</p>
          )}
        </div>
      </div>
    </details>
  );
}
