import { FormEvent, useState } from 'react';
import { ArrowRight, BookOpen, Compass, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../shared/api/client';
import type { Meta } from '../../types/game';
import { useQuery } from '@tanstack/react-query';

export function LandingPage() {
  const navigate = useNavigate(); const [count, setCount] = useState(2); const [difficulty, setDifficulty] = useState('normal'); const [session, setSession] = useState(''); const [busy, setBusy] = useState(false); const { data: meta } = useQuery<Meta>({ queryKey: ['meta'], queryFn: api.meta });
  async function create(event: FormEvent) { event.preventDefault(); setBusy(true); try { const game = await api.create(Array.from({ length: count }, (_, i) => `p${i + 1}`), difficulty); navigate(`/game/${game.session_id}`); } finally { setBusy(false); } }
  return <main className="landing"><div className="landing-copy"><div className="eyebrow">云冈 · 文化线路合作游戏</div><h1>石窟<br /><em>光谱</em></h1><p>在重新点亮的数字石窟中，连接遗产、修护现场，组合来自不同地域的文化证据。</p><div className="landing-facts"><span><Compass />6 个遗产节点</span><span><Users />2–4 人协作</span><span><BookOpen />约 25 分钟</span></div></div><section className="start-panel" aria-labelledby="start-title"><div className="panel-kicker">开始一次共同旅程</div><h2 id="start-title">让文明关系显现</h2><p>每个选择都会改变线路的亮度。先选队伍，再进入云冈的遗产网络。</p><form onSubmit={create}><label>队伍人数<div className="segmented">{[2, 3, 4].map(value => <button type="button" key={value} className={count === value ? 'selected' : ''} onClick={() => setCount(value)}>{value} 人</button>)}</div></label><label>旅程难度<select value={difficulty} onChange={e => setDifficulty(e.target.value)}>{(meta?.difficulty || [{ id: 'normal', name: '标准旅程' }]).map(item => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}</select></label><button className="primary-cta" disabled={busy}>{busy ? '正在点亮线路...' : '创建新旅程'}<ArrowRight /></button></form><div className="resume"><label htmlFor="session">继续上次旅程</label><div><input id="session" value={session} onChange={e => setSession(e.target.value)} placeholder="输入旅程编号" /><button disabled={!session.trim()} onClick={() => navigate(`/game/${session.trim()}`)}>进入</button></div></div></section></main>;
}
