import { ChevronDown, Clock3 } from 'lucide-react';
import { useState } from 'react';
import { useDraggablePosition } from '../../shared/useDraggablePosition';

type TimelineEntry = { id: string; round: number; type: string; message: string };
type TimelineFilter = 'all' | 'action' | 'event' | 'project';

const filters: Array<{ id: TimelineFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'action', label: '行动' },
  { id: 'event', label: '事件' },
  { id: 'project', label: '项目' },
];

export function JourneyTimeline({ entries }: { entries: TimelineEntry[] }) {
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const drag = useDraggablePosition('yungang-journey-timeline-position', { minVisibleWidth: 190, minVisibleHeight: 64 });
  const visibleEntries = entries.filter(entry => filter === 'all' || entry.type === filter).slice(-8).reverse();

  return <details className="timeline-drawer" style={drag.style}>
    <summary onPointerDown={drag.onPointerDown} onClickCapture={drag.onClickCapture} aria-label="旅程时间线；拖动标题栏调整位置"><Clock3 size={15} aria-hidden="true" /><span>旅程时间线</span><img className="timeline-drag-handle" src="/ui-assets/game-ui/handles/ui_yungang_timeline_handle_01.png" alt="" /><small>{entries.length} 条记录</small><ChevronDown size={15} aria-hidden="true" /></summary>
    <div className="timeline-body">
      <div className="timeline-filter" role="tablist" aria-label="时间线筛选">
        {filters.map(item => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}
      </div>
      <div className="timeline-events" aria-live="polite">
        {visibleEntries.length ? visibleEntries.map((entry, index) => <p key={`${entry.id}-${index}`}><b>回合 {entry.round}</b><span>{entry.message}</span></p>) : <p className="timeline-empty">这个筛选下还没有记录。</p>}
      </div>
    </div>
  </details>;
}
