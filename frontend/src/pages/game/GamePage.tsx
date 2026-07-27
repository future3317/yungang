import { useEffect, useState } from 'react';
import { Archive, ChevronDown, CircleAlert, Clock3, Map as MapIcon, Send, ShieldCheck, Target, Users, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useParams } from 'react-router-dom';
import { ApiError, api } from '../../shared/api/client';
import type { Action, ActionType, ContentCard, ContentEvent, GameState, Meta, Site } from '../../types/game';
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
import '../../styles/experience.css';
import '../../styles/tutorial.css';
import '../../styles/interface-scale.css';
import '../../styles/handoff.css';
import '../../styles/fullscreen-map.css';

type ActionMode = Extract<ActionType, 'move' | 'explore' | 'contribute' | 'restore' | 'survey_route' | 'restore_route' | 'establish_connection' | 'exchange' | 'plan'> | null;
const actionOrder: ActionType[] = ['move', 'plan', 'survey_route', 'explore', 'contribute', 'restore', 'restore_route', 'establish_connection', 'exchange', 'prepare', 'use_action_card', 'use_skill', 'end_planning', 'end_turn'];
const actionLabels: Partial<Record<ActionType, string>> = { move: '移动', survey_route: '勘察路线', explore: '探索', contribute: '贡献', restore: '修护节点', restore_route: '修护路线', establish_connection: '建立连接', exchange: '交换', prepare: '准备', use_action_card: '使用策略牌', use_skill: '技能', end_planning: '开始行动', end_turn: '结束回合', plan: '规划' };

function findCardAction(actions: Action[], type: ActionType, cardId: string) { return actions.find(action => action.type === type && action.card_id === cardId); }
function actionModeLabel(mode: ActionMode) { return mode ? actionLabels[mode] || mode : ''; }
const roleBadgeAssets: Record<string, string> = { pingcheng_artisan: 'role-badge-artisan.png', western_dancer: 'role-badge-dancer.png', grassland_rider: 'role-badge-rider.png', central_scribe: 'role-badge-scribe.png' };
function roleBadgeAsset(roleId: string | undefined, fallback?: string) { return roleBadgeAssets[roleId || ''] ? `ornaments/${roleBadgeAssets[roleId || '']}` : fallback || 'icon_role_scribe.png'; }
function actionFeedback(action: Action) { const copy: Partial<Record<ActionType, string>> = { move: '已抵达新地点。现在可以查看任务、探索证据或修护风险。', explore: '文化证据已进入手牌，可用于当前任务或立即使用。', contribute: '证据已投入任务，组合条件满足后任务会完成。', restore: '节点损伤已降低，可以继续推进当前项目。', survey_route: '路线风险已被勘察，下一步可以修护或绕行。', restore_route: '路线已恢复通行，新的协作路径已经打开。', establish_connection: '地点之间已建立稳定连接。', use_action_card: '策略牌已结算，并补入下一张策略牌。', end_planning: '规划已结算，现在开始本轮行动。' }; return copy[action.type] || '行动已记录，世界状态已更新。'; }

