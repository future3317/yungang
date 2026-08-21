import { Flag, Play, SkipForward } from 'lucide-react';
import type { Action, GameState, ProjectState, RouteState, Site } from '../../types/game';
import { localizeActionText, resolveTargetName } from './gameUi';

export function PlanningPhase({ state, sites, routes = {}, projects = {}, actions, onChoose }: { state: GameState; sites: Record<string, Site>; routes?: Record<string, RouteState>; projects?: Record<string, ProjectState>; actions: Action[]; onChoose: (action: Action) => void }) {
  const marks = Object.entries(state.shared.planning_marks || {}).flatMap(([playerId, items]) => items.map(item => ({ ...item, playerId })));
  const targets = actions.filter(action => action.type === 'plan' && action.target_id);
  const start = actions.find(action => action.type === 'end_planning');
  return <section className="planning-phase" aria-labelledby="planning-title">
    <div className="planning-phase-heading"><div><span className="eyebrow"><Flag size={14} />本轮协作规划</span><h2 id="planning-title">先标记，再行动</h2></div><span>{marks.length} 枚标记</span></div>
    <p>把注意力放到需要保护的地点、路线或项目上。标记会在开始行动时转成一项小型协作加成，不会消耗行动点。</p>
    <div className="planning-marks" aria-live="polite">{marks.length ? marks.map(mark => { const name = resolveTargetName(mark.target_id, sites, routes, projects); const kind = routes[mark.target_id] ? '路线' : projects[mark.target_id] ? '项目' : '地点'; const purpose = routes[mark.target_id] ? '降低路线风险' : projects[mark.target_id] ? '推进当前阶段' : '增加地点协作影响'; return <article key={`${mark.playerId}-${mark.target_id}`}><b>{state.players[mark.playerId]?.name || '队友'}</b><span>{kind} · {name}</span><small>预计作用：{purpose}</small></article>; }) : <em>还没有人放置标记</em>}</div>
    <div className="planning-targets">{targets.map(action => <button key={action.target_id} onClick={() => onChoose(action)}><span>{resolveTargetName(action.target_id, sites, routes, projects) === action.target_id ? localizeActionText(action.label) : resolveTargetName(action.target_id, sites, routes, projects)}</span><small>{action.route_id || routes[action.target_id || ''] ? '标记路线' : action.target_id && projects[action.target_id] ? '标记项目' : '标记地点'}</small></button>)}</div>
    {start && <button className="planning-start" onClick={() => onChoose(start)}><Play size={15} />开始行动</button>}
    {!start && <span className="planning-empty"><SkipForward size={14} />等待旅伴完成本轮标记</span>}
  </section>;
}
