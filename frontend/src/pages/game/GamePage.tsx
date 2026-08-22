import { useEffect, useState } from 'react';
import { Archive, ChevronDown, CircleAlert, Clock3, Map as MapIcon, Send, ShieldCheck, Sparkles, Target, Users, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useParams } from 'react-router-dom';
import { ApiError, api } from '../../shared/api/client';
import type { Action, ActionOption, ActionType, ContentCard, ContentEvent, FeedbackChange, GameState, Meta, Site, Task } from '../../types/game';
import { HeritageNetwork } from '../../widgets/heritage-network/HeritageNetwork';
import { CommandDock } from '../../widgets/game/CommandDock';
import { PlanningPhase } from '../../widgets/game/PlanningPhase';
import { ScenarioHeader } from '../../widgets/game/ScenarioHeader';
import { SiteInspector } from '../../widgets/game/SiteInspector';
import { ActionTargetGuide } from '../../widgets/game/JourneyGuide';
import { RoundSummary } from '../../widgets/game/RoundSummary';
import { ActionPreview } from '../../widgets/game/ActionPreview';
import { TutorialGuide } from '../../widgets/game/TutorialGuide';
import { SeatHandoff } from '../../widgets/game/SeatHandoff';
import { useDialogFocus } from '../../widgets/game/useDialogFocus';
import { actionFeedback, actionLabels, actionModeLabel, eventDecisionBrief, feedbackChangeText, findCardAction, localizeActionError, localizeActionText, localizeTimelineMessage, optionAction, previewDeltaText, roleBadgeAsset, type ActionMode } from '../../widgets/game/gameUi';
import { fallbackPollInterval, useRoomEvents, type RoomEventState } from '../../shared/useRoomEvents';
import { getRoomToken } from '../../shared/roomToken';
import { JourneyTimeline } from '../../widgets/game/JourneyTimeline';
import { GameViewport } from '../../widgets/game/GameViewport';
import { StateChangeList } from '../../widgets/game/StateChangeList';

import { StrategyCardDialog } from '../../widgets/game/StrategyCardDialog';
import { EvidenceCardDialog } from '../../widgets/game/EvidenceCardDialog';
import { assetUrl } from '../../shared/assetUrl';
import { tutorialContextForAction, type TutorialContext, useTutorialProgress } from '../../shared/useTutorialProgress';
import '../../styles/experience.css';
import '../../styles/tutorial.css';
import '../../styles/interface-scale.css';
import '../../styles/handoff.css';
import '../../styles/fullscreen-map.css';


