import { useState } from 'react';
import { CircleHelp, Trophy } from 'lucide-react';
import type { GameState } from '../../types/game';
import { assetUrl } from '../../shared/assetUrl';
import { Progress } from '../ui/Primitives';

export function ScenarioHeader({
  state,
  scenarioName,
  connection,
  gameReference,
  eventSummary,
  onFocusGoal,
  onOpenHelp,
}: {
  state: GameState;
  scenarioName: string;
  connection: string;
  gameReference?: string;
  eventSummary?: { name?: string; targets?: string[]; historyCount?: number };
  onFocusGoal?: (ids: string[]) => void;
  onOpenHelp?: () => void;
}) {
  const [goalsOpen, setGoalsOpen] = useState(false);
  const projects = Object.values(state.projects || {});
  const objectives = Object.values(state.objectives || {});
  const goal = state.goal_status;
  const completedProjects =
    goal?.core_projects_completed ?? projects.filter((project) => project.status === 'completed').length;
  const completedObjectives =
    goal?.objectives_completed ?? objectives.filter((objective) => objective.completed).length;
  const phase =
    state.shared.phase === 'planning' ? '规划阶段' : state.shared.phase === 'pending_choice' ? '等待回应' : '行动阶段';
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
  const objectiveTarget = goal?.objectives_target || 0;
  const totalProgress = visibleVictory.reduce((sum, item) => sum + Math.min(item.current, item.target), 0);
  const totalTarget = visibleVictory.reduce((sum, item) => sum + item.target, 0) || projectTarget + objectiveTarget;
  const weathering = goal?.weathering ?? state.shared.weathering_track ?? 0;
  const weatheringLimit = goal?.weathering_limit ?? state.shared.weathering_limit ?? 5;
  const summaryLabel = (item: (typeof victory)[number]) =>
    item.id === 'core_project' && item.related_labels?.length
      ? item.related_labels[0]
      : item.id === 'objectives' && item.related_labels?.length
        ? item.related_labels.join('、')
        : item.label;
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

  const summaryItems = visibleVictory.length
    ? [
        `胜利条件 ${totalProgress} / ${totalTarget}`,
        ...visibleVictory.slice(0, 2).map((item) => `${summaryLabel(item)} · ${item.current} / ${item.target}`),
      ]
    : [
        `核心团队项目 ${completedProjects} / ${projectTarget}`,
        `胜利目标 ${completedObjectives} / ${objectiveTarget}`,
      ];

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
        <div className="event-history-bar top-event-summary" role="status" aria-live="polite">
          <span className="event-history-kicker">{eventSummary?.name ? '当前事件' : '历史事件'}</span>
          <b>{eventSummary?.name || '旅程事件记录'}</b>
          <span>
            {eventSummary?.targets?.length
              ? `影响范围：${eventSummary.targets.join('、')}`
              : `${eventSummary?.historyCount || 0} 条事件记录`}
          </span>
        </div>
        <section className="goal-summary" aria-label="胜利摘要">
          {summaryItems.map((text) => (
            <span key={text}>{text}</span>
          ))}
          <span>
            风化压力 {weathering} / {weatheringLimit}
          </span>
          <span>剩余 {goal?.rounds_remaining ?? state.shared.max_rounds - state.shared.turn + 1} 回合</span>
          <Progress value={totalProgress} max={totalTarget} />
        </section>
      </div>

      <div className="header-actions">
        <span className="header-turn">第 {state.shared.turn} 回合</span>
        <span className="header-phase">{phase}</span>
        {gameReference && (
          <span className="game-reference" title="这段旅程的编号">
            编号 {gameReference}
          </span>
        )}
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
