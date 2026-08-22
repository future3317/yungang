import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Archive, ChevronDown, Compass, HandHeart, Hammer, MapPinned, ScanSearch, ShieldPlus, Sparkles, WandSparkles, X } from 'lucide-react';
import type { Action, ActionOption, ActionType, ContentCard, GameState, Player } from '../../types/game';
import { findCardAction, localizeActionText, previewDeltaText } from './gameUi';
import { assetUrl } from '../../shared/assetUrl';

const actionIcons: Partial<Record<ActionType, typeof Sparkles>> = {
  move: MapPinned,
  survey_route: ScanSearch,
  explore: Compass,
  interpret_evidence: HandHeart,
  restore: Hammer,
  restore_route: ShieldPlus,
  establish_connection: WandSparkles,
  prepare: ShieldPlus,
  use_skill: Sparkles,
  end_turn: Archive,
};
const actionAssets: Partial<Record<ActionType, string>> = { explore: 'explore', interpret_evidence: 'contribute', restore: 'repair' };
const primaryOrder: ActionType[] = ['move', 'explore', 'interpret_evidence', 'restore', 'survey_route'];

type ActionDetailState = { text: string; anchor: HTMLButtonElement };

function ActionDetail({ detail }: { detail: ActionDetailState | null }) {
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  useEffect(() => {
    if (!detail) { setPosition(null); return; }
    const update = () => {
      const rect = detail.anchor.getBoundingClientRect();
      setPosition({ left: Math.min(rect.left, window.innerWidth - 326), top: rect.top - 12, width: Math.min(310, window.innerWidth - Math.max(16, rect.left) - 16) });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [detail]);
  if (!detail || !position) return null;
  return createPortal(<div className="action-detail-tooltip action-detail-tooltip-portal" role="tooltip" style={{ left: Math.max(16, position.left), top: position.top, width: position.width }}><b>行动说明</b><span>{detail.text}</span></div>, document.body);
}

export function CommandDock({ state, active, cards, actionCards = {}, legal, actionOptions = [], actionMode, actionLabels, mutationPending, canAct = true, onRun: _onRun, onChooseOption, onCancel, onCard }: { state: GameState; active: Player; cards: Record<string, ContentCard>; actionCards?: Record<string, Record<string, unknown>>; legal: Action[]; actionOptions: ActionOption[]; actionMode: ActionType | null; actionLabels: Partial<Record<ActionType, string>>; mutationPending: boolean; canAct?: boolean; onRun?: (action?: Action) => void; onChooseOption: (option: ActionOption) => void; onCancel: () => void; onCard: (id: string) => void }) {
  const [detail, setDetail] = useState<ActionDetailState | null>(null);
  const [strategy, setStrategy] = useState<ActionOption | null>(null);
  const waitingFor = state.players?.[state.shared.active_player_id]?.name || '当前行动者';
  const ranked = [...actionOptions].sort((left, right) => (right.recommendation_score || 0) - (left.recommendation_score || 0));
  const featured = ranked.filter(item => item.enabled !== false).slice(0, 3);
  const more = ranked.filter(item => !featured.some(feature => feature.id === item.id));
  const select = (option: ActionOption) => { if (canAct && option.enabled !== false) onChooseOption(option); };

  return <section className={`lower-dock command-deck ${!canAct ? 'waiting-turn' : ''}`} aria-label="行动选择">
    <div className="dock-summary"><span className="section-label"><Hammer size={14} />行动抉择</span><div className="ap-readout"><b>{active.ap}</b><span>AP<br />可用行动点</span></div><span className="dock-team-status">团队修护资源 {state.shared.restoration_resource} · 研究线索 {state.shared.research_clues || 0}</span>{!canAct && <span className="dock-waiting" role="status">等待 {waitingFor} 行动 · 你可以浏览地图和资料</span>}<span className="dock-hint">{!canAct ? '轮到你时，行动按钮会自动恢复。' : actionMode ? `正在选择「${actionLabels[actionMode]}」的落脚处` : featured.length ? `建议先做：${actionLabels[featured[0].type] || featured[0].label} · ${featured[0].reason || featured[0].description}` : '此刻风平浪静，等待下一段变化。'}</span>{actionMode && canAct && <button type="button" className="ghost-button" onClick={onCancel}>收回脚步</button>}</div>
    <div className="featured-actions">{featured.map((option, index) => { const type = option.type; const Icon = actionIcons[type] || Sparkles; const selected = actionMode === type; const asset = actionAssets[type]; const disabled = !canAct || mutationPending || option.enabled === false; const detailText = disabled ? option.disabled_reason || option.description : option.description; return <button type="button" key={option.id} className={`action-card action-${type} ${selected ? 'selected' : ''} ${index === 0 ? 'lead-action' : ''} ${disabled ? 'is-disabled' : ''}`} disabled={disabled} onClick={() => select(option)} onMouseEnter={event => setDetail({ text: detailText, anchor: event.currentTarget })} onMouseLeave={() => setDetail(null)} onFocus={event => setDetail({ text: detailText, anchor: event.currentTarget })} onBlur={() => setDetail(null)}><span className="action-card-icon">{asset ? <img src={assetUrl(`interaction/action-icons/${asset}.png`)} alt="" /> : <Icon size={20} />}</span><span className="action-card-copy"><b>{option.label || actionLabels[type] || type}</b><small>{[option.category_label, disabled ? option.disabled_reason : selected ? '在地图或证据中选择目标' : option.description].filter(Boolean).join(' · ')}</small></span><span className="action-cost">{option.cost?.ap || 0}<small>AP</small></span></button>; })}{!featured.length && <div className="hand-empty">行动正在等待下一次事件结算。</div>}<details className="more-actions"><summary aria-label={`展开更多行动，共 ${more.length} 项`}>更多行动 <span>{more.length}</span><ChevronDown size={14} /></summary><div>{more.map(option => { const type = option.type; const Icon = actionIcons[type] || Sparkles; const disabled = !canAct || mutationPending || option.enabled === false; const detailText = disabled ? option.disabled_reason || option.description : option.description; return <button type="button" key={option.id} disabled={disabled} onClick={() => select(option)} onMouseEnter={event => setDetail({ text: detailText, anchor: event.currentTarget })} onMouseLeave={() => setDetail(null)} onFocus={event => setDetail({ text: detailText, anchor: event.currentTarget })} onBlur={() => setDetail(null)}><Icon size={15} /><b>{option.label || actionLabels[type] || type}</b>{<small>{[option.category_label, disabled ? option.disabled_reason : option.cost?.ap ? `${option.cost.ap} AP` : ''].filter(Boolean).join(' · ')}</small>}</button>; })}</div></details></div><ActionDetail detail={detail} />
    <div className="hand-tray"><div className="section-label"><Archive size={14} />我的手牌 <b>{active.hand.length} / 3</b></div><div className="hand-cards">{active.hand.length ? active.hand.map(id => { const item = cards[id]; const playAction = findCardAction(legal, 'play_card', id); return <button type="button" key={id} className="hand-card" onClick={() => onCard(id)}><img src={assetUrl(item?.icon_asset, 'interaction/resource-icons/scroll.png')} alt="" /><b>{item?.name || id}</b><small>{playAction ? '在研究台中判断它的关系' : '查看这件证据'}</small></button>; }) : <div className="hand-empty">寻访所得的文化线索，会在研究台中成为支持、冲突或待确认的见证。</div>}</div>{active.action_hand?.length ? <div className="strategy-hand"><div className="section-label"><Sparkles size={14} />策略牌 <b>{active.action_hand.length}</b></div><div className="hand-cards">{active.action_hand.map(id => { const definition = actionCards[id] || {}; const option = actionOptions.find(item => item.type === 'use_action_card' && item.id.endsWith(`:${id}`)) || { id: `action:use_action_card:${id}`, type: 'use_action_card' as const, label: String(definition.name || '策略牌'), description: String(definition.description || '查看这张策略牌的使用时机与效果。'), cost: { ap: Number(definition.cost || 1) }, enabled: false, disabled_reason: definition.timing ? `当前不能使用 · 时机：${String(definition.timing)}` : '当前不能使用', targets: [], payload: definition } as ActionOption; const detailText = option.disabled_reason || [option.description, option.reason].filter(Boolean).join(' ') || '查看策略牌效果'; return <button type="button" key={id} className="hand-card strategy-card" disabled={mutationPending} onClick={() => setStrategy(option)} onMouseEnter={event => setDetail({ text: detailText, anchor: event.currentTarget })} onMouseLeave={() => setDetail(null)} onFocus={event => setDetail({ text: detailText, anchor: event.currentTarget })} onBlur={() => setDetail(null)}><img src={assetUrl('icon_card_scroll.png')} alt="" /><b>{option.label}</b><small>{[option.category_label, option.targets.length ? '选择目标后确认' : detailText].filter(Boolean).join(' · ')}</small></button>; })}</div></div> : null}</div>  {strategy && <div className="dialog-backdrop"><section className="dialog strategy-dialog" role="dialog" aria-modal="true" aria-labelledby="strategy-dialog-title"><button className="dialog-close" onClick={() => setStrategy(null)} aria-label="关闭策略牌说明"><X /></button><span className="eyebrow">{strategy.category_label || '策略牌说明'}</span><h2 id="strategy-dialog-title">{strategy.label}</h2><p>{strategy.description}</p><dl><div><dt>使用时机</dt><dd>{localizeActionText(String((strategy.payload as Record<string, unknown>)?.timing || '当前行动阶段'))}</dd></div><div><dt>可选目标</dt><dd>{strategy.targets.length ? strategy.targets.slice(0, 4).map(target => target.label).join('、') + (strategy.targets.length > 4 ? ` 等 ${strategy.targets.length} 个目标` : '') : '当前地点或团队'}</dd></div><div><dt>最适合</dt><dd>{localizeActionText(String((strategy.payload as Record<string, unknown>)?.best_use || strategy.reason || '根据当前风险选择目标。'))}</dd></div><div><dt>限制</dt><dd>{localizeActionText(String((strategy.payload as Record<string, unknown>)?.limitations || strategy.disabled_reason || '请先确认当前时机与合法目标。'))}</dd></div><div><dt>预计变化</dt><dd>{previewDeltaText(strategy.preview_delta, '确认目标后显示预计变化。')}</dd></div></dl><div className="dialog-actions"><button className="ghost-button" onClick={() => setStrategy(null)}>返回浏览</button><button className="primary-cta" disabled={mutationPending || strategy.enabled === false} onClick={() => { setStrategy(null); onChooseOption(strategy); }}>使用这张牌</button></div></section></div>}
  </section>;
}