export function GamePage() {
  const { sessionId = '', roomId = '' } = useParams();
  const queryClient = useQueryClient();
  const [focus, setFocus] = useState<string | null>(null);
  const [card, setCard] = useState<string | null>(null);
  const [preview, setPreview] = useState<Action | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [eventChoiceOpen, setEventChoiceOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'map' | 'mission' | 'hand'>('map');
  const [toast, setToast] = useState('');
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [handoffName, setHandoffName] = useState<string | null>(null);
  const [roomToken] = useState(() => roomId ? window.localStorage.getItem(`yungang-room-token:${roomId}`) || '' : '');
  const gameQuery = useQuery<GameState>({ queryKey: [roomId ? 'room-game' : 'game', roomId || sessionId, roomToken], queryFn: () => roomId ? api.roomGame(roomId, roomToken) : api.game(sessionId), refetchOnWindowFocus: false, refetchInterval: roomId ? 2500 : false });
  const metaQuery = useQuery<Meta>({ queryKey: ['meta'], queryFn: api.meta });
  const state = gameQuery.data;
  const legal = state?.legal_actions || [];
  const canAct = state?.viewer?.can_act ?? true;
  const mutation = useMutation({
    mutationFn: (action: Action) => roomId ? api.roomAction(roomId, roomToken, action, state?.revision || 0) : api.action(sessionId, action, state?.shared.active_player_id || '', state?.revision || 0),
    onSuccess: (data, action) => { queryClient.setQueryData([roomId ? 'room-game' : 'game', roomId || sessionId, roomToken], data); setPreview(null); setActionMode(null); setEventChoiceOpen(false); if (action.type === 'move' && action.target_id) { setFocus(action.target_id); setInspectorOpen(true); } if (data.viewer?.play_mode === 'local' && action.type === 'end_turn' && data.players[data.shared.active_player_id]) setHandoffName(data.players[data.shared.active_player_id].name); setToast(actionFeedback(action)); window.setTimeout(() => setToast(''), 4200); },
    onError: error => { if (error instanceof ApiError && error.status === 409) { const current = (error.payload as { detail?: { current_state?: GameState } })?.detail?.current_state; if (current) { queryClient.setQueryData([roomId ? 'room-game' : 'game', roomId || sessionId, roomToken], current); setActionMode(null); setPreview(null); setToast('状态已同步，请重新选择行动。'); return; } } setActionMode(null); setPreview(null); setToast(error instanceof Error ? error.message : '同步失败，请稍后重试。'); }
  });
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setActionMode(null); setCard(null); setPreview(null); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);
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
  if (state.shared.outcome) return <Navigate to={`/result/${state.session_id}`} replace />;

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
  const targetIds = new Set(legal.filter(action => action.type === actionMode).map(action => action.target_id || action.target_site_id).filter((id): id is string => Boolean(id)));
  const actionsByType = new Map(actionOrder.map(type => [type, legal.filter(action => action.type === type)]));
  const connection = mutation.isPending || gameQuery.isFetching || metaQuery.isFetching ? '同步中' : '已连接';
  const run = (action?: Action) => { if (action && canAct && !mutation.isPending) mutation.mutate(action); };
  const chooseAction = (type: ActionType) => { if (!canAct) return; const actions = actionsByType.get(type) || []; if (type === 'resolve_event') { if (state.pending_choice?.kind === 'event' && actions.length) setEventChoiceOpen(true); return; } if (!actions.length) return; if (type === 'use_skill' || type === 'use_action_card' || type === 'end_turn' || type === 'end_planning' || type === 'prepare') { run(actions[0]); return; } setActionMode(type as ActionMode); if (type === 'explore') setInspectorOpen(true); if (['move', 'restore', 'survey_route', 'restore_route', 'establish_connection'].includes(type)) setFocus(active.location); };
  const selectAction = (action: Action) => { setActionMode(null); setPreview(action); };
  const selectNode = (id: string) => { const mapModes = ['move', 'restore', 'survey_route', 'restore_route', 'establish_connection']; const target = actionMode && mapModes.includes(actionMode) ? legal.find(action => action.type === actionMode && (action.target_id === id || action.target_site_id === id)) : undefined; if (target) { selectAction(target); return; } setFocus(id); setInspectorOpen(true); };
  const mapActionMode = actionMode && ['move', 'restore', 'survey_route', 'restore_route', 'establish_connection'].includes(actionMode) ? actionMode as Extract<ActionType, 'move' | 'restore' | 'survey_route' | 'restore_route' | 'establish_connection'> : null;
  const selectExploreCard = (id: string) => { const action = findCardAction(legal, 'explore', id); if (action) selectAction(action); };
  const selectContribution = (id: string) => { const action = findCardAction(legal, 'contribute', id); if (actionMode === 'contribute' && action) selectAction(action); else if (action) setActionMode('contribute'); else setCard(id); };
  const pendingAction = (action: Action) => state.pending_choice?.kind === 'action_card' ? selectAction(action) : run(action);

  return <div className="game-shell"><ScenarioHeader state={state} connection={connection} /><div className="mobile-tabs" role="tablist"><button className={mobileView === 'map' ? 'active' : ''} onClick={() => setMobileView('map')}><MapIcon size={16} />地图</button><button className={mobileView === 'mission' ? 'active' : ''} onClick={() => setMobileView('mission')}><Target size={16} />地点</button><button className={mobileView === 'hand' ? 'active' : ''} onClick={() => setMobileView('hand')}><Archive size={16} />手牌</button></div><main className={`game-grid ${inspectorOpen ? '' : 'inspector-collapsed'}`}>
    <aside className={`roster-column ${mobileView !== 'map' ? 'mobile-hidden' : ''}`}><section className="roster"><div className="section-label"><Users size={14} />共同旅伴</div>{state.shared.player_order.map(id => { const player = state.players[id]; const role = roles[player.role_id]; return <button key={id} className={`roster-row ${id === state.shared.active_player_id ? 'active' : ''}`} onClick={() => setFocus(player.location)}><img src={`/ui-assets/${roleBadgeAsset(player.role_id, role?.icon_asset)}`} alt="" /><span><b>{player.name}</b><small>{role?.name || player.role_id} · {sites[player.location]?.name || player.location}</small></span><strong>{player.ap} <small>AP</small></strong></button>; })}</section><section className="current-player"><div className="section-label">当前行动者</div><h2>{active.name}</h2><p>{roles[active.role_id]?.name || active.role_id}</p><div className="player-resources"><span><b>{active.ap}</b><small>行动点</small></span><span><b>{active.influence}</b><small>个人影响</small></span><span><b>{state.shared.restoration_resource}</b><small>修护资源</small></span></div></section><CommandDock state={state} active={active} cards={cards} legal={legal} actionsByType={actionsByType} actionMode={actionMode} actionLabels={actionLabels} mutationPending={mutation.isPending} onRun={run} onChoose={chooseAction} onCancel={() => setActionMode(null)} onCard={setCard} onContribution={selectContribution} /></aside>
    <section className={`stage-column ${mobileView !== 'map' ? 'mobile-hidden' : ''}`}><RoundSummary state={state} sites={sites} /><div className="stage-heading"><div><span className="eyebrow">石窟光谱 / Cave Light Atlas</span><h1>遗产节点网络</h1></div><span className="turn-badge"><Clock3 size={14} />回合 {state.shared.turn}</span></div><div className="network-stage">{state.shared.phase === 'planning' && <PlanningPhase state={state} sites={sites} actions={legal} onChoose={run} />}{actionMode && <div className="mode-strip" role="status" aria-live="polite">正在选择{actionModeLabel(actionMode)}目标 · 已显示 {targetIds.size} 个合法目标 · <button onClick={() => setActionMode(null)}>Escape 取消</button></div>}<ActionTargetGuide mode={actionMode} actions={legal.filter(action => action.type === actionMode)} sites={sites} cards={cards} onRun={selectAction} onCancel={() => setActionMode(null)} /><HeritageNetwork sites={state.sites} metaSites={sites} regions={meta.regions} routes={state.routes} players={Object.values(state.players)} active={active} focusedId={focus} reachableIds={targetIds} actionMode={mapActionMode} onFocus={selectNode} /></div><div className="stage-caption"><div className="scene-thumb"><img src={`/ui-assets/generated/${focusedMeta.scene_asset || 'scene_yungang_day.png'}`} alt="" /></div><div><span className="eyebrow">当前聚焦</span><h2>{focusedMeta.name || focused.id}</h2><p>{focusedMeta.summary || '等待探索后显示节点的文化摘要。'}</p></div><button className="focus-clear" onClick={() => { setFocus(null); setActionMode(null); }} aria-label="取消聚焦"><X size={16} /></button></div></section>
    <SiteInspector state={state} meta={meta} site={focusedMeta} task={task} event={currentEvent} cards={cards} legal={legal} actionMode={actionMode} collapsed={!inspectorOpen} onCollapsedChange={setInspectorOpen} onExplore={selectExploreCard} onSelectAction={chooseAction} /></main>{state.shared.log.length > 0 && <details className="timeline-drawer"><summary><Send size={14} />旅程时间线 <ChevronDown size={14} /></summary><div>{state.shared.log.slice(-5).reverse().map((entry, index) => <p key={`${entry}-${index}`}><b>回合 {state.shared.turn}</b>{entry}</p>)}</div></details>}{toast && <div className="toast" role="status">{toast}</div>}{card && <CardDialog id={card} item={cards[card]} action={findCardAction(legal, 'play_card', card)} onClose={() => setCard(null)} onUse={run} />}{state.pending_choice && <ChoiceDialog state={state} event={currentEvent} onChoose={pendingAction} />}{preview && <ActionPreview action={preview} sites={sites} cards={cards} onConfirm={() => run(preview)} onCancel={() => setPreview(null)} />}<TutorialGuide open={tutorialOpen} onOpenChange={setTutorialOpen} />{handoffName && <SeatHandoff name={handoffName} onContinue={() => setHandoffName(null)} />}</div>;
}

