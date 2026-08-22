import { Check, X } from 'lucide-react';
import type { ActionOption } from '../../types/game';
import { localizeActionText, previewDeltaText } from './gameUi';

export function StrategyCardDialog({ option, disabled = false, onConfirm, onClose }: { option: ActionOption; disabled?: boolean; onConfirm: (option: ActionOption) => void; onClose: () => void }) {
  const payload = (option.payload || {}) as Record<string, unknown>;
  return <div className="dialog-backdrop"><section className="dialog strategy-dialog" role="dialog" aria-modal="true" aria-labelledby="strategy-card-dialog-title">
    <button className="dialog-close" disabled={disabled} onClick={onClose} aria-label="关闭策略牌说明"><X /></button>
    <span className="eyebrow">策略牌说明</span><h2 id="strategy-card-dialog-title">{localizeActionText(option.label)}</h2>
    <p>{localizeActionText(option.description)}</p>
    <dl><div><dt>使用时机</dt><dd>{localizeActionText(String(payload.timing || '当前行动阶段'))}</dd></div><div><dt>可选目标</dt><dd>{option.targets.length ? option.targets.slice(0, 4).map(target => localizeActionText(target.label)).join('、') + (option.targets.length > 4 ? ` 等 ${option.targets.length} 个目标` : '') : '当前地点或团队'}</dd></div><div><dt>最适合</dt><dd>{localizeActionText(String(payload.best_use || option.reason || '根据当前风险选择目标。'))}</dd></div><div><dt>限制</dt><dd>{localizeActionText(String(payload.limitations || option.disabled_reason || '请先选择合法目标。'))}</dd></div><div><dt>预计变化</dt><dd>{previewDeltaText(option.preview_delta, '选择目标后显示预计变化。')}</dd></div></dl>
    <div className="dialog-actions"><button className="ghost-button" disabled={disabled} onClick={onClose}>返回浏览</button><button className="primary-cta" disabled={disabled || option.enabled === false} onClick={() => onConfirm(option)}><Check size={15} />继续选择目标</button></div>
  </section></div>;
}
