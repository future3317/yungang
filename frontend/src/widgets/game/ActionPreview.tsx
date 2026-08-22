import { AlertTriangle, Check, X } from 'lucide-react';
import type { Action, ContentCard, Player, RouteState, Site } from '../../types/game';
import { actionLabels, localizeActionText, previewDeltaText, resolveTargetName } from './gameUi';

export function resolveActionTargetName(action: Action, sites: Record<string, Site>, routes: Record<string, RouteState> = {}, players: Record<string, Player> = {}) {
  const locationFirst = action.type === 'interpret_evidence' || action.type === 'form_interpretation' || action.type === 'choose_intervention';
  const target = locationFirst ? action.target_site_id || action.target_id || action.route_id : action.target_id || action.target_site_id || action.route_id;
  if (locationFirst && (!target || !sites[target])) return '当前地点';
  if (!target) return '当前地点';
  return resolveTargetName(target, sites, routes, {}, players);
}

export function ActionPreview({ action, sites, routes, cards, players = {}, isPending = false, onConfirm, onCancel }: { action: Action; sites: Record<string, Site>; routes?: Record<string, RouteState>; cards: Record<string, ContentCard>; players?: Record<string, Player>; isPending?: boolean; onConfirm: () => void; onCancel: () => void }) {
  const targetName = resolveActionTargetName(action, sites, routes, players);
  const cardName = action.card_id ? cards[action.card_id]?.name : undefined;
  const heading = action.type === 'move' && targetName !== '当前地点' ? `移动到${targetName}` : localizeActionText(action.label) || actionLabels[action.type] || '确认行动';
  return <div className="dialog-backdrop"><section className="dialog action-preview" role="dialog" aria-modal="true" aria-labelledby="action-preview-title">
    <button className="dialog-close" disabled={isPending} onClick={onCancel} aria-label="取消行动"><X /></button>
    <span className="eyebrow"><AlertTriangle size={14} />行动确认</span><h2 id="action-preview-title">{heading}</h2>
    <div className="preview-grid"><span><small>目标</small><b>{targetName}</b></span><span><small>消耗</small><b>{action.cost || 0} AP</b></span>{cardName && <span><small>证据</small><b>{cardName}</b></span>}</div>
    <p>{action.description || '确认后将立即结算这次行动，并更新地图上的路线、资源或地点状态。'}</p>
    {action.requirements?.length ? <div className="action-requirements" aria-label="行动前提"><b>行动前提</b><span>{action.requirements.join(' · ')}</span></div> : null}
    {action.preview_delta && Object.keys(action.preview_delta).length > 0 && <div className="preview-effects"><b>预计变化</b><span>{previewDeltaText(action.preview_delta, '状态会在结算后更新')}</span></div>}
    <div className="dialog-actions"><button className="ghost-button" disabled={isPending} onClick={onCancel}><X size={15} />返回浏览</button><button className="primary-cta" disabled={isPending} aria-label="确认行动：踏上这一步" onClick={onConfirm}><Check size={15} />{isPending ? '正在结算…' : '踏上这一步'}</button></div>
  </section></div>;
}
