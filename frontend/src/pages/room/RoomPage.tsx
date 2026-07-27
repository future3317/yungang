import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Copy, DoorOpen, Flag, LoaderCircle, Play, Shield, Users, Wifi } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../shared/api/client';
import type { Meta, Room } from '../../types/game';
import '../../styles/lobby.css';

const tokenKey = (roomId: string) => `yungang-room-token:${roomId}`;

export function RoomPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [token, setToken] = useState(() => window.localStorage.getItem(tokenKey(roomId)) || '');
  const [name, setName] = useState('同行者');
  const [roleId, setRoleId] = useState('');
  const metaQuery = useQuery<Meta>({ queryKey: ['meta'], queryFn: api.meta });
  const roomQuery = useQuery<Room>({ queryKey: ['room', roomId, token], queryFn: () => api.room(roomId, token || undefined), refetchInterval: query => query.state.data?.status === 'lobby' ? 1800 : false });
  const room = roomQuery.data;
  const viewer = useMemo(() => room?.seats.find(seat => seat.seat_id === room.viewer_seat_id), [room]);
  const isHost = viewer?.seat_id === 'seat-1';

  useEffect(() => {
    if (room?.status === 'in_progress' && room.session_id) navigate(`/room/${roomId}/game`, { replace: true });
  }, [navigate, room?.session_id, room?.status, roomId]);

  const update = (promise: Promise<Room>) => promise.then(next => { queryClient.setQueryData(['room', roomId, token], next); return next; });
  const join = useMutation({ mutationFn: () => api.joinRoom(roomId, name, roleId || undefined), onSuccess: result => { window.localStorage.setItem(tokenKey(roomId), result.seat_token); setToken(result.seat_token); queryClient.setQueryData(['room', roomId, result.seat_token], result.room); } });
  const start = useMutation({ mutationFn: () => api.roomStart(roomId, token), onSuccess: result => navigate(`/room/${roomId}/game`, { replace: true }) });
  const ready = useMutation({ mutationFn: (next: boolean) => update(api.roomReady(roomId, token, next)) });
  const role = useMutation({ mutationFn: (next: string) => update(api.roomRole(roomId, token, next)) });
  const leave = useMutation({ mutationFn: () => update(api.roomLeave(roomId, token)), onSuccess: () => { window.localStorage.removeItem(tokenKey(roomId)); navigate('/'); } });

  if (roomQuery.isLoading || metaQuery.isLoading) return <main className="room-screen"><LoaderCircle className="spin" /><p>正在召集同行者…</p></main>;
  if (roomQuery.isError || !room || !metaQuery.data) return <main className="room-screen"><section className="room-card"><h1>旅舍暂时找不到</h1><p>请确认房间码仍然有效，或回到首页点亮新的旅程。</p><button className="primary-cta" onClick={() => navigate('/')}>返回首页</button></section></main>;
  const allReady = room.seats.length > 0 && room.seats.every(seat => seat.ready);
  const roles = metaQuery.data.roles;
  const takenRoles = new Set(room.seats.map(seat => seat.role_id).filter(Boolean));
  const canStart = isHost && (room.play_mode === 'solo' || allReady) && room.seats.length > 0;
  const modeLabel = room.play_mode === 'solo' ? '单人旅程' : room.play_mode === 'local' ? '本地协作' : '多设备房间';

  return <main className="room-screen"><header className="room-topbar"><button className="room-back" onClick={() => navigate('/')}><ArrowLeft size={17} />返回首页</button><span><Wifi size={15} />{room.status === 'lobby' ? '旅舍开放中' : '旅程进行中'}</span></header><section className="room-card" aria-labelledby="room-title"><div className="room-card-heading"><div><span className="eyebrow">{modeLabel}</span><h1 id="room-title">等待同行者入席</h1><p>每个人选好角色并准备后，房主即可点亮这段旅程。</p></div><div className="room-code"><small>房间码</small><b>{room.room_id}</b><button onClick={() => void navigator.clipboard?.writeText(room.room_id)} aria-label="复制房间码"><Copy size={15} /></button></div></div><div className="room-seats">{Array.from({ length: room.max_players }, (_, index) => { const seat = room.seats[index]; const selectedRole = roles.find(item => item.id === seat?.role_id); return <article className={`room-seat ${seat ? 'occupied' : 'empty'} ${seat?.seat_id === room.viewer_seat_id ? 'mine' : ''}`} key={seat?.seat_id || index}><div className="seat-number">{index + 1}</div>{seat ? <><div className="seat-person"><b>{seat.name}</b><small>{selectedRole?.name || '选择角色'}</small></div><span className={`seat-status ${seat.ready ? 'ready' : ''}`}>{seat.ready ? <><Check size={13} />已准备</> : '等待准备'}</span></> : <div className="seat-person"><b>等待同行者</b><small>分享房间码邀请加入</small></div>}</article>; })}</div>{!token ? <section className="join-panel"><div className="tab-kicker"><Users size={15} />加入这段旅程</div><label>你的名字<input value={name} maxLength={24} onChange={event => setName(event.target.value)} /></label><label>选择角色<select value={roleId} onChange={event => setRoleId(event.target.value)}><option value="">由旅舍安排</option>{roles.map(item => <option key={item.id} value={item.id} disabled={takenRoles.has(item.id)}>{item.name}</option>)}</select></label><button className="primary-cta" disabled={join.isPending || room.seats.length >= room.max_players} onClick={() => join.mutate()}><DoorOpen size={16} />加入席位</button>{join.isError && <p className="room-error">这张席位凭证暂时无法使用，请重新加入。</p>}</section> : <section className="seat-control"><div className="tab-kicker"><Shield size={15} />你的席位</div><div className="seat-control-row"><div><b>{viewer?.name || '同行者'}</b><small>{roles.find(item => item.id === viewer?.role_id)?.name || '尚未选择角色'}</small></div><div className="seat-buttons"><select value={viewer?.role_id || ''} onChange={event => role.mutate(event.target.value)} aria-label="选择角色"><option value="">选择角色</option>{roles.map(item => <option key={item.id} value={item.id} disabled={takenRoles.has(item.id) && item.id !== viewer?.role_id}>{item.name}</option>)}</select><button className={viewer?.ready ? 'ready-button' : 'primary-action'} onClick={() => ready.mutate(!viewer?.ready)}>{viewer?.ready ? <><Check size={15} />取消准备</> : '准备好了'}</button></div></div></section>}<div className="room-actions">{isHost && <button className="primary-cta" disabled={!canStart || start.isPending} onClick={() => start.mutate()}><Play size={16} />点亮旅程</button>}<button className="ghost-button" onClick={() => leave.mutate()}><ArrowLeft size={15} />离开旅舍</button></div>{isHost && !canStart && room.play_mode !== 'solo' && <p className="room-hint"><Flag size={14} />等待所有席位亮起“已准备”。</p>}</section></main>;
}
