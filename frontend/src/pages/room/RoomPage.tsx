import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Copy, DoorOpen, Flag, LoaderCircle, MapPin, Play, Shield, Sparkles, Users, Wifi } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, api } from '../../shared/api/client';
import { useRoomEvents } from '../../shared/useRoomEvents';
import { clearRoomToken, getRoomToken, setRoomToken } from '../../shared/roomToken';
import { assetUrl } from '../../shared/assetUrl';
import type { ContentRole, Meta, Room, RoomSeat } from '../../types/game';
import '../../styles/lobby.css';


const roleArt: Record<string, { portrait: string; badge: string; accent: string }> = {
  pingcheng_artisan: { portrait: 'role-badge-artisan.png', badge: 'icon_role_craftsman.png', accent: 'cinnabar' },
  western_dancer: { portrait: 'role-badge-dancer.png', badge: 'icon_role_diplomat.png', accent: 'teal' },
  grassland_rider: { portrait: 'role-badge-rider.png', badge: 'icon_role_rider.png', accent: 'green' },
  central_scribe: { portrait: 'role-badge-scribe.png', badge: 'icon_role_scribe.png', accent: 'blue' },
};

function roleAsset(role: ContentRole | undefined) {
  return roleArt[role?.id || ''] || roleArt.central_scribe;
}

