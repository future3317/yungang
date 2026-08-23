import { Flag, Plus, Users } from 'lucide-react';
import type { Action, GameState, ProjectState, RouteState, Site, SiteReference } from '../../types/game';
import { localizeActionText, resolveTargetName } from './gameUi';
import { Panel } from '../ui/Primitives';

export function PlanningPhase({
  state,
  sites,
  routes = {},
  projects = {},
  actions,
  canAct = true,
  onChoose,
}: {
  state: GameState;
  sites: Record<string, SiteReference>;
  routes?: Record<string, RouteState>;
  projects?: Record<string, ProjectState>;
  actions: Action[];
  canAct?: boolean;
  onChoose: (action: Action) => void;
}) {
  const marksPerRound = state.shared.planning_marks_per_round ?? 1;
  const isTutorial =
    (state.scenario_id || state.shared.scenario_id) === 'tutorial' ||
    (state.shared.effective_rules?.planning_marks_per_round ?? marksPerRound) === 0;
  if (isTutorial || marksPerRound === 0) return null;

  const marks = Object.entries(state.shared.planning_marks || {}).flatMap(([playerId, items]) =>
    items.map((item) => ({ ...item, playerId }))
  );
  const targets = actions.filter((action) => action.type === 'plan' && action.target_id);
  const hasCurrentDeclaration = Boolean(
    state.shared.active_player_id &&
      marks.some(
        (mark) => mark.playerId === state.shared.active_player_id && String(mark.turn) === String(state.shared.turn)
      )
  );
  return (
    <Panel className="planning-phase planning-turn-card" aria-labelledby="planning-title">
      <div className="planning-phase-heading">
        <div>
          <span className="eyebrow">
            <Flag size={14} />
            本回合任务
          </span>
          <h2 id="planning-title">团队意图</h2>
        </div>
        <span>{marks.length} 枚标记</span>
      </div>
      <p>每位同行者每轮可声明一个目标；由另一位同行者接续后触发协作奖励。</p>
      <div className="planning-marks" aria-live="polite">
        {marks.length ? (
          marks.map((mark) => {
            const name = resolveTargetName(mark.target_id, sites, routes, projects);
            const kind = routes[mark.target_id] ? '路线' : projects[mark.target_id] ? '团队项目' : '地点任务';
            const collaborated = Boolean(mark.collaborated);
            const purpose = collaborated
              ? `已接续：行动点返还 1，研究点 +1${routes[mark.target_id] ? '，路线风险 -1' : ''}`
              : '等待另一位同行者接续；未接续不会改变状态';
            return (
              <article key={mark.playerId + '-' + mark.target_id}>
                <b>{state.players[mark.playerId]?.name || '队友'}</b>
                <span>
                  {kind} · {name}
                </span>
                <small>{purpose}</small>
              </article>
            );
          })
        ) : (
          <em>还没有人声明本轮目标</em>
        )}
      </div>
      {!hasCurrentDeclaration && (
        <details className="planning-target-picker">
          <summary>
            <Plus size={14} />
            声明一个本轮目标
          </summary>
          <div className="planning-targets">
            {targets.map((action) => (
              <button key={action.target_id} disabled={!canAct} onClick={() => onChoose(action)}>
                <span>
                  {resolveTargetName(action.target_id, sites, routes, projects) === action.target_id
                    ? localizeActionText(action.label)
                    : resolveTargetName(action.target_id, sites, routes, projects)}
                </span>
                <small>
                  {action.route_id || routes[action.target_id || '']
                    ? '路线 · 接续后额外降低风险'
                    : action.target_id && projects[action.target_id]
                      ? '团队项目 · 接续后获得协作奖励'
                      : '地点任务 · 接续后获得协作奖励'}
                </small>
              </button>
            ))}
          </div>
        </details>
      )}
      {!canAct && (
        <span className="planning-empty">
          <Users size={14} />
          等待当前行动者完成行动，你仍可查看团队目标
        </span>
      )}
    </Panel>
  );
}
