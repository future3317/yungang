import { type FormEvent, useState } from 'react';
import { ArrowRight, BookOpen, Compass, Dice5, Laptop, Users, Wifi } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import type { Meta, PlayMode } from '../../types/game';
import '../../styles/lobby.css';

const modeNotes: Record<PlayMode, string> = {
  solo: '一人掌舵两位角色，完整体验一局旅程。',
  local: '同一台设备轮流交接席位，共同推进线索。',
  multi_device: '创建房间后分享房间码，各自守护自己的席位。',
};

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
  const { data: meta, isError } = useQuery<Meta>({ queryKey: ['meta'], queryFn: api.meta });
  const scenarios = meta?.scenarios || [];
  const difficulties = meta?.difficulty || [];

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api.createRoom({ play_mode: mode, name: name.trim() || '同行者', scenario_id: scenario, difficulty_id: difficulty, max_players: mode === 'solo' ? 2 : count, ...(seedText.trim() ? { seed: Number(seedText) || 1 } : {}) });
      window.sessionStorage.setItem(`yungang-room-token:${result.room.room_id}`, result.seat_token);
      navigate(`/room/${result.room.room_id}`);
    } finally {
      setBusy(false);
    }
  }

  function resume() {
    const value = roomCode.trim();
    if (!value) return;
    if (value.startsWith('room-')) navigate(`/room/${value}`);
    else navigate(`/game/${value}`);
  }

  return <main className="landing"><div className="landing-copy"><div className="eyebrow">云冈 · 数字遗产协作体验</div><h1>石窟<br /><em>光谱</em></h1><p>一张会随着探索、修护与协作逐步显影的文化关系图。让散落在时间中的证据重新彼此照见。</p><div className="landing-facts"><span><Compass />15-25 分钟</span><span><Users />1-4 位同行者</span><span><BookOpen />共同修复遗产网络</span></div></div><section className="start-panel" aria-labelledby="start-title"><div className="panel-kicker">点亮一段共同旅程</div><h2 id="start-title">从一束光开始</h2><p>{isError ? '场景资料暂时离席，仍可使用默认旅程。' : '选择同行方式、场景与难度，随后在准备厅确认角色与席位。'}</p><form onSubmit={create}><label htmlFor="player-name">你的名字<input id="player-name" className="player-name-input" value={name} maxLength={24} onChange={event => setName(event.target.value)} placeholder="例如：林工" /></label><fieldset className="play-mode-picker"><legend>同行方式</legend><div className="play-mode-options">{(['solo', 'local', 'multi_device'] as PlayMode[]).map(item => <button type="button" key={item} className={mode === item ? 'selected' : ''} onClick={() => setMode(item)} aria-pressed={mode === item}><span>{item === 'solo' ? <Compass /> : item === 'local' ? <Laptop /> : <Wifi />}</span><b>{item === 'solo' ? '单人旅程' : item === 'local' ? '本地协作' : '多设备房间'}</b><small>{modeNotes[item]}</small></button>)}</div></fieldset>{mode !== 'solo' && <label>房间席位<div className="segmented">{[2, 3, 4].map(value => <button type="button" key={value} className={count === value ? 'selected' : ''} onClick={() => setCount(value)} aria-pressed={count === value}>{value} 位</button>)}</div></label>}<section className="scenario-picker"><div className="scenario-heading"><span>旅程场景</span><small>不同路线压力与共同目标</small></div><div className="scenario-options">{scenarios.map(item => <button type="button" key={item.id} className={scenario === item.id ? 'selected' : ''} onClick={() => setScenario(item.id)} aria-pressed={scenario === item.id}><b>{item.name}</b><small>{item.description || '一段等待被重新连起的遗产旅程。'}</small></button>)}</div></section><label>旅程难度<select value={difficulty} onChange={event => setDifficulty(event.target.value)}>{difficulties.map(item => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}</select></label><button type="button" className="advanced-toggle" onClick={() => setShowSeed(value => !value)} aria-expanded={showSeed}><Dice5 size={15} />旅程种子：{showSeed ? '收起' : '高级设置'}</button>{showSeed && <label htmlFor="seed">可复现种子<input id="seed" inputMode="numeric" value={seedText} onChange={event => setSeedText(event.target.value)} placeholder="留空则由旅程决定" /></label>}<button className="primary-cta" disabled={busy}>{busy ? '正在点亮路线…' : '进入准备厅'}<ArrowRight /></button></form><div className="resume"><label htmlFor="room-code">回到已有旅程或房间</label><div><input id="room-code" value={roomCode} onChange={event => setRoomCode(event.target.value)} placeholder="输入房间码或旅程编号" /><button type="button" disabled={!roomCode.trim()} onClick={resume}>进入</button></div></div></section></main>;
}

