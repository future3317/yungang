import { AlertTriangle, Check, X } from 'lucide-react';
import type { Action, ContentCard, Site } from '../../types/game';

export function ActionPreview({ action, sites, cards, onConfirm, onCancel }: { action: Action; sites: Record<string, Site>; cards: Record<string, ContentCard>; onConfirm: () => void; onCancel: () => void }) {
  const target = action.target_id || action.target_site_id;
  const targetName = target ? sites[target]?.name || (action.route_id ? '选中的路线' : target) : '当前地点';
  const cardName = action.card_id ? cards[action.card_id]?.name : undefined;
  return <div className="dialog-backdrop"><section className="dialog action-preview" role="dialog" aria-modal="true" aria-labelledby="action-preview-title">
    <span className="eyebrow"><AlertTriangle size={14} />行动前确认</span><h2 id="action-preview-title">{action.label}</h2>
    <div className="preview-grid"><span><small>目标</small><b>{targetName}</b></span><span><small>消耗</small><b>{action.cost || 0} AP</b></span>{cardName && <span><small>证据</small><b>{cardName}</b></span>}</div>
    <p>确认后服务端会立即结算这项行动。地图、资源、任务进度和事件风险可能同时变化。</p>
    <div className="dialog-actions"><button className="ghost-button" onClick={onCancel}><X size={15} />取消</button><button className="primary-cta" onClick={onConfirm}><Check size={15} />确认行动</button></div>
  </section></div>;
}
