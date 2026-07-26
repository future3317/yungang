import { useEffect, useState } from 'react';
import { Archive, ChevronDown, CircleAlert, Clock3, Hammer, Library, Map as MapIcon, Send, ShieldCheck, Sparkles, Target, Users, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { ApiError, api } from '../../shared/api/client';
import type { Action, ActionType, ContentCard, ContentEvent, GameState, Meta, Site } from '../../types/game';
import { HeritageNetwork } from '../../widgets/heritage-network/HeritageNetwork';
import { CommandDock } from '../../widgets/game/CommandDock';
import { ScenarioHeader } from '../../widgets/game/ScenarioHeader';

type ActionMode = Extract<ActionType, 'move' | 'explore' | 'contribute' | 'restore' | 'survey_route' | 'restore_route' | 'establish_connection' | 'exchange'> | null;
const actionOrder: ActionType[] = ['move', 'survey_route', 'explore', 'contribute', 'restore', 'restore_route', 'establish_connection', 'exchange', 'prepare', 'use_skill', 'end_turn'];
const actionLabels: Partial<Record<ActionType, string>> = { move: '移动', survey_route: '勘察路线', explore: '探索', contribute: '贡献', restore: '修护节点', restore_route: '修护路线', establish_connection: '建立连接', exchange: '交换', prepare: '准备', use_skill: '技能', end_turn: '结束回合' };
const outcomeCopy: Record<string, { title: string; explanation: string }> = {
  all_domains_completed: { title: '遗产重新连成一条路', explanation: '五个文化领域都已完成互鉴，团队用共同证据让关系重新显影。' },
  too_many_closed_sites: { title: '线路失去太多连接', explanation: '关闭节点已达到失败阈值。下一局优先修护高风险节点，再投入探索。' },
  round_limit_reached: { title: '这一次，线路没有撑到最后', explanation: '回合已用尽。下一局需要更早安排移动路线和事件应对。' }
};

function findCardAction(actions: Action[], type: ActionType, cardId: string) { return actions.find(action => action.type === type && action.card_id === cardId); }
function Progress({ value, max, tone = 'azure' }: { value: number; max: number; tone?: string }) { return <div className={`progress ${tone}`}><span style={{ width: `${Math.min(100, max ? value / max * 100 : 0)}%` }} /></div>; }
function domainName(meta: Meta, id: string) { return meta.domain_meta?.[id]?.short_name || id; }

export function GamePage() {
  const { sessionId = '' } = useParams();
  const queryClient = useQueryClient();
  const [focus, setFocus] = useState<string | null>(null);
  const [card, setCard] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [mobileView, setMobileView] = useState<'map' | 'mission' | 'hand'>('map');
  const [toast, setToast] = useState('');
  const gameQuery = useQuery<GameState>({ queryKey: ['game', sessionId], queryFn: () => api.game(sessionId), refetchOnWindowFocus: false });
  const metaQuery = useQuery<Meta>({ queryKey: ['meta'], queryFn: api.meta });
  const state = gameQuery.data;
  const legal = state?.legal_actions || [];
  const mutation = useMutation({
    mutationFn: (action: Action) => api.action(sessionId, action, state?.shared.active_player_id || '', state?.revision || 0),
    onSuccess: data => { queryClient.setQueryData(['game', sessionId], data); setActionMode(null); setToast('行动已记录，线路状态已更新'); window.setTimeout(() => setToast(''), 2600); },
    onError: error => {
      if (error instanceof ApiError && error.status === 409) {
        const current = (error.payload as { detail?: { current_state?: GameState } })?.detail?.current_state;
        if (current) { queryClient.setQueryData(['game', sessionId], current); setActionMode(null); setToast('状态已同步，请根据最新回合重新选择'); return; }
      }
      setToast(error instanceof Error ? error.message : '同步失败');
    }
  });
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setActionMode(null); setCard(null); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);
  if (gameQuery.isLoading || metaQuery.isLoading) return <div className="state-screen"><span className="loading-orbit" /><p>正在读取遗产网络...</p></div>;
  if (gameQuery.isError || metaQuery.isError || !state || !metaQuery.data) return <div className="state-screen danger"><CircleAlert /><h1>旅程暂时无法打开</h1><p>请检查本地服务是否仍在运行，然后重新进入旅程。</p><button className="ghost-button" onClick={() => { void gameQuery.refetch(); void metaQuery.refetch(); }}>重新连接</button></div>;

  const meta = metaQuery.data;
  const active = state.players[state.shared.active_player_id];
  const sites = Object.fromEntries(meta.sites.map(site => [site.id, site]));
  const cards = Object.fromEntries(meta.cards.map(item => [item.id, item]));
  const events = Object.fromEntries(meta.events.map(item => [item.id, item]));
  const roles = Object.fromEntries(meta.roles.map(item => [item.id, item]));
  const focused: Site = state.sites[focus || active.location] || state.sites[active.location] || Object.values(state.sites)[0];
  const focusedMeta = sites[focused.id] || focused;
  const task = focusedMeta.active_task_id ? state.tasks[focusedMeta.active_task_id] : undefined;
  const currentEvent: ContentEvent | undefined = state.shared.current_event_id ? events[state.shared.current_event_id] : undefined;
  const targetIds = new Set(legal.filter(action => action.type === actionMode).map(action => action.target_id || action.target_site_id).filter((id): id is string => Boolean(id)));
  const actionsByType = new Map(actionOrder.map(type => [type, legal.filter(action => action.type === type)]));
  const connection = mutation.isPending || gameQuery.isFetching || metaQuery.isFetching ? '同步中' : gameQuery.isError || metaQuery.isError ? '离线' : '已连接';
  const run = (action?: Action) => { if (action && !mutation.isPending) mutation.mutate(action); };
  const chooseAction = (type: ActionType) => { const actions = actionsByType.get(type) || []; if (!actions.length) return; if (type === 'use_skill' || type === 'end_turn' || type === 'prepare') { run(actions[0]); return; } setActionMode(type as ActionMode); if (type === 'move' || type === 'restore' || type === 'survey_route' || type === 'restore_route' || type === 'establish_connection') setFocus(active.location); };
  const selectNode = (id: string) => { const mapModes = ['move', 'restore', 'survey_route', 'restore_route', 'establish_connection']; const targetAction = actionMode && mapModes.includes(actionMode) ? legal.find(action => action.type === actionMode && (action.target_id === id || action.target_site_id === id)) : undefined; if (targetAction) { setActionMode(null); run(targetAction); return; } setFocus(id); };
  const mapActionMode: Extract<ActionType, 'move' | 'restore' | 'survey_route' | 'restore_route' | 'establish_connection'> | null = actionMode && ['move', 'restore', 'survey_route', 'restore_route', 'establish_connection'].includes(actionMode) ? actionMode as Extract<ActionType, 'move' | 'restore' | 'survey_route' | 'restore_route' | 'establish_connection'> : null;
  const selectExploreCard = (id: string) => { const action = findCardAction(legal, 'explore', id); if (actionMode === 'explore' && action) { setActionMode(null); run(action); } else if (action) setActionMode('explore'); };
  const selectContribution = (id: string) => { const action = findCardAction(legal, 'contribute', id); if (actionMode === 'contribute' && action) { setActionMode(null); run(action); } else if (action) setActionMode('contribute'); else setCard(id); };

  return <div className="game-shell">
    <ScenarioHeader state={state} connection={connection} />
    <div className="mobile-tabs" role="tablist"><button className={mobileView === 'map' ? 'active' : ''} onClick={() => setMobileView('map')}><MapIcon size={16} />地图</button><button className={mobileView === 'mission' ? 'active' : ''} onClick={() => setMobileView('mission')}><Target size={16} />任务</button><button className={mobileView === 'hand' ? 'active' : ''} onClick={() => setMobileView('hand')}><Archive size={16} />手牌</button></div>
    <main className="game-grid">
      <aside className={`roster-column ${mobileView !== 'map' ? 'mobile-hidden' : ''}`}><section className="roster"><div className="section-label"><Users size={14} />共同旅伴</div>{state.shared.player_order.map(id => { const player = state.players[id]; const role = roles[player.role_id]; return <button key={id} className={`roster-row ${id === state.shared.active_player_id ? 'active' : ''}`} onClick={() => setFocus(player.location)}><img src={`/ui-assets/${role?.icon_asset || 'icon_role_scribe.png'}`} alt="" /><span><b>{player.name}</b><small>{role?.name || player.role_id} · {sites[player.location]?.name || player.location}</small></span><strong>{player.ap} <small>AP</small></strong></button>; })}</section><section className="current-player"><div className="section-label">当前行动者</div><h2>{active.name}</h2><p>{roles[active.role_id]?.name || active.role_id}</p><div className="player-resources"><span><b>{active.ap}</b><small>行动点</small></span><span><b>{active.influence}</b><small>个人影响</small></span><span><b>{state.shared.restoration_resource}</b><small>修护资源</small></span></div></section><CommandDock state={state} active={active} cards={cards} legal={legal} actionsByType={actionsByType} actionMode={actionMode} actionLabels={actionLabels} mutationPending={mutation.isPending} onRun={run} onChoose={chooseAction} onCancel={() => setActionMode(null)} onCard={setCard} onContribution={selectContribution} /><section className="roster-note"><ShieldCheck size={16} /><span>每个选择都会改变线路的亮度，先照顾正在受损的节点。</span></section></aside>
      <section className={`stage-column ${mobileView !== 'map' ? 'mobile-hidden' : ''}`}><div className="stage-heading"><div><span className="eyebrow">石窟光谱 / Cave Light Atlas</span><h1>遗产节点网络</h1></div><span className="turn-badge"><Clock3 size={14} />回合 {state.shared.turn}</span></div><HeritageNetwork sites={state.sites} metaSites={sites} regions={meta.regions} routes={state.routes} active={active} focusedId={focus} reachableIds={targetIds} actionMode={mapActionMode} onFocus={selectNode} /><div className="stage-caption"><div className="scene-thumb"><img src={`/ui-assets/${focusedMeta.scene_asset || 'scene_yungang_day.png'}`} alt="" /></div><div><span className="eyebrow">当前聚焦</span><h2>{focusedMeta.name || focused.id}</h2><p>{focusedMeta.summary || '等待探索后显示节点的文化摘要。'}</p></div><button className="ghost-button" onClick={() => { setFocus(null); setActionMode(null); }}>清除</button></div></section>
      <aside className={`context-column ${mobileView !== 'mission' ? 'mobile-context-hidden' : ''}`}><section className="context-panel mission-panel"><div className="panel-title"><span className="section-label"><Target size={14} />节点任务</span><span className="state-chip">{focused.status === 'closed' ? '已关闭' : '进行中'}</span></div><h2>{task?.name || '探索后解锁任务'}</h2><p>{task?.culture_explanation || focusedMeta.summary || '通过探索获得文化证据，再将证据贡献给节点任务。'}</p>{task && <><div className="evidence-head"><span>证据槽</span><b>{task.contributed_cards.length} / {task.required_card_count}</b></div><Progress value={task.contributed_cards.length} max={task.required_card_count} tone="azure" /><div className="domain-list">{task.required_domains.map(domain => <span key={domain} className={task.contributed_cards.length ? 'filled' : ''}>{domainName(meta, domain)}</span>)}</div></>}</section><section className="context-panel event-forecast"><div className="panel-title"><span className="section-label"><CircleAlert size={14} />事件预告</span><span className="forecast-count">回合末结算</span></div><div className="event-art"><img src={`/ui-assets/${currentEvent?.scene_asset || 'scene_frontier_pass.png'}`} alt="" /><div><h3>{currentEvent?.name || '下一段路等待显现'}</h3><p>{currentEvent?.description || currentEvent?.summary || '结束本轮后，事件会根据线路状态结算。'}</p></div></div><p className="event-help">可通过修护、贡献和文化牌降低风险，或为变化预留资源。</p></section><section className="context-panel market-panel"><div className="panel-title"><span className="section-label"><Library size={14} />公开文化市场</span><span>{state.market.length} 张</span></div><div className="market-row">{state.market.map(id => { const item = cards[id]; const action = findCardAction(legal, 'explore', id); return <button key={id} className={`culture-card ${actionMode === 'explore' && action ? 'selected' : ''}`} disabled={!action || mutation.isPending} onClick={() => selectExploreCard(id)}><img src={`/ui-assets/${item?.icon_asset || 'icon_card_scroll.png'}`} alt="" /><span><b>{item?.name || id}</b><small>{item?.domain ? domainName(meta, item.domain) : '文化证据'} · {item?.origin_tags?.join(' / ') || '待鉴定'}</small></span><i>{action ? `${action.cost || 1} AP` : '不可选'}</i></button>; })}</div></section></aside>
    </main>
    {state.shared.log.length > 0 && <section className="timeline-panel"><div className="section-label"><Send size={14} />旅程时间线</div><div className="timeline-list">{state.shared.log.slice(-5).reverse().map((entry, index) => <div key={`${entry}-${index}`}><span>{state.shared.turn}</span><p>{entry}</p></div>)}</div></section>}
    {toast && <div className="toast" role="status">{toast}</div>}{card && <CardDialog id={card} item={cards[card]} action={findCardAction(legal, 'play_card', card)} meta={meta} onClose={() => setCard(null)} onUse={action => { setCard(null); run(action); }} />}{state.pending_choice && <ChoiceDialog state={state} onChoose={run} />}{state.shared.outcome && <ResultDialog state={state} meta={meta} onRestart={() => window.location.assign('/')} />}
  </div>;
}