export function GamePage() {
  const { sessionId = '', roomId = '' } = useParams();
  const queryClient = useQueryClient();
  const [focus, setFocus] = useState<string | null>(null);
  const [card, setCard] = useState<string | null>(null);
  const [strategyOption, setStrategyOption] = useState<ActionOption | null>(null);
  const [preview, setPreview] = useState<Action | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [mobileView, setMobileView] = useState<'map' | 'mission' | 'hand'>('map');
  const [toasts, setToasts] = useState<Array<{ id: string; text: string }>>([]);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [handoffName, setHandoffName] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<ActionOption | null>(null);
  const [completedTask, setCompletedTask] = useState<{ task: Task; siteName: string; changes: Array<{ label?: string; before?: string | number | null; after?: string | number | null; delta?: number | null }> } | null>(null);
  const [tutorialIntent, setTutorialIntent] = useState<TutorialContext | null>(null);
  const tutorialProgress = useTutorialProgress();
  const [roomToken] = useState(() => roomId ? getRoomToken(roomId) : '');
  const [roomEventState, setRoomEventState] = useState<RoomEventState>('connected');
  const enqueueToast = (text: string) => { const id = crypto.randomUUID(); setToasts(items => [...items.slice(-3), { id, text }]); window.setTimeout(() => setToasts(items => items.filter(item => item.id !== id)), 4800); };
  const gameQuery = useQuery<GameState>({ queryKey: [roomId ? 'room-game' : 'game', roomId || sessionId, roomToken], queryFn: () => roomId ? api.roomGame(roomId, roomToken) : api.game(sessionId), refetchOnWindowFocus: false, refetchInterval: fallbackPollInterval(roomEventState, roomId) });
  useRoomEvents({ roomId, token: roomToken, onRevision: () => { void queryClient.invalidateQueries({ queryKey: ['room-game', roomId, roomToken] }); }, onState: setRoomEventState });
  const metaQuery = useQuery<Meta>({ queryKey: ['meta'], queryFn: api.meta });
  const state = gameQuery.data;
  useEffect(() => {
    if (state?.shared.current_event_id && !tutorialProgress.hasSeenContext('resolve_event')) {
      setTutorialIntent('resolve_event');
      setTutorialOpen(true);
    }
  }, [state?.shared.current_event_id, tutorialProgress.hasSeenContext]);  const actionOptions = state?.action_options || [];
  const legal = actionOptions.flatMap(option => option.targets.length ? option.targets.map(target => optionAction(option, target)) : [optionAction(option)]);
  const canAct = state?.viewer?.can_act ?? true;
  const mutation = useMutation({
    mutationFn: (action: Action) => roomId ? api.roomAction(roomId, roomToken, action, state?.revision || 0) : api.action(sessionId, action, state?.shared.active_player_id || '', state?.revision || 0),
    onSuccess: (data, action) => { queryClient.setQueryData([roomId ? 'room-game' : 'game', roomId || sessionId, roomToken], data); setPreview(null); setSelectedOption(null); setActionMode(null); if (action.type === 'move' && action.target_id) { setFocus(action.target_id); setInspectorOpen(true); } if (action.type === 'choose_intervention') { const newlyCompleted = Object.values(data.tasks).find(nextTask => nextTask.completed && !state?.tasks[nextTask.id || '']?.completed); if (newlyCompleted) { const completedSite = Object.values(data.sites).find(item => item.active_task_id === newlyCompleted.id); setCompletedTask({ task: newlyCompleted, siteName: completedSite?.id || '当前节点', changes: (data.feedback_events || []).flatMap(event => event.changes || []) }); } } if (data.viewer?.play_mode === 'local' && action.type === 'end_turn' && data.players[data.shared.active_player_id]) setHandoffName(data.players[data.shared.active_player_id].name); if (action.type === 'end_turn' && state?.shared.current_event_id !== data.shared.current_event_id && data.shared.current_event_id) { const settledName = currentEvent?.name || '上一轮事件'; const nextName = meta.events?.find(item => item.id === data.shared.current_event_id)?.name || '新的世界事件'; enqueueToast(`${settledName}已结算，${nextName}已揭示。`); } (data.feedback_events?.length ? data.feedback_events : [{ message: actionFeedback(action, state, data), changes: [] }]).forEach((event, index) => window.setTimeout(() => enqueueToast([event.message, ...feedbackChangeText(event.changes || [])].filter(Boolean).join(' · ')), index * 180)); },
    onError: error => { if (error instanceof ApiError && error.status === 409) { const current = (error.payload as { detail?: { current_state?: GameState } })?.detail?.current_state; if (current) { queryClient.setQueryData([roomId ? 'room-game' : 'game', roomId || sessionId, roomToken], current); setActionMode(null); setSelectedOption(null); setPreview(null); setCard(null); setStrategyOption(null); enqueueToast('\u72b6\u6001\u5df2\u540c\u6b65\uff0c\u8bf7\u91cd\u65b0\u9009\u62e9\u884c\u52a8\u3002'); return; } } setActionMode(null); setSelectedOption(null); setPreview(null); enqueueToast(localizeActionError(error)); }
  });
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setActionMode(null); setSelectedOption(null); setCard(null); setPreview(null); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);
  if (gameQuery.isLoading || metaQuery.isLoading) return <div className="state-screen"><span className="loading-orbit" /><p>正在读取遗产网络…</p></div>;
  if (gameQuery.isError || metaQuery.isError || !state || !metaQuery.data) return <div className="state-screen danger"><CircleAlert /><h1>旅程暂时无法打开</h1><p>请检查本地服务后重新进入旅程。</p><button className="ghost-button" onClick={() => { void gameQuery.refetch(); void metaQuery.refetch(); }}>重新连接</button><button className="ghost-button" onClick={() => window.location.assign('/')}>返回首页</button></div>;
  if (state.shared.outcome) return <Navigate to={roomId ? `/room/${roomId}/result` : `/result/${state.session_id}`} replace />;

  const meta = metaQuery.data;
  const active = state.players[state.shared.active_player_id];
  const sites = Object.fromEntries(meta.sites.map(site => [site.id, site]));
  const cards = Object.fromEntries(meta.cards.map(item => [item.id, item]));
  const actionCards = Object.fromEntries((meta.action_cards || []).map(item => [String(item.id), item]));
  const events = Object.fromEntries(meta.events.map(item => [item.id, item]));
  const roles = Object.fromEntries(meta.roles.map(item => [item.id, item]));
  const focused: Site = state.sites[focus || active.location] || state.sites[active.location] || Object.values(state.sites)[0];
  const focusedMeta = sites[focused.id] || focused;
  const task = focusedMeta.active_task_id ? state.tasks[focusedMeta.active_task_id] : undefined;
  const currentEvent = state.shared.current_event_id ? events[state.shared.current_event_id] : undefined;
  const eventTargetIds = state.shared.event_targets?.length ? state.shared.event_targets : (state.shared.event_instance?.revealed_targets || []);
  const eventTargetLabels = eventTargetIds.map(id => sites[id]?.name || state.routes?.[id]?.name || '事件目标');
  const eventOpenTargetLabels = eventTargetIds.filter(id => state.routes?.[id] ? state.routes[id].status !== 'blocked' : state.sites[id]?.status !== 'closed').map(id => sites[id]?.name || state.routes?.[id]?.name || '事件目标');
  const targetIds = new Set((selectedOption?.type === actionMode ? selectedOption.targets : []).map(target => String(target.payload?.target_id || target.payload?.target_site_id || target.id)));
  const modeStatus = actionMode === 'explore' ? `正在选择文化线索 · 公开市场显示 ${state.market.length} 张可取线索 · Escape 取消` : `正在选择${actionModeLabel(actionMode)}目标 · 已显示 ${targetIds.size} 个合法目标 · Escape 取消`;
  const connection = mutation.isPending || gameQuery.isFetching || metaQuery.isFetching ? '同步中' : roomEventState === 'unauthorized' ? '席位失效' : roomEventState === 'room_ended' ? '旅程已结束' : roomEventState === 'retrying' ? '重连中' : roomEventState === 'ended' ? '重新连接' : '已连接';
  const run = (action?: Action) => { if (roomId && roomEventState === 'unauthorized') { enqueueToast('\u5e2d\u4f4d\u51ed\u8bc1\u5df2\u5931\u6548\uff0c\u8bf7\u8fd4\u56de\u623f\u95f4\u6062\u590d\u3002'); return; } if (action && canAct && !mutation.isPending) mutation.mutate({ ...action, request_id: action.request_id || crypto.randomUUID() }); };
  const announceIntent = (type: ActionType) => {
    const context = tutorialContextForAction(type);
    if (context && !tutorialProgress.hasSeenContext(context)) { setTutorialIntent(context); setTutorialOpen(true); }
  };
 const chooseOption = (option: ActionOption) => { if (!canAct || option.enabled === false) return; announceIntent(option.type); if (option.type === 'explore' && option.targets.length !== 1) { setSelectedOption(null); setActionMode('explore'); setInspectorOpen(true); return; } if (option.targets.length === 1) { selectAction(optionAction(option, option.targets[0])); return; } if (option.targets.length) { setSelectedOption(option); if (['move', 'restore', 'survey_route', 'restore_route', 'establish_connection'].includes(option.type)) { setActionMode(option.type as ActionMode); setFocus(active.location); } else setActionMode(null); return; } const action = optionAction(option); if (option.type === 'end_turn') { const weathering = state.shared.weathering_track ?? state.shared.threat ?? 0; const isFinalPlayer = state.shared.player_order[state.shared.player_order.length - 1] === active.id; const warnings = [active.ap > 0 ? `你还有 ${active.ap} 点行动力未使用` : '', isFinalPlayer && state.shared.current_event_id ? '当前事件将在回合结束时结算' : '', weathering >= Math.max(0, (state.shared.weathering_limit || 5) - 1) ? '风化压力已经接近上限' : ''].filter(Boolean); const handoff = isFinalPlayer ? '确认结束团队本轮行动，随后进入事件结算。' : '确认结束这位角色的行动，交给下一位同行者；事件暂不结算。'; setPreview({ ...action, description: warnings.length ? `${warnings.join('；')}。${handoff}` : handoff }); return; } if (['use_skill', 'use_node_ability', 'use_upgrade', 'end_planning', 'prepare'].includes(option.type)) setPreview(action); else run(action); };
  const chooseAction = (type: ActionType) => { const option = state.action_options?.find(item => item.type === type && item.enabled !== false); if (option) chooseOption(option); };
  const selectAction = (action: Action) => { setActionMode(null); setSelectedOption(null); setPreview(action); };
  const selectNode = (id: string) => { const target = mapActionMode && selectedOption?.type === actionMode ? selectedOption.targets.find(item => { const payload = item.payload || {}; return item.id === id || payload.target_id === id || payload.target_site_id === id || payload.route_id === id; }) : undefined; if (target && selectedOption) { selectAction(optionAction(selectedOption, target)); return; } setFocus(id); setInspectorOpen(true); };
  const mapActionMode = actionMode && ['move', 'restore', 'survey_route', 'restore_route', 'establish_connection'].includes(actionMode) ? actionMode as Extract<ActionType, 'move' | 'restore' | 'survey_route' | 'restore_route' | 'establish_connection'> : null;
  const selectExploreCard = (id: string) => { const option = state.action_options?.find(item => item.type === 'explore' && item.targets.some(target => target.payload?.card_id === id)); const target = option?.targets.find(item => item.payload?.card_id === id); if (option && target) selectAction(optionAction(option, target)); };
  const selectInterpretation = (cardId: string, relation: 'support' | 'conflict' | 'pending') => { announceIntent('interpret_evidence'); const action = legal.find(item => item.type === 'interpret_evidence' && item.card_id === cardId && item.target_id === relation); if (action) selectAction(action); };
  const formInterpretation = () => { const action = legal.find(item => item.type === 'form_interpretation'); if (action) selectAction(action); };
  const chooseIntervention = (choice: 'act_now' | 'minimal' | 'record') => { const action = legal.find(item => item.type === 'choose_intervention' && item.target_id === choice); if (action) selectAction(action); };
  const pendingAction = (action: Action) => state.pending_choice?.kind === 'action_card' ? (announceIntent('use_action_card'), selectAction(action)) : run(action);

  const timelineEvents = (state.shared.journal?.length ? state.shared.journal : state.shared.log.map((message, index) => ({ id: `legacy-${index}`, round: state.shared.turn, type: 'action', message, effects: [], created_at: '', player_id: state.shared.active_player_id }))).map(entry => ({ ...entry, player_name: entry.player_id ? state.players[entry.player_id]?.name : undefined, message: localizeTimelineMessage(entry.message, { sites, routes: state.routes || {}, projects: state.projects || {}, players: state.players }) }));
  const summaryEventId = typeof state.shared.round_summary?.event_id === 'string' ? state.shared.round_summary.event_id : undefined;
  const hasExplicitFocus = focus !== null;
  const imageFallback = (event: React.SyntheticEvent<HTMLImageElement>) => { const image = event.currentTarget; if (image.dataset.fallback) { image.style.display = 'none'; image.parentElement?.classList.add('scene-art-failed'); return; } image.dataset.fallback = 'true'; image.src = assetUrl('generated/scene_yungang_day.webp'); };
  return <GameViewport><div className="game-shell"><div className="hud-slot hud-slot-top"><ScenarioHeader state={state} scenarioName={meta.scenarios?.find(item => item.id === (state.scenario_id || state.shared.scenario_id))?.name || '未命名旅程'} connection={connection} eventSummary={{ name: currentEvent?.name, targets: eventOpenTargetLabels, historyCount: timelineEvents.filter(entry => entry.type === 'event').length }} /></div><div className="mobile-tabs" role="tablist" aria-label="游戏内容"><button role="tab" aria-selected={mobileView === 'map'} aria-controls="mobile-map-panel" className={mobileView === 'map' ? 'active' : ''} onClick={() => setMobileView('map')}><MapIcon size={16} />地图</button><button role="tab" aria-selected={mobileView === 'mission'} aria-controls="mobile-mission-panel" className={mobileView === 'mission' ? 'active' : ''} onClick={() => setMobileView('mission')}><Target size={16} />地点</button><button role="tab" aria-selected={mobileView === 'hand'} aria-controls="mobile-hand-panel" className={mobileView === 'hand' ? 'active' : ''} onClick={() => setMobileView('hand')}><Archive size={16} />手牌</button></div><main className={`game-grid hud-slot hud-slot-center ${inspectorOpen ? '' : 'inspector-collapsed'}`}>
    <aside className={`roster-column hud-slot hud-slot-left ${mobileView !== 'map' ? 'mobile-hidden' : ''}`} id="mobile-map-panel"><section className="roster"><div className="section-label"><Users size={14} />共同旅伴</div>{state.shared.player_order.map(id => { const player = state.players[id]; const role = roles[player.role_id]; return <button key={id} className={`roster-row ${id === state.shared.active_player_id ? 'active' : ''}`} onClick={() => setFocus(player.location)}><img src={assetUrl(roleBadgeAsset(player.role_id, role?.icon_asset))} alt="" /><span><b>{player.name}</b><small>{role?.name || player.role_id} · {sites[player.location]?.name || player.location}</small></span><strong>{player.ap} <small>AP</small></strong></button>; })}</section><section className="current-player"><div className="section-label">当前行动者</div><h2>{active.name}</h2><p>{roles[active.role_id]?.name || active.role_id}</p><div className="player-resources"><span title="本回合可用于移动、寻访和其他行动"><b>{active.ap}</b><small>行动点</small></span><span title="记录这位角色对团队解释的贡献"><b>{active.influence}</b><small>个人声望</small></span><span title="团队修护资源不足时，可由这位角色代付修护"><b>{active.supplies || 0}</b><small>个人补给</small></span></div></section><PlanningPhase state={state} sites={sites} routes={state.routes} projects={state.projects} actions={legal} canAct={canAct && !mutation.isPending} onChoose={run} /><CommandDock state={state} active={active} cards={cards} actionCards={actionCards} legal={legal} actionOptions={actionOptions} actionMode={actionMode} actionLabels={actionLabels} mutationPending={mutation.isPending} canAct={canAct} onRun={run} onChooseOption={chooseOption} onCancel={() => { setActionMode(null); setSelectedOption(null); }} onCard={setCard} /></aside>
    <section className={`stage-column hud-slot hud-slot-world ${mobileView !== 'map' ? 'mobile-hidden' : ''}`}><RoundSummary state={state} sites={sites} routes={state.routes} eventName={summaryEventId ? events[summaryEventId]?.name : undefined} /><div className="stage-heading"><div><span className="eyebrow">当前地图</span><h1>云冈行旅地图</h1></div><span className="turn-badge"><Clock3 size={14} />回合 {state.shared.turn}</span></div><div className="network-stage">{actionMode && <div className="mode-strip" role="status" aria-live="polite">{modeStatus} <button onClick={() => { setActionMode(null); setSelectedOption(null); }}>取消选择</button></div>}<ActionTargetGuide mode={actionMode === 'explore' ? null : actionMode} actions={(selectedOption?.type === actionMode ? selectedOption.targets.map(target => optionAction(selectedOption, target)) : [])} sites={sites} routes={state.routes} cards={cards} onRun={selectAction} onCancel={() => { setActionMode(null); setSelectedOption(null); }} /><HeritageNetwork sites={state.sites} metaSites={sites} regions={meta.regions} routes={state.routes} players={Object.values(state.players)} active={active} focusedId={focus} reachableIds={targetIds} actionMode={mapActionMode} eventTargetIds={eventTargetIds} eventTargetLabels={eventTargetLabels} eventName={currentEvent?.name} onFocus={selectNode} /></div><div className="stage-caption" data-focused={hasExplicitFocus ? 'true' : 'false'}><div className="scene-thumb"><img src={assetUrl(focusedMeta.scene_asset, 'generated/scene_yungang_day.webp')} onError={imageFallback} alt="当前聚焦地点场景" /></div><div><span className="eyebrow">当前聚焦</span><h2>{focusedMeta.name || focused.id}</h2><p>{focusedMeta.summary || '等待探索后显示节点的文化摘要。'}</p></div><button className="focus-clear" onClick={() => { setFocus(null); setActionMode(null); setSelectedOption(null); }} aria-label="取消聚焦"><X size={16} /></button></div></section><SiteInspector state={state} meta={meta} site={focusedMeta} task={task} event={currentEvent} cards={cards} legal={legal} actionMode={actionMode} eventTargetLabels={eventTargetLabels} eventTargetIds={eventTargetIds} eventOpenTargetLabels={eventOpenTargetLabels} canAct={canAct} collapsed={!inspectorOpen} onCollapsedChange={setInspectorOpen} onExplore={selectExploreCard} actionOptions={actionOptions} onSelectAction={chooseAction} onInterpret={selectInterpretation} onFormInterpretation={formInterpretation} onChooseIntervention={chooseIntervention} className={`hud-slot hud-slot-right ${mobileView !== 'mission' ? 'mobile-hidden' : ''}`} /></main><MobileHandPanel id="mobile-hand-panel" hidden={mobileView !== 'hand'} active={active} cards={cards} actionCards={actionCards} actionOptions={actionOptions} onCard={setCard} onChooseOption={chooseOption} onStrategy={setStrategyOption} /><div className="hud-slot hud-slot-bottom"><JourneyTimeline entries={timelineEvents} /></div><div className="hud-overlay-layer">{roomId && roomEventState === 'unauthorized' && <div className="room-state-notice" role="alert"><h2>\u5e2d\u4f4d\u9700\u8981\u6062\u590d</h2><p>\u5f53\u524d\u5e2d\u4f4d\u51ed\u8bc1\u5df2\u5931\u6548\uff0c\u8bf7\u56de\u5230\u623f\u95f4\u91cd\u65b0\u6062\u590d\u540c\u4e00\u5e2d\u4f4d\u3002</p><button className="primary-cta" onClick={() => window.location.assign('/room/' + roomId)}>\u8fd4\u56de\u623f\u95f4\u6062\u590d</button></div>}{toasts.map(item => <div key={item.id} className="toast toast-queue" role="status">{item.text}</div>)}{completedTask && <TaskCompleteDialog task={completedTask.task} siteName={sites[completedTask.siteName]?.name || focusedMeta.name || '当前节点'} changes={completedTask.changes} onClose={() => setCompletedTask(null)} />}{card && <EvidenceCardDialog id={card} item={cards[card]} action={findCardAction(legal, 'play_card', card)} interpretActions={legal.filter(item => item.type === 'interpret_evidence' && item.card_id === card)} onClose={() => setCard(null)} onUse={action => { setCard(null); if (action) setPreview(action); }} />}{state.pending_choice && <ChoiceDialog state={state} event={currentEvent} disabled={mutation.isPending} onChoose={pendingAction} />}{selectedOption && !mapActionMode && <ActionTargetDialog option={selectedOption} disabled={mutation.isPending} onChoose={target => selectAction(optionAction(selectedOption, target))} onCancel={() => { setActionMode(null); setSelectedOption(null); }} />}{preview && <ActionPreview action={preview} sites={sites} routes={state.routes} cards={cards} players={state.players} isPending={mutation.isPending} onConfirm={() => run(preview)} onCancel={() => setPreview(null)} />}<TutorialGuide open={tutorialOpen} onOpenChange={open => { setTutorialOpen(open); if (!open) setTutorialIntent(null); }} state={state} actionOptions={actionOptions} triggerAction={tutorialIntent} progress={tutorialProgress} />{handoffName && <SeatHandoff name={handoffName} onContinue={() => setHandoffName(null)} />}{strategyOption && <StrategyCardDialog option={strategyOption} disabled={mutation.isPending} onClose={() => setStrategyOption(null)} onConfirm={option => { setStrategyOption(null); chooseOption(option); }} />}</div></div></GameViewport>;
}

