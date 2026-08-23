import { Check, X } from 'lucide-react';
import type { Action, ContentCard } from '../../types/game';
import { assetUrl } from '../../shared/assetUrl';
import { useDialogFocus } from './useDialogFocus';
import { previewDeltaText } from './gameUi';
import { Button } from '../ui/Primitives';

type EvidenceCardDialogProps = {
  id: string;
  item?: ContentCard;
  action?: Action;
  interpretActions?: Action[];
  onClose: () => void;
  onUse: (action?: Action) => void;
};

export function EvidenceCardDialog({
  id,
  item,
  action,
  interpretActions = [],
  onClose,
  onUse,
}: EvidenceCardDialogProps) {
  const ref = useDialogFocus();
  const relationLabels: Record<string, string> = { support: '支持', conflict: '冲突', pending: '待确认' };
  const evidenceText = item?.evidence_use_text || '把这件证据投入当前地点的研究台，判断它与其他证据卡的关系。';
  const instantText = item?.instant_use_text || action?.description || '发动牌面效果后，这张牌会进入弃牌堆。';

  return (
    <div className="dialog-backdrop">
      <section
        ref={ref}
        className="dialog card-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-card-dialog-title"
      >
        <button className="dialog-close" onClick={onClose} aria-label="关闭">
          <X />
        </button>
        <img className="dialog-card-art" src={assetUrl(item?.icon_asset)} alt="" />
        <span className="eyebrow">证据卡</span>
        <h2 id="evidence-card-dialog-title">{item?.name || id}</h2>
        <p>{item?.description || item?.summary || '一份等待被理解并投入合适地点的文化记录。'}</p>
        <div className="card-use-choice">
          <b>投入研究台</b>
          <span>
            {evidenceText} 需要消耗 {interpretActions[0]?.cost || 1} 行动点，不会弃置这张牌。
          </span>
          {interpretActions.length > 0 ? (
            <div className="card-action-group">
              {interpretActions.map((candidate) => (
                <button key={candidate.target_id} className="secondary-action" onClick={() => onUse(candidate)}>
                  归入{relationLabels[candidate.target_id || ''] || '研究台'} · 消耗 {candidate.cost || 1} 行动点
                </button>
              ))}
            </div>
          ) : (
            <small>当前没有可用的研究台目标；先抵达对应节点并保留行动点。</small>
          )}
        </div>
        <div className="card-use-choice card-use-choice-immediate">
          <b>发动即时效果并弃置</b>
          <span>{instantText}</span>
          {action?.preview_delta && Object.keys(action.preview_delta).length > 0 && (
            <small>预计变化：{previewDeltaText(action.preview_delta, '结算后更新团队状态。')}</small>
          )}
          <Button context="card-immediate" disabled={!action} onClick={() => onUse(action)}>
            <Check size={15} />
            {action ? '查看即时效果' : '当前不可使用'}
          </Button>
        </div>
      </section>
    </div>
  );
}
