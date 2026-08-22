import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { GameState, RouteState, Site, SiteReference } from '../../types/game';
import type { components } from '../../shared/api/generated';
import { StateChangeList } from './StateChangeList';

const metricLabels: Record<string, string> = { weathering: '风化压力', weathering_track: '风化压力', restoration_resource: '修护资源', research_clues: '研究线索', influence: '共同影响', route_risk: '路线风险', damage: '节点损伤', 节点损伤: '节点损伤', 修护资源: '修护资源', 路线风险: '路线风险', 路线状态: '路线状态', 个人影响: '个人影响' };

export function RoundSummary({ state, sites, routes = {}, eventName, onContinue }: { state: GameState; sites: Record<string, SiteReference>; routes?: Record<string, RouteState>; eventName?: string; onContinue?: () => void }) {
  const summary = (state.shared.round_summary || {}) as components['schemas']['RoundSummary'];
  if (!summary.round) return null;
  const targetNames = ((summary.event_targets as string[] | undefined) || []).map(id => sites[id]?.name || routes[id]?.name || '受影响目标').join('、');
  const after = summary.after as Record<string, number> | undefined;
  const resolutions = Array.isArray(summary.event_resolution) ? summary.event_resolution as Array<{ label?: string; changes?: Record<string, string | number>; reason?: string }> : [];
  const weathering = typeof after?.weathering === 'number' ? after.weathering : typeof after?.weathering_track === 'number' ? after.weathering_track : state.shared.weathering_track || 0;
  const resources = typeof after?.restoration_resource === 'number' ? after.restoration_resource : state.shared.restoration_resource;
  const roundEffects = Array.isArray(summary.round_effects) ? summary.round_effects as Array<{ label?: string; changes?: Record<string, string | number>; reason?: string }> : [];
  const siteChanges = Array.isArray(summary.site_changes) ? summary.site_changes as Array<{ label?: string; before?: number; after?: number; status_after?: string }> : [];
  const routeChanges = Array.isArray(summary.route_changes) ? summary.route_changes as Array<{ label?: string; before?: number; after?: number; status_after?: string }> : [];
  const statusText = (value?: string) => ({ stable: '稳定', at_risk: '承压', closed: '已关闭', open: '通行', strained: '承压', blocked: '阻断', restored: '已修护', illuminated: '已点亮' }[value || ''] || value || '');
  return <section className="round-summary" aria-label="上一回合摘要">
    <div className="round-summary-main"><CheckCircle2 size={18} /><span><b>上一回合 · {eventName || '事件'} · 已结算</b><small>影响范围：{targetNames || '暂无指定目标'}</small>{siteChanges.map(item => <small key={`site-${item.label}`}>{item.label}：损伤 {item.before} → {item.after}{item.status_after ? ` · ${statusText(item.status_after)}` : ''}</small>)}{routeChanges.map(item => <small key={`route-${item.label}`}>{item.label}：风险 {item.before} → {item.after}{item.status_after ? ` · ${statusText(item.status_after)}` : ''}</small>)}{resolutions.map((item, index) => <span key={`${item.label || 'result'}-${index}`}><small>{item.label || '事件结果'}{item.reason ? ` · ${item.reason}` : ''}</small><StateChangeList compact changes={Object.entries(item.changes || {}).map(([metric, value]) => typeof value === 'number' ? ({ label: metricLabels[metric] || '状态变化', delta: value }) : ({ label: metricLabels[metric] || '状态变化', after: value }))} /></span>)}{roundEffects.map((item, index) => <span key={`round-effect-${index}`}><small>{item.label || '团队协作'}{item.reason ? ` · ${item.reason}` : ''}</small><StateChangeList compact changes={Object.entries(item.changes || {}).map(([metric, value]) => typeof value === 'number' ? ({ label: metricLabels[metric] || '状态变化', delta: value }) : ({ label: metricLabels[metric] || '状态变化', after: value }))} /></span>)}{summary.next_priority && <small className="round-summary-next">下一步优先：{summary.next_priority}</small>}</span></div>
    <span className="round-summary-metrics">风化压力 {weathering} · 修护资源 {resources} · 研究线索 {typeof (after as Record<string, unknown>)?.research_clues === 'number' ? (after as Record<string, number>).research_clues : state.shared.research_clues || 0}</span>
    {onContinue && <button onClick={onContinue}>继续 <ArrowRight size={14} /></button>}
  </section>;
}
