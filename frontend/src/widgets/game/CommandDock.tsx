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

export function CommandDock({ state, active, cards, legal, actionOptions = [], actionMode, actionLabels, mutationPending, canAct = true, onRun: _onRun, onChooseOption, onCancel, onCard }: { state: GameState; active: Player; cards: Record<string, ContentCard>; legal: Action[]; actionOptions: ActionOption[]; actionMode: ActionType | null; actionLabels: Partial<Record<ActionType, string>>; mutationPending: boolean; canAct?: boolean; onRun?: (action?: Action) => void; onChooseOption: (option: ActionOption) => void; onCancel: () => void; onCard: (id: string) => void }) {
  const [detail, setDetail] = useState<ActionDetailState | null>(null);
  const [strategy, setStrategy] = useState<ActionOption | null>(null);
  const ranked = [...actionOptions].sort((left, right) => (right.recommendation_score || 0) - (left.recommendation_score || 0));
  const featured = ranked.filter(item => item.enabled !== false).slice(0, 3);
  const more = ranked.filter(item => !featured.some(feature => feature.id === item.id));
  const select = (option: ActionOption) => { if (canAct && option.enabled !== false) onChooseOption(option); };

  return <section className="lower-dock command-deck" aria-label="行动选择">
    <div className="dock-summary"><span className="section-label"><Hammer size={14} />行动抉择</span><div className="ap-readout"><b>{active.ap}</b><span>AP<br />可用行动点</span></div><span className="dock-team-status">团队修护资源 {state.shared.restoration_resource} · 研究线索 {state.shared.research_clues || 0}</span><span className="dock-hint">{actionMode ? `正在选择「${actionLabels[actionMode]}」的落脚处` : featured.length ? `建议先做：${actionLabels[featured[0].type] || featured[0].label} · ${featured[0].reason || featured[0].description}` : '此刻风平浪静，等待下一段变化。'}</span>{actionMode && <button type="button" className="ghost-button" onClick={onCancel}>收回脚步</button>}</div>
    <div className="featured-actions">{featured.map((option, index) => { const type = option.type; const Icon = actionIcons[type] || Sparkles; const selected = actionMode === type; const asset = actionAssets[type]; const disabled = !canAct || mutationPending || option.enabled === false; const detailText = disabled ? option.disabled_reason || option.description : option.description; return <button type="button" key={option.id} className={`action-card action-${type} ${selected ? 'selected' : ''} ${index === 0 ? 'lead-action' : ''} ${disabled ? 'is-disabled' : ''}`} disabled={disabled} onClick={() => select(option)} onMouseEnter={event => setDetail({ text: detailText, anchor: event.currentTarget })} onMouseLeave={() => setDetail(null)} onFocus={event => setDetail({ text: detailText, anchor: event.currentTarget })} onBlur={() => setDetail(null)}><span className="action-card-icon">{asset ? <img src={assetUrl(`interaction/action-icons/${asset}.png`)} alt="" /> : <Icon size={20} />}</span><span className="action-card-copy"><b>{option.label || actionLabels[type] || type}</b><small>{disabled ? option.disabled_reason : selected ? '在地图或证据中选择目标' : option.description}</small></span><span className="action-cost">{option.cost?.ap || 0}<small>AP</small></span></button>; })}{!featured.length && <div className="hand-empty">行动正在等待下一次事件结算。</div>}<details className="more-actions"><summary aria-label={`展开更多行动，共 ${more.length} 项`}>更多行动 <span>{more.length}</span><ChevronDown size={14} /></summary><div>{more.map(option => { const type = option.type; const Icon = actionIcons[type] || Sparkles; const disabled = !canAct || mutationPending || option.enabled === false; const detailText = disabled ? option.disabled_reason || option.description : option.description; return <button type="button" key={option.id} disabled={disabled} onClick={() => select(option)} onMouseEnter={event => setDetail({ text: detailText, anchor: event.currentTarget })} onMouseLeave={() => setDetail(null)} onFocus={event => setDetail({ text: detailText, anchor: event.currentTarget })} onBlur={() => setDetail(null)}><Icon size={15} /><b>{option.label || actionLabels[type] || type}</b>{disabled ? <small>{option.disabled_reason}</small> : option.cost?.ap ? <small>{option.cost.ap} AP</small> : null}</button>; })}</div></details></div><ActionDetail detail={detail} />
    <div className="hand-tray"><div className="section-label"><Archive size={14} />我的手牌 <b>{active.hand.length} / 3</b></div><div className="hand-cards">{active.hand.length ? active.hand.map(id => { const item = cards[id]; const playAction = findCardAction(legal, 'play_card', id); return <button type="button" key={id} className="hand-card" onClick={() => onCard(id)}><img src={assetUrl(item?.icon_asset, 'interaction/resource-icons/scroll.png')} alt="" /><b>{item?.name || id}</b><small>{playAction ? '在研究台中判断它的关系' : '查看这件证据'}</small></button>; }) : <div className="hand-empty">寻访所得的文化线索，会在研究台中成为支持、冲突或待确认的见证。</div>}</div>{active.action_hand?.length ? <div className="strategy-hand"><div className="section-label"><Sparkles size={14} />策略牌 <b>{active.action_hand.length}</b></div><div className="hand-cards">{active.action_hand.map(id => { const option = actionOptions.find(item => item.type === 'use_action_card' && item.id === `action:use_action_card:${id}`); const detailText = option?.disabled_reason || [option?.description, option?.reason].filter(Boolean).join(' ') || '查看策略牌效果'; return <button type="button" key={id} className="hand-card strategy-card" disabled={mutationPending || !option || option.enabled === false} onClick={() => option && setStrategy(option)} onMouseEnter={event => setDetail({ text: detailText, anchor: event.currentTarget })} onMouseLeave={() => setDetail(null)} onFocus={event => setDetail({ text: detailText, anchor: event.currentTarget })} onBlur={() => setDetail(null)}><img src={assetUrl('icon_card_scroll.png')} alt="" /><b>{option?.label || '策略牌'}</b><small>{option?.targets.length ? '选择目标后确认' : detailText}</small></button>; })}</div></div> : null}</div>  {strategy && <div className="dialog-backdrop"><section className="dialog strategy-dialog" role="dialog" aria-modal="true" aria-labelledby="strategy-dialog-title"><button className="dialog-close" onClick={() => setStrategy(null)} aria-label="关闭策略牌说明"><X /></button><span className="eyebrow">策略牌说明</span><h2 id="strategy-dialog-title">{strategy.label}</h2><p>{strategy.description}</p><dl><div><dt>使用时机</dt><dd>{localizeActionText(String((strategy.payload as Record<string, unknown>)?.timing || '当前行动阶段'))}</dd></div><div><dt>可选目标</dt><dd>{strategy.targets.length ? strategy.targets.slice(0, 4).map(target => target.label).join('、') + (strategy.targets.length > 4 ? ` 等 ${strategy.targets.length} 个目标` : '') : '当前地点或团队'}</dd></div><div><dt>最适合</dt><dd>{localizeActionText(String((strategy.payload as Record<string, unknown>)?.best_use || strategy.reason || '根据当前风险选择目标。'))}</dd></div><div><dt>限制</dt><dd>{localizeActionText(String((strategy.payload as Record<string, unknown>)?.limitations || '请先选择合法目标。'))}</dd></div><div><dt>预计变化</dt><dd>{Object.entries(strategy.preview_delta || {}).map(([key, value]) => `${key} ${Number(value) > 0 ? '+' : ''}${value}`).join(' · ') || '确认后根据目标结算。'}</dd></div></dl><div className="dialog-actions"><button className="ghost-button" onClick={() => setStrategy(null)}>返回浏览</button><button className="primary-cta" disabled={mutationPending} onClick={() => { setStrategy(null); onChooseOption(strategy); }}>使用这张牌</button></div></section></div>}
  </section>;
}
