import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { GameState, Site } from '../../types/game';

export function RoundSummary({ state, sites, onContinue }: { state: GameState; sites: Record<string, Site>; onContinue?: () => void }) {
  const summary = state.shared.round_summary || {};
  if (!summary.round) return null;
  const targetNames = (state.shared.event_targets || []).map(id => sites[id]?.name || '受影响路线').join('、');
  return <section className="round-summary" aria-label="上一回合摘要">
    <div className="round-summary-main"><CheckCircle2 size={18} /><span><b>上一回合已结算</b><small>事件目标：{targetNames || '暂无指定目标'}</small></span></div>
    <span className="round-summary-metrics">压力 {state.shared.weathering_track || 0} · 修护资源 {state.shared.restoration_resource}</span>
    {onContinue && <button onClick={onContinue}>继续 <ArrowRight size={14} /></button>}
  </section>;
}
