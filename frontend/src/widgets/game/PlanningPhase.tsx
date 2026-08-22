import { Flag, Plus, Users } from 'lucide-react';
import type { Action, GameState, ProjectState, RouteState, Site } from '../../types/game';
import { localizeActionText, resolveTargetName } from './gameUi';

export function PlanningPhase({ state, sites, routes = {}, projects = {}, actions, canAct = true, onChoose }: { state: GameState; sites: Record<string, Site>; routes?: Record<string, RouteState>; projects?: Record<string, ProjectState>; actions: Action[]; canAct?: boolean; onChoose: (action: Action) => void }) {
  const marks = Object.entries(state.shared.planning_marks || {}).flatMap(([playerId, items]) => items.map(item => ({ ...item, playerId })));
  const targets = actions.filter(action => action.type === 'plan' && action.target_id);
  return <section className="planning-phase" aria-labelledby="planning-title">
    <div className="planning-phase-heading"><div><span className="eyebrow"><Flag size={14} />团队意图板</span><h2 id="planning-title">这轮准备处理什么</h2></div><span>{marks.length} 枚标记</span></div>
    <p>每位同行者可以声明一个目标。其他人完成同一目标时，计划会转成地点、路线或项目协作加成，不消耗行动点。</p>
    <div className="planning-marks" aria-live="polite">{marks.length ? marks.map(mark => { const name = resolveTargetName(mark.target_id, sites, routes, projects); const kind = routes[mark.target_id] ? '路线' : projects[mark.target_id] ? '项目' : '地点'; const purpose = routes[mark.target_id] ? '降低路线风险' : projects[mark.target_id] ? '推进当前阶段' : '增加地点协作影响'; return <article key={mark.playerId + '-' + mark.target_id}><b>{state.players[mark.playerId]?.name || '队友'}</b><span>{kind} · {name}</span><small>预计作用：{purpose}</small></article>; }) : <em>还没有人声明本轮目标</em>}</div>
    <details className="planning-target-picker"><summary><Plus size={14} />声明一个本轮目标</summary><div className="planning-targets">{targets.map(action => <button key={action.target_id} disabled={!canAct} onClick={() => onChoose(action)}><span>{resolveTargetName(action.target_id, sites, routes, projects) === action.target_id ? localizeActionText(action.label) : resolveTargetName(action.target_id, sites, routes, projects)}</span><small>{action.route_id || routes[action.target_id || ''] ? '路线 · 降低风险' : action.target_id && projects[action.target_id] ? '项目 · 推进阶段' : '地点 · 增加协作'}</small></button>)}</div></details>
    {!canAct && <span className="planning-empty"><Users size={14} />等待当前行动者完成行动，你仍可查看团队目标</span>}
  </section>;
}
