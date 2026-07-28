import { AlertTriangle, Check, X } from 'lucide-react';
import type { Action, ContentCard, Site } from '../../types/game';
import { actionLabels, localizeActionText, previewDeltaText } from './gameUi';

export function ActionPreview({ action, sites, cards, isPending = false, onConfirm, onCancel }: { action: Action; sites: Record<string, Site>; cards: Record<string, ContentCard>; isPending?: boolean; onConfirm: () => void; onCancel: () => void }) {
  const target = action.target_id || action.target_site_id;
  const targetName = target ? sites[target]?.name || (action.route_id ? '选中的路线' : target) : '当前地点';
  const cardName = action.card_id ? cards[action.card_id]?.name : undefined;
  const heading = action.type === 'move' && targetName !== '当前地点' ? `移动到${targetName}` : actionLabels[action.type] || localizeActionText(action.label);
  return <div className="dialog-backdrop"><section className="dialog action-preview" role="dialog" aria-modal="true" aria-labelledby="action-preview-title">
    <span className="eyebrow"><AlertTriangle size={14} />行动确认</span><h2 id="action-preview-title">{heading}</h2>
    <div className="preview-grid"><span><small>目标</small><b>{targetName}</b></span><span><small>消耗</small><b>{action.cost || 0} AP</b></span>{cardName && <span><small>证据</small><b>{cardName}</b></span>}</div>
    <p>{action.preview_delta && Object.keys(action.preview_delta).length ? `预计变化：${previewDeltaText(action.preview_delta, '状态会在结算后更新')}` : '确认后将立即结算这次行动，并更新地图上的路线、资源或地点状态。'}</p>
    <div className="dialog-actions"><button className="ghost-button" disabled={isPending} onClick={onCancel}><X size={15} />返回浏览</button><button className="primary-cta" disabled={isPending} aria-label="确认行动：踏上这一步" onClick={onConfirm}><Check size={15} />{isPending ? '正在结算…' : '踏上这一步'}</button></div>
  </section></div>;
}
