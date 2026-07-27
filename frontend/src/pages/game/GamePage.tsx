import { useEffect, useState } from 'react';
import { Archive, ChevronDown, CircleAlert, Clock3, Map as MapIcon, Send, ShieldCheck, Sparkles, Target, Users, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useParams } from 'react-router-dom';
import { ApiError, api } from '../../shared/api/client';
import type { Action, ActionOption, ActionType, ContentCard, ContentEvent, GameState, Meta, Site } from '../../types/game';
import { HeritageNetwork } from '../../widgets/heritage-network/HeritageNetwork';
import { CommandDock } from '../../widgets/game/CommandDock';
import { ScenarioHeader } from '../../widgets/game/ScenarioHeader';
import { SiteInspector } from '../../widgets/game/SiteInspector';
import { ActionTargetGuide } from '../../widgets/game/JourneyGuide';
import { PlanningPhase } from '../../widgets/game/PlanningPhase';
import { RoundSummary } from '../../widgets/game/RoundSummary';
import { ActionPreview } from '../../widgets/game/ActionPreview';
import { TutorialGuide } from '../../widgets/game/TutorialGuide';
import { SeatHandoff } from '../../widgets/game/SeatHandoff';
import { useDialogFocus } from '../../widgets/game/useDialogFocus';
import '../../styles/experience.css';
import '../../styles/tutorial.css';
import '../../styles/interface-scale.css';
import '../../styles/handoff.css';
import '../../styles/fullscreen-map.css';

type ActionMode = Extract<ActionType, 'move' | 'explore' | 'contribute' | 'restore' | 'survey_route' | 'restore_route' | 'establish_connection' | 'exchange' | 'plan'> | null;
const actionLabels: Partial<Record<ActionType, string>> = { move: '移动', survey_route: '勘察路线', explore: '探索', contribute: '贡献', restore: '修护节点', restore_route: '修护路线', establish_connection: '建立连接', exchange: '交换', prepare: '准备', use_action_card: '使用策略牌', use_node_ability: '地点能力', use_upgrade: '角色专长', use_skill: '技能', end_planning: '开始行动', end_turn: '结束回合', plan: '规划' };
const previewDeltaLabels: Record<string, string> = { ap: '行动点', influence: '个人影响', restoration_resource: '修护资源', research_clues: '研究线索', threat: '风化压力', risk: '路线风险', restoration: '修护进度' };
function previewDeltaText(delta: Record<string, unknown> | undefined, fallback: string) { const text = Object.entries(delta || {}).filter(([, value]) => typeof value === 'number').map(([key, value]) => `${previewDeltaLabels[key] || key.replaceAll('_', ' ')} ${Number(value) > 0 ? '+' : ''}${value}`).join(' · '); return text || fallback; }

function findCardAction(actions: Action[], type: ActionType, cardId: string) { return actions.find(action => action.type === type && action.card_id === cardId); }
function actionModeLabel(mode: ActionMode) { return mode ? actionLabels[mode] || mode : ''; }
const roleBadgeAssets: Record<string, string> = { pingcheng_artisan: 'role-badge-artisan.png', western_dancer: 'role-badge-dancer.png', grassland_rider: 'role-badge-rider.png', central_scribe: 'role-badge-scribe.png' };
function roleBadgeAsset(roleId: string | undefined, fallback?: string) { return roleBadgeAssets[roleId || ''] ? `ornaments/${roleBadgeAssets[roleId || '']}` : fallback || 'icon_role_scribe.png'; }
function optionAction(option: ActionOption, target?: ActionOption['targets'][number]): Action { const payload = { ...(option.payload || {}), ...(target?.payload || {}) }; return { ...payload, type: option.type, label: target?.label || option.label } as Action; }
function actionFeedback(action: Action, before: GameState | undefined, after: GameState) {
  const actorId = before?.shared.active_player_id || after.shared.active_player_id;
  const previousPlayer = actorId ? before?.players[actorId] : undefined;
  const nextPlayer = actorId ? after.players[actorId] : undefined;
  const changes: string[] = [];
  const delta = (label: string, previous?: number, next?: number) => { if (typeof previous === 'number' && typeof next === 'number' && previous !== next) changes.push(`${label} ${next - previous > 0 ? '+' : ''}${next - previous}`); };
  delta('AP', previousPlayer?.ap, nextPlayer?.ap);
  delta('研究线索', before?.shared.research_clues, after.shared.research_clues);
  delta('修护资源', before?.shared.restoration_resource, after.shared.restoration_resource);
  delta('威胁', before?.shared.threat, after.shared.threat);
  delta('共同影响', before?.shared.influence, after.shared.influence);
  const copy: Partial<Record<ActionType, string>> = { move: '已抵达新地点。新的线索与风险已经显影。', explore: '文化证据已进入手牌，可用于当前地点的互证。', contribute: '证据已投入委托，节点会按完整条件推进。', restore: '节点损伤已降低，可以继续推进当前项目。', restore_route: '路线已恢复通行，新的协作路径已经打开。', survey_route: '路线状况已记录，可以据此决定修护或绕行。', establish_connection: '地点之间已建立稳定连接。', use_action_card: '策略牌已结算，地图和资源状态已经更新。', end_planning: '规划标记已结算，现在开始本轮行动。' };
  return `${copy[action.type] || '行动已记录，世界状态已更新。'}${changes.length ? ` ${changes.join('、')}。` : ''}`;
}

