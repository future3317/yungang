import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Copy, DoorOpen, Flag, LoaderCircle, Play, Shield, Users, Wifi } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../shared/api/client';
import type { Meta, Room, RoomSeat } from '../../types/game';
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
  const roomQuery = useQuery<Room>({ queryKey: ['room', roomId, token], queryFn: () => api.room(roomId, token || undefined), refetchInterval: 1800 });
  useEffect(() => {
    if (!roomId || !token) return;
    const stream = new EventSource(`/api/rooms/${encodeURIComponent(roomId)}/events?seat_token=${encodeURIComponent(token)}`);
    const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['room', roomId, token] }); };
    stream.addEventListener('revision', refresh);
    stream.onerror = () => stream.close();
    return () => stream.close();
  }, [queryClient, roomId, token]);
  const room = roomQuery.data;
  const viewer = useMemo(() => room?.seats.find(seat => seat.seat_id === room.viewer_seat_id), [room]);
  const isHost = viewer?.seat_id === 'seat-1';
  const isManagedMode = room?.play_mode === 'solo' || room?.play_mode === 'local';

  useEffect(() => {
    if (room?.status === 'in_progress' || room?.status === 'paused') navigate(`/room/${roomId}/game`, { replace: true });
  }, [navigate, room?.status, roomId]);

  const update = (promise: Promise<Room>) => promise.then(next => { queryClient.setQueryData(['room', roomId, token], next); return next; });
  const join = useMutation({ mutationFn: () => api.joinRoom(roomId, name, roleId || undefined), onSuccess: result => { window.localStorage.setItem(tokenKey(roomId), result.seat_token); setToken(result.seat_token); queryClient.setQueryData(['room', roomId, result.seat_token], result.room); } });
  const start = useMutation({ mutationFn: () => api.roomStart(roomId, token), onSuccess: () => navigate(`/room/${roomId}/game`, { replace: true }) });
  const ready = useMutation({ mutationFn: (next: boolean) => update(api.roomReady(roomId, token, next)) });
  const role = useMutation({ mutationFn: (next: string) => update(api.roomRole(roomId, token, next)) });
  const seat = useMutation({ mutationFn: ({ seatId, update: next }: { seatId: string; update: { name?: string; role_id?: string; ready?: boolean } }) => update(api.roomSeat(roomId, token, seatId, next)) });
  const leave = useMutation({ mutationFn: () => update(api.roomLeave(roomId, token)), onSuccess: () => { window.localStorage.removeItem(tokenKey(roomId)); navigate('/'); } });

  if (roomQuery.isLoading || metaQuery.isLoading) return <main className="room-screen"><LoaderCircle className="spin" /><p>正在整理同行席位…</p></main>;
  if (roomQuery.isError || !room || !metaQuery.data) return <main className="room-screen"><section className="room-card"><h1>旅舍暂时找不到</h1><p>请确认房间码仍然有效，或回到首页点亮新的旅程。</p><button className="primary-cta" onClick={() => navigate('/')}>返回首页</button></section></main>;

  const roles = metaQuery.data.roles;
  const takenRoles = new Set(room.seats.map(item => item.role_id).filter(Boolean));
  const allConfigured = room.seats.length === room.max_players && room.seats.every(item => Boolean(item.role_id) && item.ready);
  const canStart = isHost && allConfigured;
  const modeLabel = room.play_mode === 'solo' ? '单人旅程' : room.play_mode === 'local' ? '本地协作' : '多设备房间';
  const title = room.play_mode === 'solo' ? '配置两位同行角色' : room.play_mode === 'local' ? '配置本地同行席位' : '等待同行者入席';
  const description = room.play_mode === 'solo' ? '你将轮流调度两位角色。为两席选择不同角色并准备后，即可开始。' : room.play_mode === 'local' ? '在同一设备完成全部席位配置；行动回合会在席位之间交接。' : '每位同行者在自己的设备上选择角色并准备；全部就绪后由房主开始。';

  return <main className="room-screen"><header className="room-topbar"><button className="room-back" onClick={() => navigate('/')}><ArrowLeft size={17} />返回首页</button><span><Wifi size={15} />旅舍开放中</span></header><section className="room-card" aria-labelledby="room-title"><div className="room-card-heading"><div><span className="eyebrow">{modeLabel}</span><h1 id="room-title">{title}</h1><p>{description}</p></div>{room.play_mode === 'multi_device' && <div className="room-code"><small>房间码</small><b>{room.room_id}</b><button onClick={() => void navigator.clipboard?.writeText(room.room_id)} aria-label="复制房间码"><Copy size={15} /></button></div>}</div><div className="room-seats">{Array.from({ length: room.max_players }, (_, index) => { const item = room.seats[index]; return <SeatCard key={item?.seat_id || index} seat={item} index={index} roles={roles} takenRoles={takenRoles} editable={Boolean(isManagedMode && isHost && item)} onUpdate={next => item && seat.mutate({ seatId: item.seat_id, update: next })} />; })}</div>{room.play_mode === 'multi_device' && !token ? <section className="join-panel"><div className="tab-kicker"><Users size={15} />加入这段旅程</div><label>你的名字<input value={name} maxLength={24} onChange={event => setName(event.target.value)} /></label><label>选择角色<select value={roleId} onChange={event => setRoleId(event.target.value)}><option value="">选择角色</option>{roles.map(item => <option key={item.id} value={item.id} disabled={takenRoles.has(item.id)}>{item.name}</option>)}</select></label><button className="primary-cta" disabled={join.isPending || room.seats.length >= room.max_players || !roleId} onClick={() => join.mutate()}><DoorOpen size={16} />加入席位</button></section> : !isManagedMode && token ? <section className="seat-control"><div className="tab-kicker"><Shield size={15} />你的席位</div><div className="seat-control-row"><div><b>{viewer?.name || '同行者'}</b><small>{roles.find(item => item.id === viewer?.role_id)?.name || '尚未选择角色'}</small></div><div className="seat-buttons"><select value={viewer?.role_id || ''} onChange={event => role.mutate(event.target.value)} aria-label="选择角色"><option value="">选择角色</option>{roles.map(item => <option key={item.id} value={item.id} disabled={takenRoles.has(item.id) && item.id !== viewer?.role_id}>{item.name}</option>)}</select><button className={viewer?.ready ? 'ready-button' : 'primary-action'} disabled={!viewer?.role_id} onClick={() => ready.mutate(!viewer?.ready)}>{viewer?.ready ? <><Check size={15} />取消准备</> : '准备好了'}</button></div></div></section> : null}<div className="room-actions">{isHost && <button className="primary-cta" disabled={!canStart || start.isPending} onClick={() => start.mutate()}><Play size={16} />开始旅程</button>}<button className="ghost-button" onClick={() => leave.mutate()}><ArrowLeft size={15} />离开旅舍</button></div>{isHost && !canStart && <p className="room-hint"><Flag size={14} />需要全部席位已选择不同角色并准备，才能开始。</p>}</section></main>;
}

