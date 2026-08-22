import { useState } from 'react';
import { Archive, ArrowRight, CalendarDays, LoaderCircle, Users, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ApiError, api } from '../../shared/api/client';
import type { ArchiveSummary, Meta } from '../../types/game';

const statusLabels: Record<string, string> = { in_progress: '进行中', paused: '已暂停', completed: '已完成', abandoned: '已结束', lobby: '准备中' };
const modeLabels: Record<string, string> = { solo: '单人旅程', local: '本地协作', multi_device: '网络房间' };

function formatDate(value?: string | null) {
  if (!value) return '尚未记录时间';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '最近一次同步' : new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

export function ArchiveBrowser({ meta, onClose }: { meta?: Meta; onClose: () => void }) {
  const navigate = useNavigate();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { data: archives = [], isLoading, isError, refetch } = useQuery({ queryKey: ['archives'], queryFn: api.archives });
  const roles = Object.fromEntries((meta?.roles || []).map(role => [role.id, role.name]));
  const scenarios = Object.fromEntries((meta?.scenarios || []).map(scenario => [scenario.id, scenario.name]));

  async function resume(item: ArchiveSummary) {
    setLoadingId(item.archive_id);
    setError('');
    try {
      if (item.room_id) {
        // A new browser may not have the old seat token. RoomPage loads the
        // public room shell and then offers seat recovery.
        navigate(`/room/${item.room_id}`);
      } else {
        await api.game(item.session_id);
        navigate(`/game/${item.session_id}`);
      }
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '这段旅程暂时无法恢复，请稍后重试。');
    } finally {
      setLoadingId(null);
    }
  }

  return <div className="dialog-backdrop archive-backdrop"><section className="dialog archive-browser" role="dialog" aria-modal="true" aria-labelledby="archive-browser-title"><button type="button" className="dialog-close" onClick={onClose} aria-label="关闭历史归档"><X size={17} /></button><span className="eyebrow"><Archive size={15} />历史归档</span><h2 id="archive-browser-title">继续一段旅程</h2><p className="archive-intro">选择一条记录，回到上次离开的回合。网络房间会先进入房间恢复席位。</p>{error && <div className="archive-error" role="alert">{error}<button type="button" className="ghost-button" onClick={() => setError('')}>知道了</button></div>}{isLoading && <div className="archive-state"><LoaderCircle className="spin" /><span>正在读取历史记录…</span><div className="archive-load-progress" role="progressbar" aria-label="正在读取历史归档"><span /></div></div>}{isError && <div className="archive-state"><span>历史记录暂时无法读取。</span><button type="button" className="ghost-button" onClick={() => void refetch()}>重新读取</button></div>}{!isLoading && !isError && !archives.length && <div className="archive-state"><Archive /><span>还没有可继续的旅程。</span></div>}<div className="archive-list">{archives.map(item => <article className={`archive-card ${loadingId === item.archive_id ? 'is-loading' : ''}`} aria-busy={loadingId === item.archive_id} key={item.archive_id}><div className="archive-card-top"><span className="archive-mode">{modeLabels[item.mode] || '历史旅程'}</span><span className="archive-status">{statusLabels[item.status] || '已保存'}</span></div><h3>{scenarios[item.scenario_id] || '云冈遗产旅程'}</h3><div className="archive-meta"><span><CalendarDays size={14} />{formatDate(item.updated_at)}</span><span><Users size={14} />{item.players.map(player => player.name).join('、')}</span></div><div className="archive-players">{item.players.map(player => <span key={`${item.archive_id}-${player.name}`}><b>{player.name}</b><small>{roles[player.role_id || ''] || '同行角色'}</small></span>)}</div><div className="archive-progress"><span>第 {item.turn} / {item.max_rounds} 回合</span><button type="button" className="primary-cta" disabled={loadingId !== null} onClick={() => void resume(item)}>{loadingId === item.archive_id ? <><LoaderCircle className="spin" />正在加载</> : <>继续旅程<ArrowRight size={15} /></>}</button></div>{loadingId === item.archive_id && <div className="archive-card-progress" aria-hidden="true"><span /></div>}</article>)}</div></section></div>;
}