function TaskCompleteDialog({ task, siteName, changes, onClose }: { task: Task; siteName: string; changes: Array<{ label?: string; before?: string | number | null; after?: string | number | null; delta?: number | null }>; onClose: () => void }) {
  const ref = useDialogFocus();
  return <div className="dialog-backdrop"><section ref={ref} className="dialog task-complete-dialog" role="dialog" aria-modal="true" aria-labelledby="task-complete-title"><span className="eyebrow"><ShieldCheck size={15} />互证完成</span><h2 id="task-complete-title">{task.name}</h2><p>{siteName} 的线索已彼此照见。你们已经完成一段可被共同引用的文化解释。</p><div className="task-complete-reward"><b>本次改变</b>{changes.length ? <StateChangeList changes={changes} /> : <span>解释已写入遗产网络，地图与旅程记录已更新。</span>}<span>对应领域印记已加入图卷</span></div><button className="primary-cta" onClick={onClose}>继续旅程</button></section></div>;
}
function MobileHandPanel({ id, hidden, active, cards, actionCards = {}, actionOptions, onCard, onChooseOption, onStrategy }: { id: string; hidden: boolean; active: GameState['players'][string]; cards: Record<string, ContentCard>; actionCards?: Record<string, Record<string, unknown>>; actionOptions: ActionOption[]; onCard: (id: string) => void; onChooseOption: (option: ActionOption) => void; onStrategy: (option: ActionOption) => void }) {
  return <section id={id} className={`mobile-hand-panel ${hidden ? 'mobile-hidden' : ''}`} aria-label="手牌与角色能力"><div className="section-label"><Archive size={15} />文化牌 <b>{active.hand.length} / 3</b></div><div className="mobile-hand-grid">{active.hand.map(id => <button key={id} className="hand-card" onClick={() => onCard(id)}><img src={assetUrl(cards[id]?.icon_asset)} alt="" /><b>{cards[id]?.name || id}</b><small>{cards[id]?.strategic_role || '打开查看这件文化证据'}</small></button>)}</div>{active.action_hand?.length ? <><div className="section-label"><Sparkles size={15} />策略牌</div><div className="mobile-hand-grid">{active.action_hand.map(id => { const definition = actionCards[id] || {}; const option = actionOptions.find(item => item.type === 'use_action_card' && item.id.endsWith(`:${id}`)) || { id: `action:use_action_card:${id}`, type: 'use_action_card' as const, label: String(definition.name || '策略牌'), category_label: '策略牌', action_label: '使用策略牌', description: String(definition.description || '查看这张策略牌的使用时机与效果。'), cost: { ap: Number(definition.cost || 1) }, enabled: false, disabled_reason: definition.timing ? `当前不能使用 · 时机：${String(definition.timing)}` : '当前不能使用', targets: [], payload: definition } as ActionOption; return <button key={id} className="hand-card strategy-card" onClick={() => onStrategy(option)}><img src={assetUrl('icon_card_scroll.webp')} alt="" /><b>{option.label}</b><small>{option.description || '查看策略牌效果'}</small></button>; })}</div></> : null}<div className="hand-help">点击文化牌查看详情，策略牌先选择其目标再确认结算。</div></section>;
}