export function GamePage() {
  const { sessionId = '', roomId = '' } = useParams();
  const queryClient = useQueryClient();
  const [focus, setFocus] = useState<string | null>(null);
  const [card, setCard] = useState<string | null>(null);
  const [preview, setPreview] = useState<Action | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [mobileView, setMobileView] = useState<'map' | 'mission' | 'hand'>('map');
  const [toasts, setToasts] = useState<Array<{ id: string; text: string }>>([]);
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'action' | 'event' | 'project'>('all');
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [handoffName, setHandoffName] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<ActionOption | null>(null);
  const [roomToken] = useState(() => roomId ? window.localStorage.getItem(`yungang-room-token:${roomId}`) || '' : '');
  const enqueueToast = (text: string) => { const id = crypto.randomUUID(); setToasts(items => [...items.slice(-3), { id, text }]); window.setTimeout(() => setToasts(items => items.filter(item => item.id !== id)), 4800); };
  const gameQuery = useQuery<GameState>({ queryKey: [roomId ? 'room-game' : 'game', roomId || sessionId, roomToken], queryFn: () => roomId ? api.roomGame(roomId, roomToken) : api.game(sessionId), refetchOnWindowFocus: false, refetchInterval: roomId ? 2500 : false });
  useEffect(() => {
    if (!roomId || !roomToken) return;
    const stream = new EventSource(`/api/rooms/${encodeURIComponent(roomId)}/events?seat_token=${encodeURIComponent(roomToken)}`);
    const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['room-game', roomId, roomToken] }); };
    stream.addEventListener('revision', refresh);
    stream.onerror = () => stream.close();
    return () => stream.close();
  }, [queryClient, roomId, roomToken]);
  const metaQuery = useQuery<Meta>({ queryKey: ['meta'], queryFn: api.meta });
  const state = gameQuery.data;
  const legal = state?.legal_actions || [];
  const canAct = state?.viewer?.can_act ?? true;
  const mutation = useMutation({
    mutationFn: (action: Action) => roomId ? api.roomAction(roomId, roomToken, action, state?.revision || 0) : api.action(sessionId, action, state?.shared.active_player_id || '', state?.revision || 0),
    onSuccess: (data, action) => { queryClient.setQueryData([roomId ? 'room-game' : 'game', roomId || sessionId, roomToken], data); setPreview(null); setSelectedOption(null); setActionMode(null); if (action.type === 'move' && action.target_id) { setFocus(action.target_id); setInspectorOpen(true); } if (data.viewer?.play_mode === 'local' && action.type === 'end_turn' && data.players[data.shared.active_player_id]) setHandoffName(data.players[data.shared.active_player_id].name); enqueueToast(actionFeedback(action, state, data)); },
    onError: error => { if (error instanceof ApiError && error.status === 409) { const current = (error.payload as { detail?: { current_state?: GameState } })?.detail?.current_state; if (current) { queryClient.setQueryData([roomId ? 'room-game' : 'game', roomId || sessionId, roomToken], current); setActionMode(null); setSelectedOption(null); setPreview(null); enqueueToast('状态已同步，请重新选择行动。'); return; } } setActionMode(null); setSelectedOption(null); setPreview(null); enqueueToast(error instanceof Error ? error.message : '同步失败，请稍后重试。'); }
  });
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setActionMode(null); setSelectedOption(null); setCard(null); setPreview(null); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);
  useEffect(() => {
    if (!gameQuery.data) return;
    try {
      if (!window.localStorage.getItem('yungang-journey-tutorial-v1')) setTutorialOpen(true);
    } catch {
      setTutorialOpen(true);
    }
  }, [gameQuery.data?.session_id]);
  if (gameQuery.isLoading || metaQuery.isLoading) return <div className="state-screen"><span className="loading-orbit" /><p>正在读取遗产网络...</p></div>;
  if (gameQuery.isError || metaQuery.isError || !state || !metaQuery.data) return <div className="state-screen danger"><CircleAlert /><h1>旅程暂时无法打开</h1><p>请检查本地服务后重新进入旅程。</p><button className="ghost-button" onClick={() => { void gameQuery.refetch(); void metaQuery.refetch(); }}>重新连接</button><button className="ghost-button" onClick={() => window.location.assign('/')}>返回首页</button></div>;
  if (state.shared.outcome) return <Navigate to={roomId ? `/room/${roomId}/result` : `/result/${state.session_id}`} replace />;

  const meta = metaQuery.data;
  const active = state.players[state.shared.active_player_id];
  const sites = Object.fromEntries(meta.sites.map(site => [site.id, site]));
  const cards = Object.fromEntries(meta.cards.map(item => [item.id, item]));
  const events = Object.fromEntries(meta.events.map(item => [item.id, item]));
  const roles = Object.fromEntries(meta.roles.map(item => [item.id, item]));
  const focused: Site = state.sites[focus || active.location] || state.sites[active.location] || Object.values(state.sites)[0];
  const focusedMeta = sites[focused.id] || focused;
  const task = focusedMeta.active_task_id ? state.tasks[focusedMeta.active_task_id] : undefined;
  const currentEvent = state.shared.current_event_id ? events[state.shared.current_event_id] : undefined;
  const eventTargetLabels = (state.shared.event_targets || []).map(id => sites[id]?.name || (state.routes?.[id] ? '选中路线' : '事件目标'));
  const targetIds = new Set((selectedOption?.type === actionMode ? selectedOption.targets : []).map(target => String(target.payload?.target_id || target.payload?.target_site_id || target.id)));
  const connection = mutation.isPending || gameQuery.isFetching || metaQuery.isFetching ? '同步中' : '已连接';
  const run = (action?: Action) => { if (action && canAct && !mutation.isPending) mutation.mutate({ ...action, request_id: action.request_id || crypto.randomUUID() }); };
  const chooseOption = (option: ActionOption) => { if (!canAct || option.enabled === false) return; if (option.targets.length) { setSelectedOption(option); if (['move', 'restore', 'survey_route', 'restore_route', 'establish_connection'].includes(option.type)) { setActionMode(option.type as ActionMode); setFocus(active.location); } else setActionMode(null); return; } run(optionAction(option)); };
  const chooseAction = (type: ActionType) => { const option = state.action_options?.find(item => item.type === type && item.enabled !== false); if (option) chooseOption(option); };
  const selectAction = (action: Action) => { setActionMode(null); setSelectedOption(null); setPreview(action); };
  const selectNode = (id: string) => { const target = mapActionMode && selectedOption?.type === actionMode ? selectedOption.targets.find(item => { const payload = item.payload || {}; return item.id === id || payload.target_id === id || payload.target_site_id === id || payload.route_id === id; }) : undefined; if (target && selectedOption) { selectAction(optionAction(selectedOption, target)); return; } setFocus(id); setInspectorOpen(true); };
  const mapActionMode = actionMode && ['move', 'restore', 'survey_route', 'restore_route', 'establish_connection'].includes(actionMode) ? actionMode as Extract<ActionType, 'move' | 'restore' | 'survey_route' | 'restore_route' | 'establish_connection'> : null;
  const selectExploreCard = (id: string) => { const option = state.action_options?.find(item => item.type === 'explore' && item.targets.some(target => target.payload?.card_id === id)); const target = option?.targets.find(item => item.payload?.card_id === id); if (option && target) selectAction(optionAction(option, target)); };
  const selectContribution = (id: string) => { const option = state.action_options?.find(item => item.type === 'contribute' && item.targets.some(target => target.payload?.card_id === id)); const target = option?.targets.find(item => item.payload?.card_id === id); if (option && target) selectAction(optionAction(option, target)); else setCard(id); };
  const pendingAction = (action: Action) => state.pending_choice?.kind === 'action_card' ? selectAction(action) : run(action);

  const timelineEvents = state.shared.journal?.length ? state.shared.journal : state.shared.log.map((message, index) => ({ id: `legacy-${index}`, round: state.shared.turn, type: 'action', message, effects: [], created_at: '' }));
  const filteredTimeline = timelineEvents.filter(item => timelineFilter === 'all' || item.type === timelineFilter);
  return <div className="game-shell"><ScenarioHeader state={state} connection={connection} /><div className="mobile-tabs" role="tablist" aria-label="游戏内容"><button role="tab" aria-selected={mobileView === 'map'} aria-controls="mobile-map-panel" className={mobileView === 'map' ? 'active' : ''} onClick={() => setMobileView('map')}><MapIcon size={16} />地图</button><button role="tab" aria-selected={mobileView === 'mission'} aria-controls="mobile-mission-panel" className={mobileView === 'mission' ? 'active' : ''} onClick={() => setMobileView('mission')}><Target size={16} />地点</button><button role="tab" aria-selected={mobileView === 'hand'} aria-controls="mobile-hand-panel" className={mobileView === 'hand' ? 'active' : ''} onClick={() => setMobileView('hand')}><Archive size={16} />手牌</button></div><main className={`game-grid ${inspectorOpen ? '' : 'inspector-collapsed'}`}>
    <aside className={`roster-column ${mobileView !== 'map' ? 'mobile-hidden' : ''}`} id="mobile-map-panel"><section className="roster"><div className="section-label"><Users size={14} />共同旅伴</div>{state.shared.player_order.map(id => { const player = state.players[id]; const role = roles[player.role_id]; return <button key={id} className={`roster-row ${id === state.shared.active_player_id ? 'active' : ''}`} onClick={() => setFocus(player.location)}><img src={`/ui-assets/${roleBadgeAsset(player.role_id, role?.icon_asset)}`} alt="" /><span><b>{player.name}</b><small>{role?.name || player.role_id} · {sites[player.location]?.name || player.location}</small></span><strong>{player.ap} <small>AP</small></strong></button>; })}</section><section className="current-player"><div className="section-label">当前行动者</div><h2>{active.name}</h2><p>{roles[active.role_id]?.name || active.role_id}</p><div className="player-resources"><span><b>{active.ap}</b><small>行动点</small></span><span><b>{active.influence}</b><small>个人影响</small></span><span><b>{state.shared.restoration_resource}</b><small>修护资源</small></span></div></section><CommandDock state={state} active={active} cards={cards} legal={legal} actionOptions={state.action_options || []} actionMode={actionMode} actionLabels={actionLabels} mutationPending={mutation.isPending} onRun={run} onChooseOption={chooseOption} onCancel={() => { setActionMode(null); setSelectedOption(null); }} onCard={setCard} onContribution={selectContribution} /></aside>
    <section className={`stage-column ${mobileView !== 'map' ? 'mobile-hidden' : ''}`}><RoundSummary state={state} sites={sites} /><div className="stage-heading"><div><span className="eyebrow">石窟光谱 / Cave Light Atlas</span><h1>遗产节点网络</h1></div><span className="turn-badge"><Clock3 size={14} />回合 {state.shared.turn}</span></div><div className="network-stage">{state.shared.phase === 'planning' && <PlanningPhase state={state} sites={sites} actions={legal} onChoose={run} />}{actionMode && <div className="mode-strip" role="status" aria-live="polite">正在选择{actionModeLabel(actionMode)}目标 · 已显示 {targetIds.size} 个合法目标 · <button onClick={() => { setActionMode(null); setSelectedOption(null); }}>Escape 取消</button></div>}<ActionTargetGuide mode={actionMode} actions={(selectedOption?.type === actionMode ? selectedOption.targets.map(target => optionAction(selectedOption, target)) : [])} sites={sites} cards={cards} onRun={selectAction} onCancel={() => { setActionMode(null); setSelectedOption(null); }} /><HeritageNetwork sites={state.sites} metaSites={sites} regions={meta.regions} routes={state.routes} players={Object.values(state.players)} active={active} focusedId={focus} reachableIds={targetIds} actionMode={mapActionMode} onFocus={selectNode} /></div><div className="stage-caption"><div className="scene-thumb"><img src={`/ui-assets/generated/${focusedMeta.scene_asset || 'scene_yungang_day.png'}`} alt="" /></div><div><span className="eyebrow">当前聚焦</span><h2>{focusedMeta.name || focused.id}</h2><p>{focusedMeta.summary || '等待探索后显示节点的文化摘要。'}</p></div><button className="focus-clear" onClick={() => { setFocus(null); setActionMode(null); setSelectedOption(null); }} aria-label="取消聚焦"><X size={16} /></button></div></section>
    <SiteInspector state={state} meta={meta} site={focusedMeta} task={task} event={currentEvent} cards={cards} legal={legal} actionMode={actionMode} collapsed={!inspectorOpen} onCollapsedChange={setInspectorOpen} onExplore={selectExploreCard} onSelectAction={chooseAction} className={mobileView !== 'mission' ? 'mobile-hidden' : ''} /></main><MobileHandPanel id="mobile-hand-panel" hidden={mobileView !== 'hand'} active={active} cards={cards} actionOptions={state.action_options || []} onCard={setCard} onChooseOption={chooseOption} /><details className="timeline-drawer"><summary><Send size={14} />旅程时间线 <ChevronDown size={14} /></summary><div className="timeline-filter" role="tablist">{(['all', 'action', 'event', 'project'] as const).map(filter => <button key={filter} className={timelineFilter === filter ? 'active' : ''} onClick={() => setTimelineFilter(filter)}>{filter === 'all' ? '全部' : filter === 'action' ? '行动' : filter === 'event' ? '事件' : '项目'}</button>)}</div><div>{filteredTimeline.slice(-8).reverse().map((entry, index) => <p key={`${entry.id}-${index}`}><b>回合 {entry.round}</b>{entry.message}</p>)}</div></details>{toasts.map(item => <div key={item.id} className="toast toast-queue" role="status">{item.text}</div>)}{card && <CardDialog id={card} item={cards[card]} action={findCardAction(legal, 'play_card', card)} onClose={() => setCard(null)} onUse={run} />}{state.pending_choice && <ChoiceDialog state={state} event={currentEvent} onChoose={pendingAction} />}{selectedOption && !mapActionMode && <ActionTargetDialog option={selectedOption} disabled={mutation.isPending} onChoose={target => selectAction(optionAction(selectedOption, target))} onCancel={() => setSelectedOption(null)} />}{preview && <ActionPreview action={preview} sites={sites} cards={cards} onConfirm={() => run(preview)} onCancel={() => setPreview(null)} />}<TutorialGuide open={tutorialOpen} onOpenChange={setTutorialOpen} />{handoffName && <SeatHandoff name={handoffName} onContinue={() => setHandoffName(null)} />}</div>;
}