function CardDialog({ id, item, action, meta, onClose, onUse }: { id: string; item?: ContentCard; action?: Action; meta: Meta; onClose: () => void; onUse: (action: Action) => void }) { return <div className="dialog-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) onClose(); }}><section className="dialog card-dialog" role="dialog" aria-modal="true" aria-labelledby="card-title"><button className="dialog-close" onClick={onClose} aria-label="关闭"><X /></button><img className="dialog-card-art" src={`/ui-assets/${item?.icon_asset || 'icon_card_scroll.png'}`} alt="" /><span className="eyebrow">文化证据 / CULTURE CARD</span><h2 id="card-title">{item?.name || id}</h2><p>{item?.description || item?.summary || '一份来自旅途的文化记录，等待被理解并投入合适的节点。'}</p><div className="tag-row">{item?.domain && <span>{domainName(meta, item.domain)}</span>}{item?.origin_tags?.map(tag => <span key={tag}>{tag}</span>)}</div><button className="primary-cta" disabled={!action} onClick={() => action && onUse(action)}>{action ? '使用这张牌' : '当前不可使用'}<ArrowIcon /></button></section></div>; }
function ChoiceDialog({ state, onChoose }: { state: GameState; onChoose: (action: Action) => void }) { return <div className="dialog-backdrop"><section className="dialog choice-dialog" role="dialog" aria-modal="true"><span className="eyebrow">共同决定 / PENDING CHOICE</span><h2>{state.pending_choice?.kind === 'event' ? '线路正在等待回应' : '从市场中选择一件证据'}</h2><p>这是团队共同面对的选择，选择后服务器会推进旅程状态。</p><div className="choice-list">{state.legal_actions.map((action, index) => <button key={`${action.type}-${index}`} onClick={() => onChoose(action)}><b>{action.label}</b><ChevronDown size={16} /></button>)}</div></section></div>; }
function ResultDialog({ state, meta, onRestart }: { state: GameState; meta: Meta; onRestart: () => void }) { const completed = Object.values(state.tasks).filter(task => task.completed); const reason = outcomeCopy[state.shared.outcome_reason || ''] || outcomeCopy.round_limit_reached; return <div className="dialog-backdrop"><section className="dialog result-dialog"><span className={`result-symbol ${state.shared.outcome}`}>{state.shared.outcome === 'victory' ? '光线已合拢' : '线路正在失去连接'}</span><span className="eyebrow">旅程结算 / {state.shared.outcome === 'victory' ? 'VICTORY' : 'DEFEAT'}</span><h1>{reason.title}</h1><p>{reason.explanation}</p><div className="result-stats"><span><b>{completed.length}</b><small>完成任务</small></span><span><b>{state.shared.influence}</b><small>共同影响</small></span><span><b>{state.shared.completed_domains.length} / {meta.domains.length}</b><small>文化领域</small></span></div><button className="primary-cta" onClick={onRestart}>返回首页<ArrowIcon /></button></section></div>; }
function ArrowIcon() { return <span aria-hidden="true">→</span>; }
