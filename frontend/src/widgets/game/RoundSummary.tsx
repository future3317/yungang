import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { GameState, Site } from '../../types/game';
import { StateChangeList } from './StateChangeList';

const metricLabels: Record<string, string> = { weathering: '风化压力', weathering_track: '风化压力', threat: '风化压力', 威胁: '风化压力', restoration_resource: '修护资源', research_clues: '研究线索', influence: '共同影响', route_risk: '路线风险', damage: '节点损伤', 节点损伤: '节点损伤', 修护资源: '修护资源', 路线风险: '路线风险', 路线状态: '路线状态', 个人影响: '个人影响' };

export function RoundSummary({ state, sites, eventName, onContinue }: { state: GameState; sites: Record<string, Site>; eventName?: string; onContinue?: () => void }) {
  const summary = state.shared.round_summary || {};
  if (!summary.round) return null;
  const targetNames = ((summary.event_targets as string[] | undefined) || []).map(id => sites[id]?.name || '受影响路线').join('、');
  const after = summary.after as Record<string, number> | undefined;
  const resolutions = Array.isArray(summary.event_resolution) ? summary.event_resolution as Array<{ label?: string; changes?: Record<string, string | number>; reason?: string }> : [];
  const weathering = typeof after?.weathering_track === 'number' ? after.weathering_track : state.shared.weathering_track || 0;
  const resources = typeof after?.restoration_resource === 'number' ? after.restoration_resource : state.shared.restoration_resource;
  return <section className="round-summary" aria-label="上一回合摘要">
    <div className="round-summary-main"><CheckCircle2 size={18} /><span><b>{eventName || '上一回合事件'} · 已结算</b><small>影响范围：{targetNames || '暂无指定目标'}</small>{resolutions.map((item, index) => <span key={`${item.label || 'result'}-${index}`}><small>{item.label || '事件结果'}{item.reason ? ` · ${item.reason}` : ''}</small><StateChangeList compact changes={Object.entries(item.changes || {}).map(([metric, value]) => typeof value === 'number' ? ({ label: metricLabels[metric] || '状态变化', delta: value }) : ({ label: metricLabels[metric] || '状态变化', after: value }))} /></span>)}</span></div>
    <span className="round-summary-metrics">风化压力 {weathering} · 修护资源 {resources}</span>
    {onContinue && <button onClick={onContinue}>继续 <ArrowRight size={14} /></button>}
  </section>;
}
