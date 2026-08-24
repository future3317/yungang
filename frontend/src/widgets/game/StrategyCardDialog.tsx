import { Check, X } from 'lucide-react';
import type { ActionOption } from '../../types/game';
import { actionPresentation, actionTimingLabel, previewDeltaText } from './gameUi';
import { Button } from '../ui/Primitives';
import { DialogBackdrop } from './DialogBackdrop';

export function StrategyCardDialog({
  option,
  disabled = false,
  onConfirm,
  onClose,
}: {
  option: ActionOption;
  disabled?: boolean;
  onConfirm: (option: ActionOption) => void;
  onClose: () => void;
}) {
  const payload = (option.payload || {}) as Record<string, unknown>;
  const effect = (payload.effect || {}) as Record<string, unknown>;
  const effectType = String(effect.type || '');
  const presentation = actionPresentation(option);
  const immediateEffects: Record<string, string> = {
    survey_route: `目标路线风险 ${Number(effect.risk_delta ?? -1) > 0 ? '+' : ''}${Number(effect.risk_delta ?? -1)}，研究点 +${Number(effect.clues || 0)}`,
    restore_route: '目标路线恢复通行；本次不消耗研究点。',
    establish_connection: '目标路线升级为稳定连接，区域连接进度 +1。',
    prepare_event: '为当前事件做好准备，结算时风化压力 -1。',
    survey_multiple_routes: `按选择处理最多 ${Number(effect.max_targets || 2)} 条承压路线，降低路线风险。`,
    reduce_route_risk: `目标路线风险 ${Number(effect.risk_delta ?? -Number(effect.amount || 1)) > 0 ? '+' : ''}${Number(effect.risk_delta ?? -Number(effect.amount || 1))}。`,
    remote_exchange_or_connect: '与远程同行者交换证据，或点亮一条已修护路线。',
    reserve_ap: `为下一次行动保留 ${Number(effect.amount || 1)} 点行动点。`,
    survey_and_mitigate: '目标路线风险 -1，风化压力 -1。',
    restore_and_move: '恢复目标路线，并获得一次不消耗行动点的移动。',
    transfer_resource:
      effect.resource === 'ap'
        ? `为目标同行者增加 ${Number(effect.amount || 1)} 点行动点。`
        : `将 ${Number(effect.amount || 1)} 点团队修护资源转给目标同行者。`,
    team_prepare: `为最多 ${Number(effect.max_targets || 2)} 位同行者准备当前事件，结算时风化压力 -1。`,
  };
  const immediateEffect = String(effect.description || immediateEffects[effectType] || presentation.description);
  return (
    <DialogBackdrop>
      <section
        className="dialog strategy-dialog strategy-card-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="strategy-card-dialog-title"
      >
        <button className="dialog-close" disabled={disabled} onClick={onClose} aria-label="关闭策略牌说明">
          <X />
        </button>
        <span className="eyebrow">策略牌说明</span>
        <h2 id="strategy-card-dialog-title">{presentation.label}</h2>
        <p>{presentation.description}</p>
        <dl>
          <div>
            <dt>使用时机</dt>
            <dd>{actionTimingLabel(String(payload.timing || ''))}</dd>
          </div>
          <div>
            <dt>消耗</dt>
            <dd>{option.cost?.ap || 0} 点行动点</dd>
          </div>
          <div>
            <dt>可选目标</dt>
            <dd>
              {option.targets.length
                ? option.targets
                    .slice(0, 4)
                    .map((target) => target.label)
                    .join('、') + (option.targets.length > 4 ? ` 等 ${option.targets.length} 个目标` : '')
                : '当前地点或团队'}
            </dd>
          </div>
          <div>
            <dt>立即效果</dt>
            <dd>{immediateEffect}</dd>
          </div>
          <div>
            <dt>最适合</dt>
            <dd>{String(payload.best_use || option.reason || '根据当前风险选择目标。')}</dd>
          </div>
          <div>
            <dt>限制</dt>
            <dd>{String(payload.limitations || option.disabled_reason || '请先选择合法目标。')}</dd>
          </div>
          <div>
            <dt>预计变化</dt>
            <dd>{previewDeltaText(option.preview_delta, '选择目标后显示预计变化。')}</dd>
          </div>
        </dl>
        <div className="dialog-actions">
          <button className="ghost-button" disabled={disabled} onClick={onClose}>
            返回浏览
          </button>
          <Button context="dialog" disabled={disabled || option.enabled === false} onClick={() => onConfirm(option)}>
            <Check size={15} />
            继续选择目标
          </Button>
        </div>
      </section>
    </DialogBackdrop>
  );
}