function CardDialog({ id, item, action, onClose, onUse }: { id: string; item?: ContentCard; action?: Action; onClose: () => void; onUse: (action?: Action) => void }) { return <div className="dialog-backdrop"><section className="dialog card-dialog" role="dialog" aria-modal="true"><button className="dialog-close" onClick={onClose} aria-label="关闭"><X /></button><img className="dialog-card-art" src={`/ui-assets/${item?.icon_asset || 'icon_card_scroll.png'}`} alt="" /><span className="eyebrow">文化证据</span><h2>{item?.name || id}</h2><p>{item?.description || item?.summary || '一份等待被理解并投入合适地点的文化记录。'}</p>{item?.combo_name && <p className="card-combo"><b>{item.combo_name}</b> · {item.combo_reward_text || item.instant_use_text}</p>}<button className="primary-cta" disabled={!action} onClick={() => onUse(action)}>{action ? '使用这张牌' : '当前不可使用'}</button></section></div>; }
function ChoiceDialog({ state, event, onChoose }: { state: GameState; event?: ContentEvent; onChoose: (action: Action) => void }) { const isEvent = state.pending_choice?.kind === 'event'; if (state.pending_choice?.kind === 'role_upgrade') return <RoleUpgradeDialog state={state} onChoose={onChoose} />; return <div className="dialog-backdrop"><section className="dialog choice-dialog" role="dialog" aria-modal="true"><span className="eyebrow">{isEvent ? '世界事件 · 需要回应' : '共同决定'}</span><h2>{event?.name || (isEvent ? '线路正在等待回应' : '从市场中选择一件证据')}</h2><p>{event?.forecast_text || event?.description || '你的选择会立即改变本回合的风险与资源。'}</p>{isEvent && state.shared.event_targets?.length ? <div className="choice-hint"><b>已锁定影响范围</b><span>{state.shared.event_targets.length} 个目标已由本局种子确定，选择会改变这些目标的结果。</span></div> : null}{event?.mitigation_hint && <div className="choice-hint"><b>应对建议</b><span>{event.mitigation_hint}</span></div>}<div className="choice-list">{state.legal_actions.map((action, index) => <button key={`${action.type}-${index}`} onClick={() => onChoose(action)}><span><b>{action.label}</b><small>{isEvent ? '选择后立即结算后果' : '确认此项决定'}</small></span><ChevronDown size={16} /></button>)}</div></section></div>; }
function RoleUpgradeDialog({ state, onChoose }: { state: GameState; onChoose: (action: Action) => void }) { const options = (state.pending_choice?.options || []) as Array<{ id: string; name?: string; description?: string; trigger?: string; strategic_direction?: string; label?: string }>; return <div className="dialog-backdrop"><section className="dialog role-upgrade-dialog" role="dialog" aria-modal="true" aria-label="选择角色专长"><span className="eyebrow"><ShieldCheck size={15} />角色专长</span><h2>为下一段旅程选择持续专长</h2><p>专长会保留到本局结束，并在描述的触发条件满足时生效。</p><div className="upgrade-options">{options.map(option => { const action = state.legal_actions.find(item => item.upgrade_id === option.id); return <button key={option.id} disabled={!action} onClick={() => action && onChoose(action)}><span><b>{option.name || option.label || '角色专长'}</b><small>{option.description || '选择后会持续改变该角色的行动方式。'}</small>{option.trigger && <i>触发：{option.trigger}</i>}</span><em>{option.strategic_direction || '长期协作'}</em></button>; })}</div></section></div>; }
