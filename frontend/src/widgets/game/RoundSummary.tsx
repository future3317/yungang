import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { GameState, RouteState, SiteReference } from '../../types/game';
import type { components } from '../../shared/api/generated';
import styles from './RoundSummary.module.css';

export function RoundSummary({
  state,
  sites,
  routes = {},
  eventName,
  onContinue,
}: {
  state: GameState;
  sites: Record<string, SiteReference>;
  routes?: Record<string, RouteState>;
  eventName?: string;
  onContinue?: () => void;
}) {
  const summary = (state.shared.round_summary || {}) as components['schemas']['RoundSummary'];
  if (!summary.round) return null;
  const targetNames = ((summary.event_targets as string[] | undefined) || [])
    .map((id) => sites[id]?.name || routes[id]?.name || '受影响目标')
    .join('、');
  const after = summary.after as Record<string, number> | undefined;
  const weathering =
    typeof after?.weathering === 'number'
      ? after.weathering
      : typeof after?.weathering_track === 'number'
        ? after.weathering_track
        : state.shared.weathering_track || 0;
  const resources =
    typeof after?.restoration_resource === 'number' ? after.restoration_resource : state.shared.restoration_resource;
  const siteChanges = Array.isArray(summary.site_changes)
    ? (summary.site_changes as Array<{ label?: string; before?: number; after?: number; status_after?: string }>)
    : [];
  const damageDelta = siteChanges.reduce((total, item) => total + Math.max(0, (item.after || 0) - (item.before || 0)), 0);
  return (
    <section className={`${styles.roundSummary} round-summary`} aria-label="上一回合摘要">
      <div className={styles.roundSummaryMain}>
        <CheckCircle2 size={18} />
        <span>
          <b>上一回合：{eventName || '事件'}已结算</b>
          <small>{targetNames || '未锁定影响目标'}{damageDelta ? ` · ${damageDelta} 个节点受损` : ''}{summary.next_priority ? ` · 下一步：${summary.next_priority}` : ''}</small>
        </span>
      </div>
      <span className={styles.roundSummaryMetrics}>
        风化压力 {weathering} · 修护资源 {resources} · 研究点{' '}
        {typeof (after as Record<string, unknown>)?.research_clues === 'number'
          ? (after as Record<string, number>).research_clues
          : state.shared.research_clues || 0}
      </span>
      {onContinue && (
        <button className={styles.continueButton} onClick={onContinue}>
          继续 <ArrowRight size={14} />
        </button>
      )}
    </section>
  );
}
