import { useState } from 'react';
import type { GameState } from '../../types/game';
import { assetUrl } from '../../shared/assetUrl';

function Progress({ value, max }: { value: number; max: number }) { return <div className="progress gold"><span style={{ width: `${Math.min(100, max ? value / max * 100 : 0)}%` }} /></div>; }

export function ScenarioHeader({ state, scenarioName, connection }: { state: GameState; scenarioName: string; connection: string }) {
  const [goalsOpen, setGoalsOpen] = useState(false);
  const projects = Object.values(state.projects || {}); const objectives = Object.values(state.objectives || {}); const goal = state.goal_status;
  const completedProjects = goal?.core_projects_completed ?? projects.filter(project => project.status === 'completed').length; const completedObjectives = goal?.objectives_completed ?? objectives.filter(objective => objective.completed).length;
  const phase = state.shared.phase === 'planning' ? '规划阶段' : state.shared.phase === 'pending_choice' ? '等待回应' : '行动阶段';
  const victory = goal?.victory_conditions || [];
  const failure = goal?.failure_conditions || [];
  const visibleVictory = victory.filter(item => item.kind === 'progress');
  const conditionComplete = (item: (typeof victory)[number]) => item.operator === 'lt' || item.id === 'weathering_control' ? item.current < item.target : item.current >= item.target;
  const projectTarget = goal?.core_projects_target || 0;
  const objectiveTarget = goal?.objectives_target || 0;
  const totalProgress = completedProjects + completedObjectives;
  const totalTarget = projectTarget + objectiveTarget;
  const weathering = goal?.weathering ?? state.shared.weathering_track ?? 0;
  const weatheringLimit = goal?.weathering_limit ?? state.shared.weathering_limit ?? 5;
  const conditionRow = (item: (typeof victory)[number], failureCondition = false) => {
    const complete = failureCondition ? item.current >= item.target : conditionComplete(item);
    return <span key={item.id} className={complete ? (failureCondition ? 'condition-danger' : 'condition-done') : ''}><i>{complete ? (failureCondition ? '!' : '✓') : '·'}</i>{item.label} {item.current} / {item.target}{item.id === 'weathering_control' ? <small>上限以内</small> : item.remaining > 0 && <small>{failureCondition ? `余量 ${item.remaining}` : `还差 ${item.remaining}`}</small>}</span>;
  };
  return <header className="game-header"><div className="brand-group"><a className="brand-mark" href="/" aria-label="返回首页"><img src={assetUrl('ornaments/yungang-seal-stamp.png')} alt="" /><span>石窟<strong>光谱</strong></span></a><span className="brand-scenario" title={`当前主题：${scenarioName}`}><small>当前主题</small><b>{scenarioName}</b></span></div><div className="header-center"><div className={`goal-hud ${goalsOpen ? 'is-open' : ''}`} aria-label="共同目标进度"><div className="goal-hud-head"><span className="goal-title">共同目标</span><span className="goal-phase">第 {state.shared.turn} / {state.shared.max_rounds} 回合 · {phase}</span></div><div className="goal-summary">{visibleVictory.length ? visibleVictory.slice(0, 2).map(item => <span key={item.id}>{item.label} {item.current} / {item.target}</span>) : <><span>核心项目 {completedProjects} / {projectTarget}</span><span>公共目标 {completedObjectives} / {objectiveTarget}</span></>}<span>风化压力 {weathering} / {weatheringLimit}</span><span>剩余 {goal?.rounds_remaining ?? state.shared.max_rounds - state.shared.turn + 1} 回合</span><Progress value={totalProgress} max={totalTarget} /></div><button className="goal-toggle" type="button" aria-expanded={goalsOpen} aria-controls="goal-conditions" onClick={() => setGoalsOpen(open => !open)}>{goalsOpen ? '收起胜利条件' : '查看胜利条件'}<span aria-hidden="true">{goalsOpen ? '⌃' : '⌄'}</span></button>{goalsOpen && <div id="goal-conditions" className="goal-conditions" tabIndex={0}><div><b>要完成</b>{victory.map(item => conditionRow(item))}</div><div><b>不能超过</b>{failure.map(item => conditionRow(item, true))}</div></div>}</div></div><div className="header-actions">{connection !== '已连接' && <span className={`sync-state ${connection === '离线' ? 'offline' : ''}`} aria-live="polite"><span />{connection}</span>}</div></header>;
}
