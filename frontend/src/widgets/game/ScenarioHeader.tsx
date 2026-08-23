import { useState } from 'react';
import { CircleHelp, Trophy } from 'lucide-react';
import type { GameState } from '../../types/game';
import { assetUrl } from '../../shared/assetUrl';
import { Progress } from '../ui/Primitives';

export function ScenarioHeader({
  state,
  scenarioName,
  connection,
  referenceId,
  referenceKind = '存档',
  onFocusGoal,
  onOpenHelp,
}: {
  state: GameState;
  scenarioName: string;
  connection: string;
  referenceId?: string;
  referenceKind?: '房间' | '存档';
  onFocusGoal?: (ids: string[]) => void;
  onOpenHelp?: () => void;
}) {
  const [goalsOpen, setGoalsOpen] = useState(false);
  const projects = Object.values(state.projects || {});
  const goal = state.goal_status;
  const completedProjects =
    goal?.core_projects_completed ?? projects.filter((project) => project.status === 'completed').length;
  const phaseLabels: Record<string, string> = {
    round_forecast: '事件预告',
    planning: '规划阶段',
    player_action: '行动阶段',
    pending_choice: '等待回应',
    event_resolution: '事件结算',
    round_summary: '回合总结',
    game_over: '旅程结束',
  };
  const phase = phaseLabels[state.shared.phase] || '当前阶段';
  const victory = goal?.victory_conditions || [];
  const failure = goal?.failure_conditions || [];
  const visibleVictory = victory.filter((item) => item.kind === 'progress');
  const conditionComplete = (item: (typeof victory)[number]) =>
    item.operator === 'lt' || item.id === 'weathering_control'
      ? item.current < item.target
      : item.operator === 'lte'
        ? item.current <= item.target
        : item.current >= item.target;
  const projectTarget = goal?.core_projects_target || 0;
  const primaryGoal =
    visibleVictory.find((item) => item.id === 'core_projects' || item.id === 'core_projects_completed') ||
    visibleVictory[0] ||
    ({ id: 'core_projects', label: '核心项目', current: completedProjects, target: projectTarget || 1 } as (typeof victory)[number]);
  const totalProgress = Math.min(primaryGoal.current, primaryGoal.target);
  const totalTarget = primaryGoal.target;
  const weathering = goal?.weathering ?? state.shared.weathering_track ?? 0;
  const weatheringLimit = goal?.weathering_limit ?? state.shared.weathering_limit ?? 5;
  const conditionRow = (item: (typeof victory)[number], failureCondition = false) => {
    const safe = item.operator === 'lt' || item.operator === 'lte' ? conditionComplete(item) : item.status === 'safe';
    const complete = failureCondition
      ? item.status === 'failed'
      : item.status === 'completed' || conditionComplete(item);
    const related = item.related_labels?.length ? `关联：${item.related_labels.join('、')}` : '';
    const ids = item.related_ids || [];
    return (
      <button
        type="button"
        key={item.id}
        className={`condition-row ${failureCondition ? (item.status === 'failed' ? 'condition-danger' : 'condition-safe') : complete ? 'condition-done' : ''}`}
        disabled={!onFocusGoal || ids.length === 0}
        onClick={() => onFocusGoal?.(ids)}
      >
        <i>{failureCondition ? (item.status === 'failed' ? '!' : safe ? '✓' : '·') : complete ? '✓' : '·'}</i>
        <b>{item.label}</b> {item.current} / {item.target}
        {failureCondition ? (
          <small>{item.status === 'failed' ? '已超限' : `还可承受 ${item.remaining}`}</small>
        ) : (
          item.remaining > 0 && <small>还差 {item.remaining}</small>
        )}
        {related && <small className="condition-related">{related}</small>}
      </button>
    );
  };

  return (
    <header className="game-header">
      <div className="brand-group">
        <a className="brand-mark" href="/" aria-label="返回首页">
          <img src={assetUrl('ornaments/yungang-seal-stamp.webp')} alt="" />
          <span>云冈</span>
        </a>
        <span className="brand-scenario" title={`本局主题：${scenarioName}`}>
          <small>本局主题</small>
          <b>{scenarioName}</b>
        </span>
      </div>

      <div className="header-center">
        <section className="goal-summary" aria-label="胜利摘要">
          <span title={primaryGoal.label || '核心目标'}>{primaryGoal.label || '核心目标'} · {primaryGoal.current} / {primaryGoal.target}</span>
          <span>风化压力 {weathering} / {weatheringLimit}</span>
          <Progress value={totalProgress} max={totalTarget} />
        </section>
      </div>

      <div className="header-actions">
        {referenceId && <span className="game-reference" title="继续这局时使用这个房间码或存档号">{referenceKind} {referenceId}</span>}
        <span className="header-turn">第 {state.shared.turn} 回合</span>
        <span className="header-phase">{phase}</span>
        {connection !== '已连接' && (
          <span className={`sync-state ${connection === '离线' ? 'offline' : ''}`} aria-live="polite">
            <span />
            {connection}
          </span>
        )}
        <button
          type="button"
          className="goal-drawer-toggle"
          aria-expanded={goalsOpen}
          aria-controls="goal-drawer"
          onClick={() => setGoalsOpen((open) => !open)}
        >
          <Trophy size={15} />
          胜利条件
        </button>
        {onOpenHelp && (
          <button type="button" className="help-zone-trigger" aria-label="打开帮助" onClick={onOpenHelp}>
            <CircleHelp size={17} />
          </button>
        )}
      </div>

      {goalsOpen && (
        <aside id="goal-drawer" className="goal-drawer" aria-label="胜利条件清单">
          <div className="goal-drawer-head">
            <b>胜利条件</b>
            <button type="button" aria-label="关闭胜利条件" onClick={() => setGoalsOpen(false)}>
              ✕
            </button>
          </div>
          <div className="goal-conditions">
            <div>
              <b>要完成</b>
              {victory.map((item) => conditionRow(item))}
            </div>
            <div>
              <b>不能超过</b>
              {failure.map((item) => conditionRow(item, true))}
            </div>
          </div>
        </aside>
      )}
    </header>
  );
}