function MobileHandPanel({ id, hidden, active, cards, actionOptions, onCard, onChooseOption }: { id: string; hidden: boolean; active: GameState['players'][string]; cards: Record<string, ContentCard>; actionOptions: ActionOption[]; onCard: (id: string) => void; onChooseOption: (option: ActionOption) => void }) {
  return <section id={id} className={`mobile-hand-panel ${hidden ? 'mobile-hidden' : ''}`} aria-label="手牌与角色能力"><div className="section-label"><Archive size={15} />文化牌 <b>{active.hand.length} / 3</b></div><div className="mobile-hand-grid">{active.hand.map(id => <button key={id} className="hand-card" onClick={() => onCard(id)}><img src={`/ui-assets/${cards[id]?.icon_asset || 'icon_card_scroll.png'}`} alt="" /><b>{cards[id]?.name || id}</b><small>{cards[id]?.strategic_role || '打开查看这件文化证据'}</small></button>)}</div>{active.action_hand?.length ? <><div className="section-label"><Sparkles size={15} />策略牌</div><div className="mobile-hand-grid">{active.action_hand.map(id => { const option = actionOptions.find(item => item.type === 'use_action_card' && item.id.endsWith(`:${id}`)); return <button key={id} className="hand-card strategy-card" disabled={!option || option.enabled === false} title={option?.disabled_reason || option?.description} onClick={() => option && onChooseOption(option)}><img src="/ui-assets/icon_card_scroll.png" alt="" /><b>{option?.label || id}</b><small>{option?.description || '策略牌效果'}</small></button>; })}</div></> : null}<div className="hand-help">点击文化牌查看详情，策略牌先选择其目标再确认结算。</div></section>;
}

