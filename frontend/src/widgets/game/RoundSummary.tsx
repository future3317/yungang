import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { GameState, Site } from '../../types/game';

export function RoundSummary({ state, sites, onContinue }: { state: GameState; sites: Record<string, Site>; onContinue?: () => void }) {
  const summary = state.shared.round_summary || {};
  if (!summary.round) return null;
  const targetNames = ((summary.event_targets as string[] | undefined) || []).map(id => sites[id]?.name || '受影响路线').join('、');
  const after = summary.after as Record<string, number> | undefined;
  const resolutions = Array.isArray(summary.event_resolution) ? summary.event_resolution as Array<{ label?: string; changes?: Record<string, string | number>; reason?: string }> : [];
  const weathering = typeof after?.weathering === 'number' ? after.weathering : state.shared.weathering_track || 0;
  const resources = typeof after?.restoration_resource === 'number' ? after.restoration_resource : state.shared.restoration_resource;
  return <section className="round-summary" aria-label="上一回合摘要">
    <div className="round-summary-main"><CheckCircle2 size={18} /><span><b>上一回合已结算</b><small>事件目标：{targetNames || '暂无指定目标'}</small>{resolutions.length > 0 && <small>{resolutions.map((item, index) => <span key={`${item.label || 'result'}-${index}`}>{item.label || '事件结果'}：{Object.entries(item.changes || {}).map(([key, value]) => `${key} ${typeof value === 'number' && value > 0 ? '+' : ''}${value}`).join('、')}</span>)}</small>}</span></div>
    <span className="round-summary-metrics">风化压力 {weathering} · 修护资源 {resources}</span>
    {onContinue && <button onClick={onContinue}>继续 <ArrowRight size={14} /></button>}
  </section>;
}