function SeatCard({ seat, index, roles, takenRoles, editable, onUpdate }: { seat?: RoomSeat; index: number; roles: Meta['roles']; takenRoles: Set<string | null | undefined>; editable: boolean; onUpdate: (update: { name?: string; role_id?: string; ready?: boolean }) => void }) {
  const selected = roles.find(item => item.id === seat?.role_id);
  if (!seat) return <article className="room-seat empty"><div className="seat-number">{index + 1}</div><div className="seat-person"><b>等待同行者</b><small>房间码会留出这一席位</small></div></article>;
  return <article className={`room-seat occupied ${seat.ready ? 'ready' : ''}`}><div className="seat-number">{index + 1}</div><div className="seat-person">{editable ? <input value={seat.name} maxLength={24} aria-label={`席位 ${index + 1} 名称`} onChange={event => onUpdate({ name: event.target.value })} /> : <b>{seat.name}</b>}<small>{selected?.name || '尚未选择角色'}</small></div>{editable ? <div className="seat-buttons"><select value={seat.role_id || ''} onChange={event => onUpdate({ role_id: event.target.value })} aria-label={`席位 ${index + 1} 角色`}><option value="">选择角色</option>{roles.map(item => <option key={item.id} value={item.id} disabled={takenRoles.has(item.id) && item.id !== seat.role_id}>{item.name}</option>)}</select><button className={seat.ready ? 'ready-button' : 'primary-action'} disabled={!seat.role_id} onClick={() => onUpdate({ ready: !seat.ready })}>{seat.ready ? <><Check size={13} />已准备</> : '准备'}</button></div> : <span className={`seat-status ${seat.ready ? 'ready' : ''}`}>{seat.ready ? <><Check size={13} />已准备</> : '等待准备'}</span>}</article>;
}
