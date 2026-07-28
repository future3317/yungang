import { Archive, ChevronDown, Compass, HandHeart, Hammer, MapPinned, ScanSearch, ShieldPlus, Sparkles, WandSparkles } from 'lucide-react';
import type { Action, ActionOption, ActionType, ContentCard, GameState, Player } from '../../types/game';
import { findCardAction } from './gameUi';

const actionIcons: Partial<Record<ActionType, typeof Sparkles>> = {
  move: MapPinned,
  survey_route: ScanSearch,
  explore: Compass,
  contribute: HandHeart,
  restore: Hammer,
  restore_route: ShieldPlus,
  establish_connection: WandSparkles,
  prepare: ShieldPlus,
  use_skill: Sparkles,
  end_turn: Archive,
};
const actionAssets: Partial<Record<ActionType, string>> = { explore: 'explore', contribute: 'contribute', restore: 'repair' };
const primaryOrder: ActionType[] = ['move', 'explore', 'contribute', 'restore', 'survey_route'];

function ActionDetail({ text }: { text?: string }) {
  return text ? <span className="action-detail-tooltip" role="tooltip"><b>行动说明</b><span>{text}</span></span> : null;
}

export function CommandDock({ state: _state, active, cards, legal, actionOptions = [], actionMode, actionLabels, mutationPending, onRun: _onRun, onChooseOption, onCancel, onCard, onContribution }: { state: GameState; active: Player; cards: Record<string, ContentCard>; legal: Action[]; actionOptions: ActionOption[]; actionMode: ActionType | null; actionLabels: Partial<Record<ActionType, string>>; mutationPending: boolean; onRun?: (action?: Action) => void; onChooseOption: (option: ActionOption) => void; onCancel: () => void; onCard: (id: string) => void; onContribution: (id: string) => void }) {
  const featured = primaryOrder.map(type => actionOptions.find(item => item.type === type)).filter((item): item is ActionOption => Boolean(item)).slice(0, 3);
  const more = actionOptions.filter(item => !featured.some(feature => feature.type === item.type));
  const select = (option: ActionOption) => { if (option.enabled !== false) onChooseOption(option); };

  return <section className="lower-dock command-deck" aria-label="行动选择">
    <div className="dock-summary"><span className="section-label"><Hammer size={14} />行动抉择</span><div className="ap-readout"><b>{active.ap}</b><span>AP<br />可用行动点</span></div><span className="dock-hint">{actionMode ? `正在选择「${actionLabels[actionMode]}」的落脚处` : featured.length ? '选择一项行动，显影的路线会带你找到合适的去处。' : '此刻风平浪静，等待下一段变化。'}</span>{actionMode && <button type="button" className="ghost-button" onClick={onCancel}>收回脚步</button>}</div>
    <div className="featured-actions">{featured.map((option, index) => { const type = option.type; const Icon = actionIcons[type] || Sparkles; const selected = actionMode === type; const asset = actionAssets[type]; const disabled = mutationPending || option.enabled === false; const detail = disabled ? option.disabled_reason || option.description : option.description; return <button type="button" key={option.id} className={`action-card action-${type} ${selected ? 'selected' : ''} ${index === 0 ? 'lead-action' : ''} ${disabled ? 'is-disabled' : ''}`} disabled={disabled} onClick={() => select(option)}><span className="action-card-icon">{asset ? <img src={`/ui-assets/interaction/action-icons/${asset}.png`} alt="" /> : <Icon size={20} />}</span><span className="action-card-copy"><b>{actionLabels[type] || option.label || type}</b><small>{disabled ? option.disabled_reason : selected ? '在地图或证据中选择目标' : option.description}</small></span><span className="action-cost">{option.cost?.ap || 0}<small>AP</small></span><ActionDetail text={detail} /></button>; })}{!featured.length && <div className="hand-empty">行动正在等待下一次事件结算。</div>}<details className="more-actions"><summary aria-label={`展开更多行动，共 ${more.length} 项`}>更多行动 <span>{more.length}</span><ChevronDown size={14} /></summary><div>{more.map(option => { const type = option.type; const Icon = actionIcons[type] || Sparkles; const disabled = mutationPending || option.enabled === false; return <button type="button" key={option.id} disabled={disabled} onClick={() => select(option)}><Icon size={15} /><b>{actionLabels[type] || option.label || type}</b>{disabled ? <small>{option.disabled_reason}</small> : option.cost?.ap ? <small>{option.cost.ap} AP</small> : null}</button>; })}</div></details></div>
    <div className="hand-tray"><div className="section-label"><Archive size={14} />我的手牌 <b>{active.hand.length} / 3</b></div><div className="hand-cards">{active.hand.length ? active.hand.map(id => { const item = cards[id]; const contributeAction = findCardAction(legal, 'contribute', id); const playAction = findCardAction(legal, 'play_card', id); return <button type="button" key={id} className={`hand-card ${actionMode === 'contribute' && contributeAction ? 'selected' : ''}`} onClick={() => { if (actionMode === 'contribute' && contributeAction) onContribution(id); else if (contributeAction) onContribution(id); else onCard(id); }}><img src={`/ui-assets/${item?.icon_asset || 'interaction/resource-icons/scroll.png'}`} alt="" /><b>{item?.name || id}</b><small>{actionMode === 'contribute' && contributeAction ? '交付给节点委托' : playAction ? '查看这件证据' : '查看这件证据'}</small></button>; }) : <div className="hand-empty">寻访所得的文化线索，会在这里等待与其他见证相遇。</div>}</div>{active.action_hand?.length ? <div className="strategy-hand"><div className="section-label"><Sparkles size={14} />策略牌 <b>{active.action_hand.length}</b></div><div className="hand-cards">{active.action_hand.map(id => { const option = actionOptions.find(item => item.type === 'use_action_card' && item.id === `action:use_action_card:${id}`); return <button type="button" key={id} className="hand-card strategy-card" disabled={mutationPending || !option || option.enabled === false} title={option?.disabled_reason || option?.description || '查看策略牌效果'} onClick={() => option && onChooseOption(option)}><img src="/ui-assets/icon_card_scroll.png" alt="" /><b>{option?.label || id}</b><small>{option?.targets.length ? '选择目标后确认' : option?.description || '查看策略牌效果'}</small></button>; })}</div></div> : null}</div>
  </section>;
}