export function RoomPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [token, setToken] = useState(() => getRoomToken(roomId));
  const [name, setName] = useState('同行者');
  const [roleId, setRoleId] = useState('');
  const [reconnectSeatId, setReconnectSeatId] = useState('');
  const [activeSeatId, setActiveSeatId] = useState('seat-1');
  const [feedback, setFeedback] = useState('');
  const metaQuery = useQuery<Meta>({ queryKey: ['meta'], queryFn: api.meta });
  const roomQuery = useQuery<Room>({ queryKey: ['room', roomId, token], queryFn: () => api.room(roomId, token || undefined), refetchInterval: 1800 });
  useRoomEvents({ roomId, token, onRevision: () => { void queryClient.invalidateQueries({ queryKey: ['room', roomId, token] }); } });
  const room = roomQuery.data;
  const viewer = useMemo(() => room?.seats.find(seat => seat.seat_id === room.viewer_seat_id), [room]);
  const isHost = viewer?.seat_id === 'seat-1';
  const isManagedMode = room?.play_mode === 'solo' || room?.play_mode === 'local';
  useEffect(() => {
    if (!room) return;
    const fallback = !isManagedMode && viewer?.seat_id ? viewer.seat_id : room.seats[0]?.seat_id;
    if (fallback && !room.seats.some(seat => seat.seat_id === activeSeatId)) setActiveSeatId(fallback);
  }, [activeSeatId, isManagedMode, room, viewer?.seat_id]);

  useEffect(() => {
    if (room?.status === 'completed') navigate(`/room/${roomId}/result`, { replace: true });
    else if ((room?.status === 'in_progress' || room?.status === 'paused') && token && viewer?.seat_id) navigate(`/room/${roomId}/game`, { replace: true });
  }, [navigate, room?.status, roomId, token, viewer?.seat_id]);

  const showError = (error: unknown) => setFeedback(error instanceof ApiError ? error.message : '网络暂时没有回应，请重试。');
  const update = (promise: Promise<Room>) => promise.then(next => { setFeedback(''); queryClient.setQueryData(['room', roomId, token], next); return next; });
  const join = useMutation({ mutationFn: () => api.joinRoom(roomId, name, roleId || undefined), onSuccess: result => { setFeedback(''); setRoomToken(roomId, result.seat_token); setToken(result.seat_token); queryClient.setQueryData(['room', roomId, result.seat_token], result.room); }, onError: showError });
  const reconnect = useMutation({ mutationFn: (seatId: string) => api.roomReconnect(roomId, seatId), onSuccess: result => { setFeedback(''); setRoomToken(roomId, result.seat_token); setToken(result.seat_token); queryClient.setQueryData(['room', roomId, result.seat_token], result.room); }, onError: showError });
  const start = useMutation({ mutationFn: () => api.roomStart(roomId, token), onSuccess: () => navigate(`/room/${roomId}/game`, { replace: true }), onError: showError });
  const ready = useMutation({ mutationFn: (next: boolean) => update(api.roomReady(roomId, token, next)), onError: showError });
  const role = useMutation({ mutationFn: (next: string) => update(api.roomRole(roomId, token, next)), onError: showError });
  const seat = useMutation({ mutationFn: ({ seatId, update: next }: { seatId: string; update: { name?: string; role_id?: string; ready?: boolean } }) => update(api.roomSeat(roomId, token, seatId, next)), onError: showError });
  const leave = useMutation({ mutationFn: () => update(api.roomLeave(roomId, token)), onSuccess: () => { clearRoomToken(roomId); navigate('/'); }, onError: showError });

  if (roomQuery.isLoading || metaQuery.isLoading) return <main className="room-screen"><LoaderCircle className="spin" /><p>正在整理同行席位…</p></main>;
  if (roomQuery.isError || !room || !metaQuery.data) return <main className="room-screen"><section className="room-card"><h1>旅舍暂时找不到</h1><p>请确认房间码仍然有效，或回到首页点亮新的旅程。</p><button className="primary-cta" onClick={() => navigate('/')}>返回首页</button></section></main>;

  const roles = metaQuery.data.roles;
  const takenRoles = new Set(room.seats.map(item => item.role_id).filter(Boolean));
  const startedWithoutToken = room.play_mode === 'multi_device' && !token && room.status !== 'lobby';
  const selectedReconnectSeatId = reconnectSeatId || room.seats[0]?.seat_id || '';
  const activeSeat = room.seats.find(item => item.seat_id === activeSeatId) || viewer;
  const galleryRoleId = room.play_mode === 'multi_device' && !token ? roleId : activeSeat?.role_id || '';
  const canPickRole = Boolean(room.status === 'lobby' && ((isManagedMode && isHost) || (!isManagedMode && token) || (room.play_mode === 'multi_device' && !token)));
  const allConfigured = room.seats.length === room.max_players && room.seats.every(item => Boolean(item.role_id) && item.ready);
  const canStart = isHost && allConfigured;
  const selectRole = (nextRoleId: string) => {
    if (room.play_mode === 'multi_device' && !token) { setRoleId(nextRoleId); return; }
    if (!activeSeat || takenRoles.has(nextRoleId) && activeSeat.role_id !== nextRoleId) return;
    if (!isManagedMode && viewer?.seat_id === activeSeat.seat_id) { role.mutate(nextRoleId); return; }
    if (isManagedMode && isHost) seat.mutate({ seatId: activeSeat.seat_id, update: { role_id: nextRoleId, ready: false } });
  };
  const modeLabel = room.play_mode === 'solo' ? '单人旅程' : room.play_mode === 'local' ? '本地协作' : '多设备房间';
  const title = room.play_mode === 'solo' ? '配置两位同行角色' : room.play_mode === 'local' ? '配置本地同行席位' : '等待同行者入席';
  const description = room.play_mode === 'solo' ? '你将轮流调度两位角色。为两席选择不同角色并准备后，即可开始。' : room.play_mode === 'local' ? '在同一设备完成全部席位配置；行动回合会在席位之间交接。' : '每位同行者在自己的设备上选择角色并准备；全部就绪后由房主开始。';

  return <main className="room-screen"><header className="room-topbar"><button className="room-back" onClick={() => navigate('/')}><ArrowLeft size={17} />返回首页</button><span><Wifi size={15} />旅舍开放中</span></header><section className="room-card" aria-labelledby="room-title"><div className="room-card-heading"><div><span className="eyebrow">{modeLabel}</span><h1 id="room-title">{title}</h1><p>{description}</p></div>{room.play_mode === 'multi_device' && <div className="room-code"><small>房间码</small><b>{room.room_id}</b><button onClick={() => void navigator.clipboard?.writeText(room.room_id)} aria-label="复制房间码"><Copy size={15} /></button></div>}</div><div className="room-seats">{Array.from({ length: room.max_players }, (_, index) => { const item = room.seats[index]; return <SeatCard key={item?.seat_id || index} seat={item} index={index} roles={roles} takenRoles={takenRoles} editable={Boolean(item && isHost && (isManagedMode || item.seat_id === 'seat-1'))} onUpdate={next => item && seat.mutate({ seatId: item.seat_id, update: next })} />; })}</div>{canPickRole && <RoleGallery roles={roles} seats={room.seats} activeSeatId={activeSeat?.seat_id} selectedRoleId={galleryRoleId} takenRoles={takenRoles} managed={isManagedMode && isHost} onSeatChange={setActiveSeatId} onSelect={selectRole} />}{startedWithoutToken ? <section className="join-panel"><div className="tab-kicker"><Shield size={15} />恢复同行席位</div><p>这段旅程仍保存在房间中。选择你原来的席位，服务端会重新发放进入凭证，进度不会丢失。</p><label>恢复席位<select value={selectedReconnectSeatId} onChange={event => setReconnectSeatId(event.target.value)}>{room.seats.map(seat => <option key={seat.seat_id} value={seat.seat_id}>{seat.name} · {roles.find(role => role.id === seat.role_id)?.name || '尚未选择角色'}</option>)}</select></label><button className="primary-cta" disabled={reconnect.isPending || !selectedReconnectSeatId} onClick={() => reconnect.mutate(selectedReconnectSeatId)}><DoorOpen size={16} />继续这段旅程</button></section> : room.play_mode === 'multi_device' && !token && room.status === 'lobby' ? <section className="join-panel"><div className="tab-kicker"><Users size={15} />加入这段旅程</div><label>你的名字<input value={name} maxLength={24} onChange={event => setName(event.target.value)} /></label><label className="role-join-select">选择角色<select value={roleId} onChange={event => setRoleId(event.target.value)}><option value="">选择角色</option>{roles.map(item => <option key={item.id} value={item.id} disabled={takenRoles.has(item.id)}>{item.name}</option>)}</select></label><p className="role-join-note">先在上方选择一位角色，再加入空闲席位。</p><button className="primary-cta" disabled={join.isPending || room.seats.length >= room.max_players || !roleId} onClick={() => join.mutate()}><DoorOpen size={16} />加入席位</button></section> : !isManagedMode && token ? <section className="seat-control"><div className="tab-kicker"><Shield size={15} />你的席位</div><div className="seat-control-row"><div><b>{viewer?.name || '同行者'}</b><small>{roles.find(item => item.id === viewer?.role_id)?.name || '尚未选择角色'}</small></div><div className="seat-buttons"><label className="seat-role-select">&#x9009;&#x62E9;&#x89D2;&#x8272;<select value={viewer?.role_id || ''} onChange={event => role.mutate(event.target.value)} aria-label="选择角色"><option value="">选择角色</option>{roles.map(item => <option key={item.id} value={item.id} disabled={takenRoles.has(item.id) && item.id !== viewer?.role_id}>{item.name}</option>)}</select></label><button className={viewer?.ready ? 'ready-button' : 'primary-action'} disabled={!viewer?.role_id} onClick={() => ready.mutate(!viewer?.ready)}>{viewer?.ready ? <><Check size={15} />取消准备</> : '准备好了'}</button></div></div></section> : null}<div className="room-actions">{feedback && <div className="room-feedback" role="alert"><span>{feedback}</span><button className="ghost-button" onClick={() => { setFeedback(''); void roomQuery.refetch(); }}>重试</button></div>}{isHost && <button className="primary-cta" disabled={!canStart || start.isPending} onClick={() => start.mutate()}><Play size={16} />开始旅程</button>}<button className="ghost-button" onClick={() => token ? leave.mutate() : navigate('/')}><ArrowLeft size={15} />{token ? '离开旅舍' : '返回首页'}</button></div>{isHost && !canStart && <p className="room-hint"><Flag size={14} />需要全部席位已选择不同角色并准备，才能开始。</p>}</section></main>;
}

