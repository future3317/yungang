import { useMutation, useQuery } from '@tanstack/react-query';
import { Archive, Compass, RotateCcw, Trophy } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../shared/api/client';
import type { GameState } from '../../types/game';

const outcomeCopy: Record<string, { title: string; body: string }> = {
  core_project_and_objectives_completed: { title: '遗产网络已显影', body: '核心项目与共同目标均已完成。你们把分散的证据、路线与守护行动连成了可持续的解释。' },
  domain_interpretation_completed: { title: '文化解释已完成', body: '团队完成了必要的证据互证，并在有限回合内守住了网络。' },
  too_many_closed_sites: { title: '守护网络失守', body: '关闭地点超过场景可承受上限。下一局可优先处理高风险节点与受阻路线。' },
  weathering_track_reached_limit: { title: '风化压力失控', body: '风化压力达到上限。准备、修护与事件应对需要更早介入。' },
  round_limit_reached: { title: '旅程暂告一段落', body: '回合耗尽前尚未完成共同目标。可沿用相同种子复盘路线与证据选择。' },
};

export function GameResultPage() {
  const { sessionId = '', roomId = '' } = useParams();
  const navigate = useNavigate();
  const roomToken = roomId ? window.localStorage.getItem(`yungang-room-token:${roomId}`) || '' : '';
  const gameQuery = useQuery<GameState>({ queryKey: [roomId ? 'room-result' : 'game', roomId || sessionId, roomToken], queryFn: () => roomId ? api.roomGame(roomId, roomToken) : api.game(sessionId) });
  const replay = useMutation({ mutationFn: (sameSeed: boolean) => {
    if (roomId) throw new Error('房间旅程请从房间入口重新开始。');
    const state = gameQuery.data!;
    const players = Object.keys(state.players).filter(id => !id.includes('-ally-'));
    return api.create(players, state.difficulty_id, { scenario_id: state.scenario_id, ...(sameSeed && state.seed !== undefined ? { seed: state.seed } : {}) });
  }, onSuccess: game => navigate(`/game/${game.session_id}`) });
  if (gameQuery.isLoading) return <main className="result-screen"><p>正在整理旅程档案…</p></main>;
  if (gameQuery.isError || !gameQuery.data) return <main className="result-screen"><h1>无法读取旅程结算</h1><button onClick={() => navigate(roomId ? `/room/${roomId}` : '/')}>返回{roomId ? '房间' : '首页'}</button></main>;
  const state = gameQuery.data;
  const result = outcomeCopy[state.shared.outcome_reason || ''] || { title: state.shared.outcome === 'victory' ? '旅程完成' : '旅程结束', body: '本局记录已保存，可从首页继续新的旅程。' };
  const score = state.score || { tasks: 0, routes: 0, diversity: 0, protection: 0, discovery: 0, total: 0, grade: 'stone' };
  const roomSeats = state.viewer?.seats || [];
  return <main className="result-screen"><section className={`result-card ${state.shared.outcome}`}><span className="eyebrow"><Trophy size={16} />{roomId ? '房间旅程结算' : '旅程结算'}</span><h1>{result.title}</h1><p>{state.result?.outcome_summary || result.body}</p>{roomId ? <div className="result-context"><b>{state.viewer?.play_mode === 'multi_device' ? '多设备同行' : state.viewer?.play_mode === 'local' ? '本地协作' : '单人协作'}</b><span>{roomSeats.map(seat => `${seat.name || '同行者'} · ${seat.role_id || '未选角色'}`).join('　')}</span></div> : null}<div className="result-score"><strong>{score.total}</strong><span>团队评分 · {score.grade === 'gold' ? '金' : score.grade === 'silver' ? '银' : '铜'}级</span></div><div className="result-metrics"><span>任务 <b>{score.tasks}</b></span><span>路线 <b>{score.routes}</b></span><span>来源 <b>{score.diversity}</b></span><span>守护 <b>{score.protection}</b></span><span>发现 <b>{score.discovery}</b></span></div>{state.result?.completed_projects?.length ? <div className="result-projects"><span className="eyebrow">已完成项目</span><p>{state.result.completed_projects.join(' · ')}</p></div> : null}<p className="result-seed">复盘种子：{state.seed ?? '本局随机'}</p><div className="result-actions">{roomId ? <button className="primary-cta" onClick={() => navigate(`/room/${roomId}`)}><RotateCcw size={17} />返回房间</button> : <><button className="primary-cta" disabled={replay.isPending} onClick={() => replay.mutate(true)}><RotateCcw size={17} />同一种子复盘</button><button onClick={() => replay.mutate(false)}><Compass size={17} />开启新旅程</button></>}<button onClick={() => navigate('/')}><Archive size={17} />返回首页</button></div></section></main>;
}
