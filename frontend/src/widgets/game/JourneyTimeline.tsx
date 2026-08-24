import { ChevronDown, Clock3, GripVertical } from 'lucide-react';
import { Rnd } from 'react-rnd';
import { useState } from 'react';
import { StateChangeList } from './StateChangeList';
import { metricLabel } from './gameUi';
import styles from './JourneyTimeline.module.css';

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
  const [open, setOpen] = useState(true);
  const [size, setSize] = useState({ width: 560, height: 300 });
  const [interacting, setInteracting] = useState(false);
  const visibleEntries = entries.filter((entry) => filter === 'all' || entry.type === filter).reverse();

  return (
    <Rnd
      className={`${styles.rnd} ${interacting ? styles.dragging : ''}`.trim()}
      bounds="parent"
      default={{ x: 16, y: 16, width: size.width, height: size.height }}
      size={{ width: size.width, height: open ? size.height : 44 }}
      minWidth={320}
      minHeight={180}
      maxWidth="90%"
      maxHeight="80%"
      enableResizing={open}
      dragHandleClassName={styles.dragHandle}
      onDragStart={() => setInteracting(true)}
      onDragStop={() => setInteracting(false)}
      onResizeStart={() => setInteracting(true)}
      onResizeStop={(_, __, ref) => {
        setSize({ width: ref.offsetWidth, height: ref.offsetHeight });
        setInteracting(false);
      }}
    >
      <details className={styles.drawer} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary className={styles.summary} aria-label="旅程时间线">
        <span
          className={styles.dragHandle}
          aria-label="拖动旅行时间线"
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
        <div className={styles.body}>
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
                <article className={styles.entry} key={`${entry.id}-${index}`}>
                  <b>
                    回合 {entry.round}
                    <small>{entryTypeLabels[entry.type] || '旅程记录'}</small>
                  </b>
                  <span>
                    {entry.player_name ? `${entry.player_name} · ` : ''}
                    {entry.message}
                    <StateChangeList compact changes={structuredEffects(entry.effects || entry.changes)} />
                  </span>
                </article>
              ))
            ) : (
              <p className="timeline-empty">这个筛选下还没有记录。</p>
            )}
          </div>
        </div>
      </details>
    </Rnd>
  );
}