function RoleGallery({ roles, seats, activeSeatId, selectedRoleId, takenRoles, managed, onSeatChange, onSelect }: { roles: Meta['roles']; seats: RoomSeat[]; activeSeatId?: string; selectedRoleId: string; takenRoles: Set<string | null | undefined>; managed: boolean; onSeatChange: (seatId: string) => void; onSelect: (roleId: string) => void }) {
  const selected = roles.find(role => role.id === selectedRoleId) || roles[0];
  const selectedAsset = roleAsset(selected);
  return <section className="role-selection-panel" aria-labelledby="role-selection-title">
    <div className="role-selection-heading"><div><span className="eyebrow">角色展台</span><h2 id="role-selection-title">选择你的同行者</h2><p>每位角色都有不同的行动节奏。查看专长和起手建议，再决定谁守护哪一段线索。</p></div><span className="role-selection-count">{roles.filter(role => !takenRoles.has(role.id) || role.id === selectedRoleId).length} 位可选</span></div>
    {managed && <div className="role-seat-switcher" role="tablist" aria-label="选择要配置的席位">{seats.map((seat, index) => <button key={seat.seat_id} role="tab" aria-selected={seat.seat_id === activeSeatId} className={seat.seat_id === activeSeatId ? 'active' : ''} onClick={() => onSeatChange(seat.seat_id)}><span>席位 {index + 1}</span><b>{seat.name}</b><small>{roles.find(role => role.id === seat.role_id)?.name || '等待角色'}</small></button>)}</div>}
    <div className="role-selection-layout"><div className="role-card-grid">{roles.map(role => { const asset = roleAsset(role); const unavailable = takenRoles.has(role.id) && role.id !== selectedRoleId; return <button key={role.id} className={`role-choice-card ${role.id === selectedRoleId ? 'selected' : ''} ${unavailable ? 'unavailable' : ''} role-accent-${asset.accent}`} disabled={unavailable} onClick={() => onSelect(role.id)} aria-pressed={role.id === selectedRoleId}><span className="role-choice-portrait"><img src={`/ui-assets/ornaments/${asset.portrait}`} alt="" /><img className="role-choice-badge" src={assetUrl(asset.badge)} alt="" /></span><span className="role-choice-copy"><b>{role.name}</b><small>{role.origin || '同行角色'} · {role.team_role || '协作专长'}</small><em>{role.ability?.name || '角色专长'} · {role.ability?.ap_cost || 0} AP</em></span><ChevronRight className="role-choice-arrow" size={17} /></button>; })}</div><aside className={`role-detail-card role-accent-${selectedAsset.accent}`}><div className="role-detail-art"><img src={`/ui-assets/ornaments/${selectedAsset.portrait}`} alt="" /><img className="role-detail-badge" src={assetUrl(selectedAsset.badge)} alt="" /></div><div className="role-detail-heading"><span>{selected?.origin || '同行角色'}</span><h3>{selected?.name || '选择一位角色'}</h3><p>{selected?.team_role || '为团队补上关键的一束光'}</p></div><div className="role-detail-section"><span><Sparkles size={14} />专长</span><b>{selected?.ability?.name || '等待选择'}</b><p>{selected?.ability?.description || '选择角色后，这里会显示专长的实际效果。'}</p></div><div className="role-detail-section"><span><MapPin size={14} />行动风格</span><p>{selected?.play_style || selected?.meaning || '在地图上寻找最适合自己的协作位置。'}</p></div>{selected?.solo_rule && <div className="role-solo-note"><b>单人提示</b><span>{selected.solo_rule}</span></div>}{selected?.starting_hint && <div className="role-start-note">{selected.starting_hint}</div>}</aside></div>
  </section>;
}

