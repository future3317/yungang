import { useState } from 'react';
import { Archive, ChevronDown, Compass, HandHeart, Hammer, MapPinned, ScanSearch, ShieldPlus, Sparkles, WandSparkles } from 'lucide-react';
import type { Action, ActionOption, ActionType, ContentCard, GameState, Player } from '../../types/game';
import { findCardAction } from './gameUi';
import { assetUrl } from '../../shared/assetUrl';
import { StrategyCardDialog } from './StrategyCardDialog';

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

export function CommandDock({ state, active, cards, actionCards = {}, legal, actionOptions = [], actionMode, actionLabels, mutationPending, canAct = true, onRun: _onRun, onChooseOption, onCancel, onCard }: { state: GameState; active: Player; cards: Record<string, ContentCard>; actionCards?: Record<string, Record<string, unknown>>; legal: Action[]; actionOptions: ActionOption[]; actionMode: ActionType | null; actionLabels: Partial<Record<ActionType, string>>; mutationPending: boolean; canAct?: boolean; onRun?: (action?: Action) => void; onChooseOption: (option: ActionOption) => void; onCancel: () => void; onCard: (id: string) => void }) {
  const [strategy, setStrategy] = useState<ActionOption | null>(null);
  const showRecommendationReasons = (state.shared.effective_rules as Record<string, unknown> | undefined)?.show_recommendation_reasons === true;
  const waitingFor = state.players?.[state.shared.active_player_id]?.name || '当前行动者';
  const ranked = [...actionOptions].sort((left, right) => (right.recommendation_score || 0) - (left.recommendation_score || 0));
  const featured = ranked.filter(item => item.enabled !== false).slice(0, 3);
  const more = ranked.filter(item => !featured.some(feature => feature.id === item.id));
  const select = (option: ActionOption) => { if (canAct && option.enabled !== false) onChooseOption(option); };

  return <section className={`lower-dock command-deck ${!canAct ? 'waiting-turn' : ''}`} aria-label="行动选择">
    <div className="dock-summary"><span className="section-label"><Hammer size={14} />行动抉择</span><div className="ap-readout"><b>{active.ap}</b><span>AP<br />可用行动点</span></div><span className="dock-team-status">团队修护资源 {state.shared.restoration_resource} · 研究线索 {state.shared.research_clues || 0}</span>{!canAct && <span className="dock-waiting" role="status">等待 {waitingFor} 行动 · 你可以浏览地图和资料</span>}<span className="dock-hint">{!canAct ? '轮到你时，行动按钮会自动恢复。' : actionMode ? `正在选择「${actionLabels[actionMode]}」的落脚处` : featured.length ? `建议先做：${actionLabels[featured[0].type] || featured[0].label}${showRecommendationReasons && featured[0].reason ? ` · ${featured[0].reason}` : ''}` : '此刻风平浪静，等待下一段变化。'}</span>{actionMode && canAct && <button type="button" className="ghost-button" onClick={onCancel}>收回脚步</button>}</div>
    <div className="featured-actions">{featured.map((option, index) => { const type = option.type; const Icon = actionIcons[type] || Sparkles; const selected = actionMode === type; const asset = actionAssets[type]; const disabled = !canAct || mutationPending || option.enabled === false; const detailText = disabled ? option.disabled_reason || option.description : [option.description, option.requirements?.length ? `行动前提：${option.requirements.join('；')}` : ''].filter(Boolean).join(' · '); const label = option.label || actionLabels[type] || type; return <button type="button" key={option.id} className={`action-card action-${type} ${selected ? 'selected' : ''} ${index === 0 ? 'lead-action' : ''} ${disabled ? 'is-disabled' : ''}`} disabled={disabled} onClick={() => select(option)} data-detail={detailText} aria-label={`${label}：${detailText}`}><span className="action-card-icon">{asset ? <img src={assetUrl(`interaction/action-icons/${asset}.webp`)} alt="" /> : <Icon size={20} />}</span><span className="action-card-copy"><b>{label}</b><small>{[option.category_label, disabled ? option.disabled_reason : selected ? '在地图或证据中选择目标' : option.description].filter(Boolean).join(' · ')}</small></span><span className="action-cost">{option.cost?.ap || 0}<small>AP</small></span></button>; })}{!featured.length && <div className="hand-empty">行动正在等待下一次事件结算。</div>}<details className="more-actions"><summary aria-label={`展开更多行动，共 ${more.length} 项`}>更多行动 <span>{more.length}</span><ChevronDown size={14} /></summary><div>{more.map(option => { const type = option.type; const Icon = actionIcons[type] || Sparkles; const disabled = !canAct || mutationPending || option.enabled === false; const detailText = disabled ? option.disabled_reason || option.description : [option.description, option.requirements?.length ? `行动前提：${option.requirements.join('；')}` : ''].filter(Boolean).join(' · '); const label = option.label || actionLabels[type] || type; return <button type="button" key={option.id} disabled={disabled} onClick={() => select(option)} data-detail={detailText} aria-label={`${label}：${detailText}`}><Icon size={15} /><b>{label}</b>{<small>{[option.category_label, disabled ? option.disabled_reason : option.cost?.ap ? `${option.cost.ap} AP` : ''].filter(Boolean).join(' · ')}</small>}</button>; })}</div></details></div>
    <div className="hand-tray"><div className="section-label"><Archive size={14} />我的手牌 <b>{active.hand.length} / 3</b></div><div className="hand-cards">{active.hand.length ? active.hand.map(id => { const item = cards[id]; const playAction = findCardAction(legal, 'play_card', id); return <button type="button" key={id} className="hand-card" onClick={() => onCard(id)}><img src={assetUrl(item?.icon_asset, 'interaction/resource-icons/scroll.webp')} alt="" /><b>{item?.name || id}</b><small>{playAction ? '在研究台中判断它的关系' : '查看这件证据'}</small></button>; }) : <div className="hand-empty">寻访所得的文化线索，会在研究台中成为支持、冲突或待确认的见证。</div>}</div>{active.action_hand?.length ? <div className="strategy-hand"><div className="section-label"><Sparkles size={14} />策略牌 <b>{active.action_hand.length} / 3</b></div><p className="strategy-hand-note">每轮每位同行者抽 1 张；使用后不会立即补牌，满手时需要先弃置。</p><div className="hand-cards">{active.action_hand.map(id => { const definition = actionCards[id] || {}; const option = actionOptions.find(item => item.type === 'use_action_card' && item.id.endsWith(`:${id}`)) || { id: `action:use_action_card:${id}`, type: 'use_action_card' as const, label: String(definition.name || '策略牌'), category_label: '策略牌', action_label: '使用策略牌', description: String(definition.description || '查看这张策略牌的使用时机与效果。'), cost: { ap: Number(definition.cost || 1) }, enabled: false, disabled_reason: definition.timing ? `当前不能使用 · 时机：${String(definition.timing)}` : '当前不能使用', targets: [], recommendation_score: 0, reason: '', confirmation: '', payload: definition } as ActionOption; const detailText = option.disabled_reason || [option.description, option.reason].filter(Boolean).join(' ') || '查看策略牌效果'; const label = option.label; return <button type="button" key={id} className="hand-card strategy-card" disabled={mutationPending} onClick={() => setStrategy(option)} data-detail={detailText} aria-label={`${label}：${detailText}`}><img src={assetUrl('icon_card_scroll.webp')} alt="" /><b>{label}</b><small>{[option.category_label, option.targets.length ? '选择目标后确认' : detailText].filter(Boolean).join(' · ')}</small></button>; })}</div></div> : null}</div>
    {strategy && <StrategyCardDialog option={strategy} disabled={mutationPending} onClose={() => setStrategy(null)} onConfirm={option => { setStrategy(null); onChooseOption(option); }} />}
  </section>;
}