function ActionTargetDialog({ option, disabled, onChoose, onCancel }: { option: ActionOption; disabled: boolean; onChoose: (target: ActionOption['targets'][number]) => void; onCancel: () => void }) {
  const ref = useDialogFocus(); return <div className="dialog-backdrop"><section ref={ref} className="dialog choice-dialog action-target-dialog" role="dialog" aria-modal="true" aria-labelledby="action-target-title" aria-describedby="action-target-description"><button className="dialog-close" disabled={disabled} onClick={onCancel} aria-label="取消目标选择"><X /></button><span className="eyebrow">行动目标</span><h2 id="action-target-title">{option.label}</h2><p id="action-target-description">{option.confirmation || option.description || '选择一个合法目标后继续。'}</p><div className="choice-list">{option.targets.map(target => <button className="choice-option" key={target.id} disabled={disabled} onClick={() => onChoose(target)}><span><b>{target.label}</b><small>{previewDeltaText(target.preview_delta, `${option.cost?.ap || 0} 点行动力`)}</small></span><ChevronDown size={16} /></button>)}</div><button className="ghost-button" disabled={disabled} onClick={onCancel}>返回浏览</button></section></div>;
}

function CardDialog({ id, item, action, onClose, onUse }: { id: string; item?: ContentCard; action?: Action; onClose: () => void; onUse: (action?: Action) => void }) { const ref = useDialogFocus(); return <div className="dialog-backdrop"><section ref={ref} className="dialog card-dialog" role="dialog" aria-modal="true" aria-labelledby="card-dialog-title"><button className="dialog-close" onClick={onClose} aria-label="关闭"><X /></button><img className="dialog-card-art" src={`/ui-assets/${item?.icon_asset || 'icon_card_scroll.png'}`} alt="" /><span className="eyebrow">文化证据</span><h2 id="card-dialog-title">{item?.name || id}</h2><p>{item?.description || item?.summary || '一份等待被理解并投入合适地点的文化记录。'}</p>{item?.combo_name && <p className="card-combo"><b>{item.combo_name}</b> · {item.combo_reward_text || item.instant_use_text}</p>}<button className="primary-cta" disabled={!action} onClick={() => onUse(action)}>{action ? '使用这张牌' : '当前不可使用'}</button></section></div>; }
function ChoiceDialog({ state, event, onChoose }: { state: GameState; event?: ContentEvent; onChoose: (action: Action) => void }) { const isEvent = state.pending_choice?.kind === 'event'; if (state.pending_choice?.kind === 'role_upgrade') return <RoleUpgradeDialog state={state} onChoose={onChoose} />; const ref = useDialogFocus(); return <div className="dialog-backdrop"><section ref={ref} className="dialog choice-dialog" role="dialog" aria-modal="true" aria-labelledby="choice-dialog-title"><span className="eyebrow">{isEvent ? '世界事件 · 需要回应' : '共同决定'}</span><h2 id="choice-dialog-title">{event?.name || (isEvent ? '线路正在等待回应' : '从市场中选择一件证据')}</h2><p>{event?.forecast_text || event?.description || '你的选择会立即改变本回合的风险与资源。'}</p>{isEvent && state.shared.event_targets?.length ? <div className="choice-hint"><b>已锁定影响范围</b><span>{state.shared.event_targets.length} 个目标已由本局种子确定，选择会改变这些目标的结果。</span></div> : null}{event?.mitigation_hint && <div className="choice-hint"><b>应对建议</b><span>{event.mitigation_hint}</span></div>}<div className="choice-list">{state.legal_actions.map((action, index) => <button key={`${action.type}-${index}`} onClick={() => onChoose(action)}><span><b>{action.label}</b><small>{isEvent ? '选择后立即结算后果' : '确认此项决定'}</small></span><ChevronDown size={16} /></button>)}</div></section></div>; }
function RoleUpgradeDialog({ state, onChoose }: { state: GameState; onChoose: (action: Action) => void }) { const options = (state.pending_choice?.options || []) as Array<{ id: string; name?: string; description?: string; trigger?: string; strategic_direction?: string; label?: string }>; const ref = useDialogFocus(); return <div className="dialog-backdrop"><section ref={ref} className="dialog role-upgrade-dialog" role="dialog" aria-modal="true" aria-labelledby="upgrade-dialog-title"><span className="eyebrow"><ShieldCheck size={15} />角色专长</span><h2 id="upgrade-dialog-title">为下一段旅程选择持续专长</h2><p>专长会保留到本局结束，并在描述的触发条件满足时生效。</p><div className="upgrade-options">{options.map(option => { const action = state.legal_actions.find(item => item.upgrade_id === option.id); return <button key={option.id} disabled={!action} onClick={() => action && onChoose(action)}><span><b>{option.name || option.label || '角色专长'}</b><small>{option.description || '选择后会持续改变该角色的行动方式。'}</small>{option.trigger && <i>触发：{option.trigger}</i>}</span><em>{option.strategic_direction || '长期协作'}</em></button>; })}</div></section></div>; }
