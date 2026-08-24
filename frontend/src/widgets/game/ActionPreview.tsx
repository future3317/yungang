import { AlertTriangle, Check, X } from 'lucide-react';
import type { Action, ContentCard, Player, ProjectState, RouteState, Site, SiteReference } from '../../types/game';
import { actionPresentation, previewDeltaText, resolveTargetName } from './gameUi';
import { Button } from '../ui/Primitives';
import { DialogBackdrop } from './DialogBackdrop';

export function resolveActionTargetName(
  action: Action,
  sites: Record<string, SiteReference>,
  routes: Record<string, RouteState> = {},
  players: Record<string, Player> = {}
) {
  const locationFirst =
    action.type === 'interpret_evidence' ||
    action.type === 'form_interpretation' ||
    action.type === 'choose_intervention';
  const target = locationFirst
    ? action.target_site_id || action.target_id || action.route_id
    : action.target_id || action.target_site_id || action.route_id;
  if (locationFirst && (!target || !sites[target])) return '当前地点';
  if (!target) return '当前地点';
  return resolveTargetName(target, sites, routes, {}, players);
}

export function ActionPreview({
  action,
  sites,
  routes,
  projects = {},
  cards,
  players = {},
  isPending = false,
  onConfirm,
  onCancel,
}: {
  action: Action;
  sites: Record<string, SiteReference>;
  routes?: Record<string, RouteState>;
  projects?: Record<string, ProjectState>;
  cards: Record<string, ContentCard>;
  players?: Record<string, Player>;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const targetName = action.target_label || resolveActionTargetName(action, sites, routes, players);
  const targetKindLabel: Record<string, string> = { site: '目标地点', route: '目标路线', player: '目标同行者', card: '目标证据', project: '目标项目', current: '当前地点', none: '无需目标' };
  const cardName = action.card_id ? cards[action.card_id]?.name : undefined;
  const relation =
    action.type === 'interpret_evidence'
      ? ({ support: '支持', conflict: '冲突', pending: '待确认' } as Record<string, string>)[action.target_id || ''] ||
        ''
      : '';
  const intervention =
    action.type === 'choose_intervention'
      ? ({ act_now: '立即处理', minimal: '最小干预', record: '先记录' } as Record<string, string>)[
          action.target_id || ''
        ] || ''
      : '';
  const presentation = actionPresentation(action);
  const heading =
    action.type === 'move' && targetName !== '当前地点'
      ? `移动到${targetName}`
      : presentation.label;
  return (
    <DialogBackdrop>
      <section className="dialog action-preview" role="dialog" aria-modal="true" aria-labelledby="action-preview-title">
        <button className="dialog-close" disabled={isPending} onClick={onCancel} aria-label="取消行动">
          <X />
        </button>
        <span className="eyebrow">
          <AlertTriangle size={14} />
          行动确认
        </span>
        <h2 id="action-preview-title">{heading}</h2>
        <div className="preview-grid">
          <span>
            <small>{targetKindLabel[action.target_kind || 'site'] || '行动目标'}</small>
            <b>{targetName}</b>
          </span>
          {relation && (
            <span>
              <small>证据关系</small>
              <b>{relation}</b>
            </span>
          )}
          {intervention && (
            <span>
              <small>处理方式</small>
              <b>{intervention}</b>
            </span>
          )}
          <span>
            <small>消耗</small>
            <b>{presentation.cost} 行动点</b>
          </span>
          {cardName && (
            <span>
              <small>证据</small>
              <b>{cardName}</b>
            </span>
          )}
        </div>
        <p>{presentation.description}</p>
        {action.requirements?.length ? (
          <div className="action-requirements" aria-label="行动前提">
            <b>行动前提</b>
            <span>{action.requirements.join(' · ')}</span>
          </div>
        ) : null}
        {action.preview_delta && Object.keys(action.preview_delta).length > 0 && (
          <div className="preview-effects">
            <b>预计变化</b>
            <span>{previewDeltaText(action.preview_delta, '状态会在结算后更新')}</span>
          </div>
        )}
        <div className="dialog-actions">
          <button className="ghost-button" disabled={isPending} onClick={onCancel}>
            <X size={15} />
            返回浏览
          </button>
          <Button context="dialog" disabled={isPending} aria-label={`确认行动：${action.confirmation || '执行行动'}`} onClick={onConfirm}>
            <Check size={15} />
            {isPending ? '正在结算…' : action.confirmation || '确认行动'}
          </Button>
        </div>
      </section>
    </DialogBackdrop>
  );
}
