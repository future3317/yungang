import { type FormEvent, useState } from 'react';
import { Archive, ArrowRight, BookOpen, Compass, Dice5, Laptop, Users, Wifi } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError, api } from '../../shared/api/client';
import { setRoomToken } from '../../shared/roomToken';
import type { Meta, PlayMode } from '../../types/game';
import '../../styles/lobby.css';
import { ArchiveBrowser } from '../../widgets/archive/ArchiveBrowser';

const difficultyLabels: Record<string, string> = { guided: '引导', normal: '标准', hard: '进阶', expert: '专家' };

const modeNotes: Record<PlayMode, string> = {
  solo: '一人掌舵两位角色，完整体验一局旅程。',
  local: '同一台设备轮流交接席位，共同推进线索。',
  multi_device: '创建房间后分享房间码，各自守护自己的席位。',
};

const scenarioEffectLabels: Record<string, string> = {
  move_planning_mark_adjacent: '修护节点后，可把一个团队计划移到相邻节点',
  gain_clue_if_distinct_players: '不同玩家共同贡献时，额外获得研究线索',
  next_player_move_discount: '建立连接后，下一位玩家首次移动更省行动点',
  reduce_weathering_if_stage_and_route: '阶段推进并修复路线后，降低风化压力',
  increase_weathering: '每轮结束增加环境压力',
  gain_clue: '寻访更容易获得研究线索',
};

function eventIntensityLabel(value: number | undefined) {
  if (value === undefined) return '按场景调整';
  if (value < 0.9) return '较低';
  if (value > 1.05) return '较高';
  return '标准';
}

function scenarioTriggerLabel(trigger: string | undefined) {
  const labels: Record<string, string> = {
    after_restore: '完成修护后',
    after_interpret_evidence: '完成证据研判后',
    after_establish_connection: '建立区域连接后',
    after_explore: '完成寻访后',
    round_end: '回合结束时',
  };
  return trigger ? labels[trigger] || '完成相应行动后' : '';
}