function ActionTargetDialog({ option, disabled, onChoose, onCancel }: { option: ActionOption; disabled: boolean; onChoose: (target: ActionOption['targets'][number]) => void; onCancel: () => void }) {
  const ref = useDialogFocus(); return <div className="dialog-backdrop"><section ref={ref} className="dialog choice-dialog action-target-dialog" role="dialog" aria-modal="true" aria-labelledby="action-target-title" aria-describedby="action-target-description"><button className="dialog-close" disabled={disabled} onClick={onCancel} aria-label="取消目标选择"><X /></button><span className="eyebrow">行动目标</span><h2 id="action-target-title">{localizeActionText(option.label)}</h2><p id="action-target-description">{localizeActionText(option.confirmation || option.description || '选择一个合法目标后继续。')}</p>{option.requirements?.length ? <div className="action-requirements" aria-label="行动前提"><b>行动前提</b><span>{option.requirements.join(" · ")}</span></div> : null}<div className="choice-list">{option.targets.map(target => <button className="choice-option" key={target.id} disabled={disabled} onClick={() => onChoose(target)}><span><b>{localizeActionText(target.label)}</b>{target.reason && <small className="choice-reason">{localizeActionText(target.reason)}</small>}<small>{previewDeltaText(target.preview_delta, `${option.cost?.ap || 0} 点行动力`)}</small></span><ChevronDown size={16} /></button>)}</div><button className="ghost-button" disabled={disabled} onClick={onCancel}>返回浏览</button></section></div>;
}

