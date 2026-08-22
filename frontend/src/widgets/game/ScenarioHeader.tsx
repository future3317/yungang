import { useState } from 'react';
import { GripVertical } from 'lucide-react';
import type { GameState } from '../../types/game';
import { assetUrl } from '../../shared/assetUrl';
import { useDraggablePosition } from '../../shared/useDraggablePosition';
import { Progress } from '../ui/Primitives';

export function ScenarioHeader({ state, scenarioName, connection, gameReference, eventSummary }: { state: GameState; scenarioName: string; connection: string; gameReference?: string; eventSummary?: { name?: string; targets?: string[]; historyCount?: number } }) {
  const [goalsOpen, setGoalsOpen] = useState(false);
  const goalDrag = useDraggablePosition('yungang-goal-hud-position-v2', { minVisibleWidth: 320, minVisibleHeight: 58, boundToParent: true });
  const projects = Object.values(state.projects || {}); const objectives = Object.values(state.objectives || {}); const goal = state.goal_status;
  const completedProjects = goal?.core_projects_completed ?? projects.filter(project => project.status === 'completed').length; const completedObjectives = goal?.objectives_completed ?? objectives.filter(objective => objective.completed).length;
  const phase = state.shared.phase === 'planning' ? '规划阶段' : state.shared.phase === 'pending_choice' ? '等待回应' : '行动阶段';
  const victory = goal?.victory_conditions || [];
  const failure = goal?.failure_conditions || [];
  const visibleVictory = victory.filter(item => item.kind === 'progress');
  const conditionComplete = (item: (typeof victory)[number]) => item.operator === 'lt' || item.id === 'weathering_control' ? item.current < item.target : item.operator === 'lte' ? item.current <= item.target : item.current >= item.target;
  const projectTarget = goal?.core_projects_target || 0;
  const objectiveTarget = goal?.objectives_target || 0;
  const totalProgress = visibleVictory.reduce((sum, item) => sum + Math.min(item.current, item.target), 0);
  const totalTarget = visibleVictory.reduce((sum, item) => sum + item.target, 0) || projectTarget + objectiveTarget;
  const weathering = goal?.weathering ?? state.shared.weathering_track ?? 0;
  const weatheringLimit = goal?.weathering_limit ?? state.shared.weathering_limit ?? 5;
  const summaryLabel = (item: (typeof victory)[number]) => item.id === 'core_project' && item.related_labels?.length ? item.related_labels[0] : item.id === 'objectives' && item.related_labels?.length ? item.related_labels.join('、') : item.label;
  const conditionRow = (item: (typeof victory)[number], failureCondition = false) => {
    const safe = item.operator === 'lt' || item.operator === 'lte' ? conditionComplete(item) : item.status === 'safe';
    const complete = failureCondition ? item.status === 'failed' : item.status === 'completed' || conditionComplete(item);
    const related = item.related_labels?.length ? `关联：${item.related_labels.join('、')}` : '';
    return <span key={item.id} className={failureCondition ? (item.status === 'failed' ? 'condition-danger' : 'condition-safe') : complete ? 'condition-done' : ''}><i>{failureCondition ? (item.status === 'failed' ? '!' : safe ? '✓' : '·') : complete ? '✓' : '·'}</i><b>{item.label}</b> {item.current} / {item.target}{failureCondition ? <small>{item.status === 'failed' ? '已超限' : `还可承受 ${item.remaining}`}</small> : item.remaining > 0 && <small>还差 {item.remaining}</small>}{related && <small className="condition-related">{related}</small>}</span>;
  };
  return <header className="game-header"><div className="brand-group"><a className="brand-mark" href="/" aria-label="返回首页"><img src={assetUrl('ornaments/yungang-seal-stamp.webp')} alt="" /><span>云冈</span></a><span className="brand-scenario" title={`本局主题：${scenarioName}`}><small>本局主题</small><b>{scenarioName}</b></span><div className="event-history-bar top-event-summary" role="status" aria-live="polite"><span className="event-history-kicker">{eventSummary?.name ? '当前事件' : '历史事件'}</span><b>{eventSummary?.name || '旅程事件记录'}</b><span>{eventSummary?.targets?.length ? `影响范围：${eventSummary.targets.join('、')}` : `${eventSummary?.historyCount || 0} 条事件记录`}</span></div></div><div className="header-center"><section className={`goal-hud ${goalsOpen ? 'is-open' : ''}`} data-draggable-surface="true" style={goalDrag.style} aria-label="胜利清单" aria-expanded={goalsOpen}><div className="goal-hud-head"><button type="button" className="goal-drag-handle" aria-label="拖动胜利清单面板" title="拖动调整胜利清单位置" onPointerDown={goalDrag.onPointerDown} onClickCapture={goalDrag.onClickCapture}><GripVertical size={15} aria-hidden="true" /></button><span className="goal-title">胜利清单</span><span className="goal-phase">{phase}</span></div><div className="goal-summary">{visibleVictory.length ? <><span className="goal-progress-summary">胜利条件 {totalProgress} / {totalTarget}</span>{visibleVictory.slice(0, 2).map(item => <span key={item.id}>{summaryLabel(item)} · {item.current} / {item.target}</span>)}</> : <><span>核心项目 {completedProjects} / {projectTarget}</span><span>公共目标 {completedObjectives} / {objectiveTarget}</span></>}<span>风化压力 {weathering} / {weatheringLimit}</span><span>剩余 {goal?.rounds_remaining ?? state.shared.max_rounds - state.shared.turn + 1} 回合</span><Progress value={totalProgress} max={totalTarget} /></div><button className="goal-toggle" type="button" aria-expanded={goalsOpen} aria-controls="goal-conditions" onClick={() => setGoalsOpen(open => !open)}>{goalsOpen ? '收起胜利条件' : '查看胜利条件（全部）'}<span aria-hidden="true">{goalsOpen ? '⌃' : '⌄'}</span></button>{goalsOpen && <div id="goal-conditions" className="goal-conditions" tabIndex={0}><div><b>要完成</b>{victory.map(item => conditionRow(item))}</div><div><b>不能超过</b>{failure.map(item => conditionRow(item, true))}</div></div>}</section></div><div className="header-actions"><span className="header-turn">第 {state.shared.turn} 回合</span>{gameReference && <span className="game-reference" title="这段旅程的编号">编号 {gameReference}</span>}{connection !== '已连接' && <span className={`sync-state ${connection === '离线' ? 'offline' : ''}`} aria-live="polite"><span />{connection}</span>}</div></header>;
}