export function LandingPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<PlayMode>('solo');
  const [count, setCount] = useState(2);
  const [difficulty, setDifficulty] = useState('guided');
  const [scenario, setScenario] = useState('sand_and_stone');
  const [seedText, setSeedText] = useState('');
  const [showSeed, setShowSeed] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  const [archivesOpen, setArchivesOpen] = useState(false);
  const { data: meta, isError } = useQuery<Meta>({ queryKey: ['meta'], queryFn: api.meta });
  const scenarios = meta?.scenarios || [];
  const difficulties = meta?.difficulty || [];
  const selectedScenario = scenarios.find(item => item.id === scenario);
  const selectedDifficulty = difficulties.find(item => item.id === difficulty);
  const effectiveRules = meta?.effective_rules_preview?.[`${scenario}:${difficulty}:${mode}`];
  const effectiveMaxRounds = Number(effectiveRules?.max_rounds ?? selectedDifficulty?.max_rounds ?? selectedScenario?.max_rounds ?? 0);
  const effectiveRestoration = Number(effectiveRules?.restoration_resource ?? selectedDifficulty?.restoration_resource ?? 0);
  const effectiveEventWeight = Number(effectiveRules?.event_weight ?? selectedDifficulty?.event_weight);
  const effectivePreviewCount = Number(effectiveRules?.event_preview_count ?? selectedDifficulty?.event_preview_count ?? 1);
  const effectiveSoloAp = Number(effectiveRules?.solo_ap_bonus ?? (mode === 'solo' ? selectedDifficulty?.solo_ap_bonus ?? 0 : 0));
  const recommendedMinutes = String(selectedScenario?.recommended_minutes || '20–35').replace(/\s*分钟/g, '');

  async function create(event: FormEvent) {
    event.preventDefault();
    setCreateError('');
    setBusy(true);
    try {
      const result = await api.createRoom({ play_mode: mode, name: name.trim() || '同行者', scenario_id: scenario, difficulty_id: difficulty, max_players: mode === 'solo' ? 2 : count, ...(seedText.trim() ? { seed: Number(seedText) || 1 } : {}) });
      setRoomToken(result.room.room_id, result.seat_token);
      navigate(`/room/${result.room.room_id}`);
    } catch (error) {
      setCreateError(error instanceof ApiError ? error.message : '旅程暂时无法创建，请检查服务后重试。');
    } finally {
      setBusy(false);
    }
  }

  function resume() {
    const value = roomCode.trim();
    if (!value) return;
    if (value.startsWith('room-') || /^[a-f0-9]{8,16}$/i.test(value)) {
      navigate(`/room/${value.startsWith('room-') ? value : `room-${value}`}`);
    } else {
      navigate(`/game/${value}`);
    }
  }

  return <main className="landing"><div className="landing-copy"><div className="eyebrow">云冈 · 数字遗产协作体验</div><h1>石窟<br /><em>光谱</em></h1><p>一张会随着探索、修护与协作逐步显影的文化关系图。让散落在时间中的证据重新彼此照见。</p><div className="landing-facts"><span><Compass />{recommendedMinutes} 分钟</span><span><Users />1-4 位同行者</span><span><BookOpen />共同修复遗产网络</span></div></div><section className="start-panel" aria-labelledby="start-title"><div className="panel-kicker">点亮一段共同旅程</div><h2 id="start-title">从一束光开始</h2><p>{isError ? '场景资料暂时离席，仍可使用默认旅程。' : '选择同行方式、场景与难度，随后在准备厅确认角色与席位。'}</p>{createError && <div className="landing-feedback" role="alert">{createError}<button type="button" onClick={() => setCreateError('')}>知道了</button></div>}<form onSubmit={create}><label htmlFor="player-name">你的名字<input id="player-name" className="player-name-input" value={name} maxLength={24} onChange={event => setName(event.target.value)} placeholder="例如：林工" /></label><fieldset className="play-mode-picker"><legend>同行方式</legend><div className="play-mode-options">{(['solo', 'local', 'multi_device'] as PlayMode[]).map(item => <button type="button" key={item} className={mode === item ? 'selected' : ''} onClick={() => setMode(item)} aria-pressed={mode === item}><span>{item === 'solo' ? <Compass /> : item === 'local' ? <Laptop /> : <Wifi />}</span><b>{item === 'solo' ? '单人旅程' : item === 'local' ? '本地协作' : '多设备房间'}</b><small>{modeNotes[item]}</small></button>)}</div></fieldset>{mode !== 'solo' && <label>房间席位<div className="segmented">{[2, 3, 4].map(value => <button type="button" key={value} className={count === value ? 'selected' : ''} onClick={() => setCount(value)} aria-pressed={count === value}>{value} 位</button>)}</div></label>}<section className="scenario-picker"><div className="scenario-heading"><span>旅程场景</span><small>不同路线压力与共同目标</small></div><div className="scenario-options">{scenarios.map(item => <button type="button" key={item.id} className={scenario === item.id ? 'selected' : ''} onClick={() => setScenario(item.id)} aria-pressed={scenario === item.id}><b>{item.name}</b><small>{item.description || '一段等待被重新连起的遗产旅程。'}</small><em>胜利：{item.victory_brief || '完成共同目标并保持网络开放。'}</em><small>失败：{item.failure_brief || '回合耗尽或风化压力失控。'}</small><i>{item.recommended_players?.length ? '推荐 ' + item.recommended_players.join('、') + ' 人 · ' : ''}{item.recommended_minutes || '时长待定'} · {item.max_rounds || '—'} 回合</i></button>)}</div>{selectedScenario && <div className="scenario-detail"><b>这局怎么玩</b><span>{selectedScenario.scenario_rule?.description || '探索、互证与修护共同推进这段旅程。'}</span><small>特殊规则：{scenarioEffectLabels[selectedScenario.scenario_rule?.effect?.type || ''] || '按行动和事件逐步显影。'}{selectedScenario.scenario_rule?.trigger ? '（触发：' + scenarioTriggerLabel(selectedScenario.scenario_rule.trigger) + '）' : ''}</small></div>}</section><label>旅程难度<select value={difficulty} onChange={event => setDifficulty(event.target.value)}>{difficulties.map(item => <option key={item.id} value={item.id}>{item.name || difficultyLabels[item.id] || '未标注难度'}</option>)}</select>{selectedDifficulty && <div className="difficulty-detail"><small>{selectedDifficulty.description}</small><div><span>{effectiveMaxRounds} 回合</span><span>{effectiveRestoration} 点团队修护资源</span><span>事件强度 {eventIntensityLabel(effectiveEventWeight)}</span><span>预览 {effectivePreviewCount} 个事件目标</span>{mode === 'solo' && <span>单人额外 +{effectiveSoloAp} AP</span>}</div><em>{selectedDifficulty.recommended_experience || '按自己的节奏体验'}</em></div>}</label><button type="button" className="advanced-toggle" onClick={() => setShowSeed(value => !value)} aria-expanded={showSeed}><Dice5 size={15} />旅程种子：{showSeed ? '收起' : '高级设置'}</button>{showSeed && <label htmlFor="seed">可复现种子<input id="seed" inputMode="numeric" value={seedText} onChange={event => setSeedText(event.target.value)} placeholder="留空则由旅程决定" /></label>}<button className="primary-cta" disabled={busy}>{busy ? '正在点亮路线…' : '进入准备厅'}<ArrowRight /></button></form><div className="resume"><label htmlFor="room-code">回到已有旅程或房间</label><div><input id="room-code" value={roomCode} onChange={event => setRoomCode(event.target.value)} placeholder="输入房间码或旅程编号" /><button type="button" disabled={!roomCode.trim()} onClick={resume}>进入</button></div></div><div className="resume-actions"><button type="button" className="archive-browser-trigger" onClick={() => setArchivesOpen(true)}><Archive size={15} />浏览历史归档</button></div>{archivesOpen && <ArchiveBrowser meta={meta} onClose={() => setArchivesOpen(false)} />}</section></main>;
}


