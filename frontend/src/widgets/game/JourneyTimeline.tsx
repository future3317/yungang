import { ChevronDown, Clock3 } from 'lucide-react';
import { assetUrl } from '../../shared/assetUrl';
import { useState } from 'react';
import { useDraggablePosition } from '../../shared/useDraggablePosition';
import { StateChangeList } from './StateChangeList';
import { metricLabel } from './gameUi';

type TimelineChange = { label?: string; before?: string | number | null; after?: string | number | null; delta?: number | null };
type TimelineEntry = { id: string; round: number; type: string; message: string; player_name?: string; effects?: unknown[] };

function structuredEffects(effects: unknown[] | undefined): TimelineChange[] {
  return (effects || []).filter((effect): effect is Record<string, unknown> => Boolean(effect) && typeof effect === 'object').map(effect => ({
    label: typeof effect.label === 'string' ? effect.label : typeof effect.metric === 'string' ? metricLabel(effect.metric) : typeof effect.key === 'string' ? metricLabel(effect.key) : undefined,
    before: typeof effect.before === 'string' || typeof effect.before === 'number' ? effect.before : null,
    after: typeof effect.after === 'string' || typeof effect.after === 'number' ? effect.after : null,
    delta: typeof effect.delta === 'number' ? effect.delta : null,
  })).filter(effect => effect.label || effect.before !== null || effect.after !== null || effect.delta !== null);
}
type TimelineFilter = 'all' | 'action' | 'event' | 'project' | 'choice' | 'system';

const filters: Array<{ id: TimelineFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'action', label: '行动' },
  { id: 'event', label: '事件' },
  { id: 'project', label: '项目' },
  { id: 'choice', label: '共同决定' },
  { id: 'system', label: '旅程记录' },
];
const entryTypeLabels: Record<string, string> = { action: '行动', event: '事件', project: '项目', choice: '共同决定', system: '旅程记录' };

export function JourneyTimeline({ entries }: { entries: TimelineEntry[] }) {
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const drag = useDraggablePosition('yungang-journey-timeline-position-v2', { minVisibleWidth: 190, minVisibleHeight: 64, boundToParent: true });
  const visibleEntries = entries.filter(entry => filter === 'all' || entry.type === filter).reverse();

  return <details className="timeline-drawer is-draggable" data-draggable-surface="true" style={drag.style} open>
    <summary onPointerDown={drag.onPointerDown} onClickCapture={drag.onClickCapture} aria-label="旅程时间线；拖动标题栏调整位置"><Clock3 size={15} aria-hidden="true" /><span>旅程时间线</span><img className="timeline-drag-handle" src={assetUrl('game-ui/handles/ui_yungang_timeline_handle_01.webp')} alt="拖动旅程时间线" /><small>{entries.length} 条记录</small><ChevronDown size={15} aria-hidden="true" /></summary>
    <div className="timeline-body">
      <div className="timeline-filter" role="tablist" aria-label="时间线筛选">
        {filters.map(item => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}
      </div>
      <div className="timeline-events" aria-live="polite">
        {visibleEntries.length ? visibleEntries.map((entry, index) => <p key={`${entry.id}-${index}`}><b>回合 {entry.round}<small>{entryTypeLabels[entry.type] || '旅程记录'}</small></b><span>{entry.player_name ? `${entry.player_name} · ` : ''}{entry.message}<StateChangeList compact changes={structuredEffects(entry.effects)} /></span></p>) : <p className="timeline-empty">这个筛选下还没有记录。</p>}
      </div>
    </div>
  </details>;
}