function ChoiceDialog({ state, event, disabled = false, onChoose }: { state: GameState; event?: ContentEvent; disabled?: boolean; onChoose: (action: Action) => void }) {
  const isEvent = state.pending_choice?.kind === 'event';
  const pendingKind = state.pending_choice?.kind || 'choice';
  const pendingCopy: Record<string, { eyebrow: string; title: string; body: string }> = {
    discard: { eyebrow: '手牌整理 · 需要选择', title: '手牌已满', body: '新的线索已经抵达。请选择一张旧线索放入弃牌堆，才能把新线索带回研究台。' },
    view_select: { eyebrow: '档案检视 · 需要选择', title: '从档案中挑出一条线索', body: '档案库已摊开可检视的线索。选择一条加入手牌，其他线索会留在档案中。' },
    archive_select: { eyebrow: '档案检视 · 需要选择', title: '确定要记录的档案线索', body: '你正在查看档案顶部的线索。选择一条作为本次研究的重点，选择完成后才能继续行动。' },
    archive_retrieve: { eyebrow: '档案回收 · 需要选择', title: '从档案中取回一条线索', body: '角色专长允许你调换一张手牌与档案线索。选择要取回的线索，随后再选择要放回档案的手牌。' },
    action_card: { eyebrow: '策略牌 · 选择目标', title: '为策略牌选择目标', body: '这张策略牌已经准备好。选择一个合法目标，确认后费用和效果会立即结算。' },
    select_market_card: { eyebrow: '公开市场 · 需要选择', title: '选择一条带回的文化线索', body: '公开市场已经展开。选中的线索会进入当前角色的手牌，并推进后续的研究台判断。' },
    choice: { eyebrow: '共同决定 · 需要选择', title: '完成当前选择', body: '这一步会影响团队的资源、风险或证据进度。选择一个选项后，旅程才能继续。' },
  };
  const copy = isEvent ? { eyebrow: '世界事件 · 需要回应', title: event?.name || '线路正在等待回应', body: event?.forecast_text || event?.description || '你的选择会立即改变本回合的风险与资源。' } : pendingCopy[pendingKind] || pendingCopy.choice;
  const decisionBrief = eventDecisionBrief(event);
  if (state.pending_choice?.kind === 'role_upgrade') return <RoleUpgradeDialog state={state} disabled={disabled} onChoose={onChoose} />;
  const ref = useDialogFocus();
  const choices = (state.action_options || []).flatMap(option => option.targets.length ? option.targets.map(target => optionAction(option, target)) : [optionAction(option)]);
  return <div className="dialog-backdrop"><section ref={ref} className="dialog choice-dialog" role="dialog" aria-modal="true" aria-labelledby="choice-dialog-title">
    <span className="eyebrow">{copy.eyebrow}</span>
    <h2 id="choice-dialog-title">{copy.title}</h2>
    <p>{copy.body}</p>
    {isEvent && <div className="choice-hint choice-impact"><b>不处理会怎样</b><span>{decisionBrief.ifIgnored}</span></div>}
    {isEvent && <div className="choice-hint"><b>现在能做什么</b><span>{decisionBrief.whatYouCanDo}</span></div>}
    {isEvent && state.shared.event_targets?.length ? <div className="choice-hint"><b>已锁定影响范围</b><span>{state.shared.event_targets.length} 个目标已由本局种子确定，选择会改变这些目标的结果。</span></div> : null}
    <div className="choice-list">{choices.map((action, index) => <button disabled={disabled} key={`${action.type}-${index}`} onClick={() => onChoose(action)}>
      <span><b>{localizeActionText(action.label)}</b><small>{disabled ? '正在同步回应…' : localizeActionText(action.description) || '确认后查看实际变化'}</small>{<em>{previewDeltaText(action.preview_delta, action.cost ? `消耗 ${action.cost} AP` : '确认后结算')}</em>}</span><ChevronDown size={16} />
    </button>)}</div>
  </section></div>;
}
function RoleUpgradeDialog({ state, disabled = false, onChoose }: { state: GameState; disabled?: boolean; onChoose: (action: Action) => void }) { const options = (state.pending_choice?.options || []) as Array<{ id: string; name?: string; description?: string; trigger?: string; strategic_direction?: string; label?: string }>; const ref = useDialogFocus(); const choices = (state.action_options || []).flatMap(option => option.targets.length ? option.targets.map(target => optionAction(option, target)) : [optionAction(option)]); return <div className="dialog-backdrop"><section ref={ref} className="dialog role-upgrade-dialog" role="dialog" aria-modal="true" aria-labelledby="upgrade-dialog-title"><span className="eyebrow"><ShieldCheck size={15} />角色专长</span><h2 id="upgrade-dialog-title">为下一段旅程选择持续专长</h2><p>专长会保留到本局结束，并在描述的触发条件满足时生效。</p><div className="upgrade-options">{options.map(option => { const action = choices.find(item => item.upgrade_id === option.id); return <button key={option.id} disabled={disabled || !action} onClick={() => action && onChoose(action)}><span><b>{option.name || option.label || '角色专长'}</b><small>{disabled ? '正在同步选择…' : option.description || '选择后会持续改变该角色的行动方式。'}</small>{option.trigger && <i>触发：{option.trigger}</i>}</span><em>{option.strategic_direction || '长期协作'}</em></button>; })}</div></section></div>; }



