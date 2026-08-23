import { useState } from 'react';
import {
  Archive,
  ChevronDown,
  Compass,
  HandHeart,
  Hammer,
  MapPinned,
  ScanSearch,
  ShieldPlus,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import type { Action, ActionOption, ActionType, ContentCard, GameState, Player } from '../../types/game';
import { findCardAction } from './gameUi';
import { assetUrl } from '../../shared/assetUrl';
import { StrategyCardDialog } from './StrategyCardDialog';
import styles from './CommandDock.module.css';

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
const actionAssets: Partial<Record<ActionType, string>> = {
  explore: 'explore',
  interpret_evidence: 'contribute',
  restore: 'repair',
};
const primaryOrder: ActionType[] = ['move', 'explore', 'interpret_evidence', 'restore', 'survey_route'];
function orderOf(type: ActionType) {
  const index = primaryOrder.indexOf(type);
  return index === -1 ? primaryOrder.length : index;
}

export function CommandDock({
  state,
  active,
  cards,
  actionCards = {},
  legal,
  actionOptions = [],
  actionMode,
  actionLabels,
  mutationPending,
  canAct = true,
  onChooseOption,
  onCancel,
  onCard,
}: {
  state: GameState;
  active: Player;
  cards: Record<string, ContentCard>;
  actionCards?: Record<string, Record<string, unknown>>;
  legal: Action[];
  actionOptions: ActionOption[];
  actionMode: ActionType | null;
  actionLabels: Partial<Record<ActionType, string>>;
  mutationPending: boolean;
  canAct?: boolean;
  onChooseOption: (option: ActionOption) => void;
  onCancel: () => void;
  onCard: (id: string) => void;
}) {
  const [strategy, setStrategy] = useState<ActionOption | null>(null);
  const showRecommendationReasons =
    (state.shared.effective_rules as Record<string, unknown> | undefined)?.show_recommendation_reasons === true;
  const waitingFor = state.players?.[state.shared.active_player_id]?.name || '当前行动者';
  const ranked = [...actionOptions].sort(
    (left, right) =>
      (right.recommendation_score || 0) - (left.recommendation_score || 0) ||
      orderOf(left.type) - orderOf(right.type) ||
      left.label.localeCompare(right.label, 'zh-CN')
  );
  const featured = ranked.filter((item) => item.enabled !== false).slice(0, 3);
  const more = ranked.filter((item) => item.enabled !== false && !featured.some((feature) => feature.id === item.id));
  const unavailable = ranked.filter((item) => item.enabled === false);
  const select = (option: ActionOption) => {
    if (!canAct || option.enabled === false) return;
    if (option.type === 'use_action_card') setStrategy(option);
    else onChooseOption(option);
  };

  return (
    <section className={`${styles.commandDeck} ${!canAct ? styles.waitingTurn : ''}`.trim()} aria-label="行动选择">
      <div className={styles.dockSummary}>
        <span className={styles.sectionLabel}>
          <Hammer size={14} />
          行动抉择
        </span>
        <div className={styles.apReadout}>
          <b>{active.ap}</b>
          <span>
            行动点
          </span>
        </div>
        <span className={styles.dockTeamStatus}>
          修护 {state.shared.restoration_resource} · 研究 {state.shared.research_clues || 0}
        </span>
        {!canAct && (
          <span className={styles.dockWaiting} role="status">
            等待 {waitingFor} 行动 · 你可以浏览地图和资料
          </span>
        )}
        <span className={styles.dockHint}>
          {!canAct
            ? '轮到你时，行动按钮会自动恢复。'
            : actionMode
              ? `正在选择「${actionLabels[actionMode]}」的合法目标`
              : featured.length
                ? `建议先做：${actionLabels[featured[0].type] || featured[0].label}${showRecommendationReasons && featured[0].reason ? ` · ${featured[0].reason}` : ''}`
                : '此刻风平浪静，等待下一段变化。'}
        </span>
        {actionMode && canAct && (
          <button type="button" className="ghost-button" onClick={onCancel}>
            收回脚步
          </button>
        )}
      </div>
      <div className={styles.featuredActions}>
        {featured.map((option, index) => {
          const type = option.type;
          const Icon = actionIcons[type] || Sparkles;
          const selected = actionMode === type;
          const asset = actionAssets[type];
          const disabled = !canAct || mutationPending || option.enabled === false;
          const detailText = disabled
            ? option.disabled_reason || option.description
            : [option.description, option.requirements?.length ? `行动前提：${option.requirements.join('；')}` : '']
                .filter(Boolean)
                .join(' · ');
          const label = option.label || actionLabels[type] || '未命名行动';
          return (
            <button
              type="button"
              key={option.id}
              className={`${styles.actionCard} ${styles[`action-${type}`] || ''} ${selected ? styles.selected : ''} ${disabled ? styles.isDisabled : ''}`.trim()}
              disabled={disabled}
              onClick={() => select(option)}
              data-detail={detailText}
              aria-label={`${label}：${detailText}`}
            >
              <span className={styles.actionCardIcon}>
                {asset ? <img src={assetUrl(`interaction/action-icons/${asset}.webp`)} alt="" /> : <Icon size={20} />}
              </span>
              <span className={styles.actionCardCopy}>
                <b>{index === 0 && <i className={styles.recommended}>推荐</i>}{label}</b>
                <small>
                  {[
                    option.category_label,
                    disabled ? option.disabled_reason : selected ? '在地图或证据中选择目标' : option.description,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </span>
              <span className={styles.actionCost}>
                {option.cost?.ap || 0}
                <small>行动点</small>
              </span>
            </button>
          );
        })}
        {!featured.length && <div className={styles.handEmpty}>行动正在等待下一次事件结算。</div>}
        <details className={styles.moreActions}>
          <summary aria-label={`展开更多行动，共 ${more.length} 项`}>
            更多行动 <span>{more.length}</span>
            <ChevronDown size={14} />
          </summary>
          <div>
            {more.map((option) => {
              const type = option.type;
              const Icon = actionIcons[type] || Sparkles;
              const disabled = !canAct || mutationPending || option.enabled === false;
              const detailText = disabled
                ? option.disabled_reason || option.description
                : [option.description, option.requirements?.length ? `行动前提：${option.requirements.join('；')}` : '']
                    .filter(Boolean)
                    .join(' · ');
              const label = option.label || actionLabels[type] || '未命名行动';
              return (
                <button
                  type="button"
                  key={option.id}
                  disabled={disabled}
                  onClick={() => select(option)}
                  data-detail={detailText}
                  aria-label={`${label}：${detailText}`}
                >
                  <Icon size={15} />
                  <b>{label}</b>
                  {
                    <small>
                      {[
                        option.category_label,
                        disabled ? option.disabled_reason : option.cost?.ap ? `${option.cost.ap} 行动点` : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  }
                </button>
              );
            })}
            {unavailable.length ? (
              <div className={styles.unavailableLabel}>
                <b>暂不可用 {unavailable.length} 项</b>
                {unavailable.map((option) => (
                  <span key={option.id}>{option.label || actionLabels[option.type] || '行动'} · {option.disabled_reason || '当前条件未满足'}</span>
                ))}
              </div>
            ) : null}
          </div>
        </details>
      </div>
      <details className={styles.handTray}>
        <summary className={styles.handTrigger}>
          <span><Archive size={14} />证据 {active.hand.length} / 3</span>
          <span><Sparkles size={14} />策略 {active.action_hand?.length || 0} / 3</span>
          <ChevronDown size={16} />
        </summary>
        <div className={styles.handContent}>
          <div className={styles.sectionLabel}>
            <Archive size={14} />
            我的证据卡 <b>{active.hand.length} / 3</b>
          </div>
          <div className={styles.handCards}>
          {active.hand.length ? (
            active.hand.map((id, index) => {
              const item = cards[id];
              const interpretAction = findCardAction(legal, 'interpret_evidence', id);
              const playAction = findCardAction(legal, 'play_card', id);
              return (
                <button type="button" key={`${id}-${index}`} className={styles.handCard} data-testid="evidence-hand-card" onClick={() => onCard(id)}>
                  <img src={assetUrl(item?.icon_asset, 'interaction/resource-icons/scroll.webp')} alt="" />
                  <b>{item?.name || id}</b>
                  <small>{interpretAction ? '可用于当前研判' : playAction ? '可发动即时效果' : '查看这件证据'}</small>
                </button>
              );
            })
          ) : (
            <div className={styles.handEmpty}>寻访所得的证据卡，会在研究台中成为支持、冲突或待确认的见证。</div>
          )}
          </div>
          {active.action_hand?.length ? (
            <div className={styles.strategyHand}>
              <div className={styles.sectionLabel}>
                <Sparkles size={14} />
                策略牌 <b>{active.action_hand.length} / 3</b>
              </div>
              <p className={styles.strategyHandNote}>每轮每位同行者抽 1 张；使用后不会立即补牌，满手时需要先弃置。</p>
              <div className={styles.handCards}>
              {active.action_hand.map((id, index) => {
                const definition = actionCards[id] || {};
                const option =
                  actionOptions.find((item) => item.type === 'use_action_card' && item.id.endsWith(`:${id}`)) ||
                  ({
                    id: `action:use_action_card:${id}`,
                    type: 'use_action_card' as const,
                    label: String(definition.name || '策略牌'),
                    category_label: '策略牌',
                    action_label: '使用策略牌',
                    description: String(definition.description || '查看这张策略牌的使用时机与效果。'),
                    cost: { ap: Number(definition.cost || 1) },
                    enabled: false,
                    disabled_reason: definition.timing
                      ? `当前不能使用 · 时机：${String(definition.timing)}`
                      : '当前不能使用',
                    targets: [],
                    recommendation_score: 0,
                    reason: '',
                    confirmation: '',
                    payload: definition,
                  } as ActionOption);
                const detailText =
                  option.disabled_reason ||
                  [option.description, option.reason].filter(Boolean).join(' ') ||
                  '查看策略牌效果';
                const label = option.label;
                return (
                  <button
                    type="button"
                    key={`${id}-${index}`}
                    className={`${styles.handCard} ${styles.strategyCard}`}
                    disabled={mutationPending}
                    onClick={() => setStrategy(option)}
                    data-testid="strategy-card"
                    data-detail={detailText}
                    aria-label={`${label}：${detailText}`}
                  >
                    <img src={assetUrl('icon_card_scroll.webp')} alt="" />
                    <b>{label}</b>
                    <small>
                      {[option.category_label, option.targets.length ? '选择目标后确认' : detailText]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  </button>
                );
              })}
              </div>
            </div>
          ) : null}
        </div>
      </details>
      {strategy && (
        <StrategyCardDialog
          option={strategy}
          disabled={mutationPending}
          onClose={() => setStrategy(null)}
          onConfirm={(option) => {
            setStrategy(null);
            onChooseOption(option);
          }}
        />
      )}
    </section>
  );
}
