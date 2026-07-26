import { FormEvent, useState } from 'react';
import { ArrowRight, BookOpen, Compass, Dice5, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../shared/api/client';
import type { Meta } from '../../types/game';
import { useQuery } from '@tanstack/react-query';

export function LandingPage() {
  const navigate = useNavigate();
  const [count, setCount] = useState(2);
  const [difficulty, setDifficulty] = useState('normal');
  const [scenario, setScenario] = useState('sand_and_stone');
  const [seedMode, setSeedMode] = useState<'random' | 'custom' | 'daily'>('random');
  const [seedText, setSeedText] = useState('');
  const [session, setSession] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: meta } = useQuery<Meta>({ queryKey: ['meta'], queryFn: api.meta });
  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const options = seedMode === 'custom' && seedText.trim() ? { scenario_id: scenario, seed: Number(seedText) || 1 } : seedMode === 'daily' ? { scenario_id: scenario, daily_seed: new Date().toISOString().slice(0, 10) } : { scenario_id: scenario };
      const game = await api.create(Array.from({ length: count }, (_, i) => `p${i + 1}`), difficulty, options);
      navigate(`/game/${game.session_id}`);
    } finally { setBusy(false); }
  }
  return <main className="landing"><div className="landing-copy"><div className="eyebrow">云冈 · 文化线路合作游戏</div><h1>石窟<br /><em>光谱</em></h1><p>进入一张会因探索、修护、事件和协作而改变的遗产世界，重新连接来自不同区域的文化证据。</p><div className="landing-facts"><span><Compass />18 个遗产节点</span><span><Users />2-4 人协作</span><span><BookOpen />多种旅程场景</span></div></div><section className="start-panel" aria-labelledby="start-title"><div className="panel-kicker">开始一场共同旅程</div><h2 id="start-title">让文化关系显现</h2><p>选择场景和 seed，相同配置可以重现同一开局。</p><form onSubmit={create}><label>队伍人数<div className="segmented">{[2, 3, 4].map(value => <button type="button" key={value} className={count === value ? 'selected' : ''} onClick={() => setCount(value)}>{value} 人</button>)}</div></label><label>旅程场景<select value={scenario} onChange={event => setScenario(event.target.value)}>{(meta?.scenarios || [{ id: 'sand_and_stone', name: '风沙与石' }]).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>旅程难度<select value={difficulty} onChange={event => setDifficulty(event.target.value)}>{(meta?.difficulty || [{ id: 'normal', name: '标准旅程' }]).map(item => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}</select></label><label>开局方式<div className="segmented seed-mode"><button type="button" className={seedMode === 'random' ? 'selected' : ''} onClick={() => setSeedMode('random')}><Dice5 size={14} />随机</button><button type="button" className={seedMode === 'daily' ? 'selected' : ''} onClick={() => setSeedMode('daily')}>每日</button><button type="button" className={seedMode === 'custom' ? 'selected' : ''} onClick={() => setSeedMode('custom')}>自定义</button></div></label>{seedMode === 'custom' && <label htmlFor="seed">自定义 seed<input id="seed" inputMode="numeric" value={seedText} onChange={event => setSeedText(event.target.value)} placeholder="例如 20260725" /></label>}<button className="primary-cta" disabled={busy}>{busy ? '正在点亮线路...' : '创建新旅程'}<ArrowRight /></button></form><div className="resume"><label htmlFor="session">继续上次旅程</label><div><input id="session" value={session} onChange={event => setSession(event.target.value)} placeholder="输入旅程编号" /><button type="button" disabled={!session.trim()} onClick={() => navigate(`/game/${session.trim()}`)}>进入</button></div></div></section></main>;
}