function SeatCard({ seat, index, roles, takenRoles, editable, onUpdate }: { seat?: RoomSeat; index: number; roles: Meta['roles']; takenRoles: Set<string | null | undefined>; editable: boolean; onUpdate: (update: { name?: string; role_id?: string; ready?: boolean }) => void }) {
  const selected = roles.find(item => item.id === seat?.role_id);
  if (!seat) return <article className="room-seat empty"><div className="seat-number">{index + 1}</div><div className="seat-person"><b>等待同行者</b><small>房间码会留出这一席位</small></div></article>;
  return <article className={`room-seat occupied ${seat.ready ? 'ready' : ''}`}><div className="seat-number">{index + 1}</div><div className="seat-person">{editable ? <input value={seat.name} maxLength={24} aria-label={`席位 ${index + 1} 名称`} onChange={event => onUpdate({ name: event.target.value })} /> : <b>{seat.name}</b>}<small>{selected?.name || '尚未选择角色'}</small></div>{editable ? <div className="seat-buttons"><select value={seat.role_id || ''} onChange={event => onUpdate({ role_id: event.target.value })} aria-label={`席位 ${index + 1} 角色`}><option value="">选择角色</option>{roles.map(item => <option key={item.id} value={item.id} disabled={takenRoles.has(item.id) && item.id !== seat.role_id}>{item.name}</option>)}</select><button className={seat.ready ? 'ready-button' : 'primary-action'} disabled={!seat.role_id} onClick={() => onUpdate({ ready: !seat.ready })}>{seat.ready ? <><Check size={13} />已准备</> : '准备'}</button></div> : <span className={`seat-status ${seat.ready ? 'ready' : ''}`}>{seat.ready ? <><Check size={13} />已准备</> : '等待准备'}</span>}</article>;
}


