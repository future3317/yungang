import { Flag, Play, SkipForward } from 'lucide-react';
import type { Action, GameState, Site } from '../../types/game';

export function PlanningPhase({ state, sites, actions, onChoose }: { state: GameState; sites: Record<string, Site>; actions: Action[]; onChoose: (action: Action) => void }) {
  const marks = Object.entries(state.shared.planning_marks || {}).flatMap(([playerId, items]) => items.map(item => ({ ...item, playerId })));
  const targets = actions.filter(action => action.type === 'plan' && action.target_id);
  const start = actions.find(action => action.type === 'end_planning');
  return <section className="planning-phase" aria-labelledby="planning-title">
    <div className="planning-phase-heading"><div><span className="eyebrow"><Flag size={14} />本轮协作规划</span><h2 id="planning-title">先标记，再行动</h2></div><span>{marks.length} 枚标记</span></div>
    <p>把注意力放到需要保护的地点、路线或项目上。标记会在开始行动时转成一项小型协作加成，不会消耗行动点。</p>
    <div className="planning-marks" aria-live="polite">{marks.length ? marks.map(mark => <span key={`${mark.playerId}-${mark.target_id}`}>{sites[mark.target_id]?.name || '项目或路线'} · {state.players[mark.playerId]?.name || '队友'}</span>) : <em>还没有人放置标记</em>}</div>
    <div className="planning-targets">{targets.slice(0, 8).map(action => <button key={action.target_id} onClick={() => onChoose(action)}><span>{sites[action.target_id || '']?.name || action.label}</span><small>放置标记</small></button>)}</div>
    {start && <button className="planning-start" onClick={() => onChoose(start)}><Play size={15} />开始行动</button>}
    {!start && <span className="planning-empty"><SkipForward size={14} />等待旅伴完成本轮标记</span>}
  </section>;
}
