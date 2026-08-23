import { Compass, HandHeart, MapPinned, Target, X } from 'lucide-react';
import type {
  Action,
  ActionType,
  ContentCard,
  Meta,
  Player,
  RouteState,
  Site,
  SiteReference,
  Task,
} from '../../types/game';
import { contentTagName, domainName } from './contentLabels';
import { actionLabels } from './gameUi';
import { resolveActionTargetName } from './ActionPreview';

export function JourneyGuide({
  task,
  cards,
  active,
  legal,
  meta,
  actionMode,
  onChoose,
}: {
  task?: Task;
  cards: Record<string, ContentCard>;
  active: Player;
  legal: Action[];
  meta: Meta;
  actionMode: ActionType | null;
  onChoose: (type: ActionType) => void;
}) {
  const interpretation = task?.progress?.interpretation;
  const requiredDomains = task?.required_domains ?? [];
  const matchingHand = active.hand.filter((id) => requiredDomains.includes(cards[id]?.domain || '')).length;
  const canInterpret = legal.some((action) => action.type === 'interpret_evidence');
  const canExplore = legal.some((action) => action.type === 'explore');
  const nextRequirement = task?.progress?.requirements?.find((item) => !item.complete);
  const nextStep = nextRequirement
    ? typeof nextRequirement.current === 'number' && typeof nextRequirement.target === 'number'
      ? `${nextRequirement.label}还差 ${Math.max(0, nextRequirement.target - nextRequirement.current)}。`
      : `${nextRequirement.label}尚未满足。`
    : canInterpret
      ? '手中已有可归类证据，下一步可在研究台判断它们的关系。'
      : canExplore
        ? '下一步从公开市场选择一张与当前任务相关的证据。'
        : '先沿可通行路线抵达需要处理的地点。';
  return (
    <section className="journey-guide" aria-label="行动指引">
      <div className="section-label">
        <Target size={14} />
        旅途中的下一步
      </div>
      {actionMode ? (
        <p>正在选择{actionLabels[actionMode] || '当前行动'}的合法目标。确认前会显示行动点消耗和预计变化。</p>
      ) : task ? (
        <>
          <h3>{task.name}</h3>
          <p><b>下一步：</b>{nextStep}</p>
          <ul>
            <li>
              <b>
                {interpretation?.cards ?? 0} / {interpretation?.cards_target ?? task.required_card_count}
              </b>{' '}
              件有效证据
            </li>
            <li>{requiredDomains.map((domain) => domainName(meta, domain)).join('、')}</li>
            <li>需来自 {task.required_origin_diversity} 种来源</li>
            {task.combo_requirement?.required_combo_tags?.length ? (
              <li>
                关键互证：
                {task.combo_requirement.required_combo_tags.map((tag) => contentTagName(tag, meta)).join('、')}
              </li>
            ) : null}
          </ul>
          <div className="guide-actions">
            {canInterpret ? (
              <button type="button" onClick={() => onChoose('interpret_evidence')}>
                <HandHeart size={15} />
                在研究台判断证据 {matchingHand ? `(${matchingHand})` : ''}
              </button>
            ) : null}
            {canExplore ? (
              <button type="button" onClick={() => onChoose('explore')}>
                <Compass size={15} />
                寻访证据
              </button>
            ) : (
              <button type="button" onClick={() => onChoose('move')}>
                <MapPinned size={15} />
                沿路线前往节点
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <h3>追随下一条线索</h3>
          <p>沿着显影的路线前往节点，在公开市场寻访证据卡；当不同来处的见证相遇，新的联系便会出现。</p>
          <div className="guide-actions">
            <button type="button" onClick={() => onChoose('move')}>
              <MapPinned size={15} />
              踏上显影路线
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export function ActionTargetGuide({
  mode,
  actions,
  sites,
  routes,
  cards,
  onRun,
  onCancel,
}: {
  mode: ActionType | null;
  actions: Action[];
  sites: Record<string, SiteReference>;
  routes?: Record<string, RouteState>;
  cards: Record<string, ContentCard>;
  onRun: (action: Action) => void;
  onCancel: () => void;
}) {
  if (!mode) return null;
  const presentation: Partial<Record<ActionType, { title: string; description: string }>> = {
    move: { title: '选择要前往的地点', description: '选择一处可达地点，确认后消耗行动点前往。' },
    explore: { title: '从市场中取一件证据卡', description: '公开文化市场已经打开，选择一张证据卡带回研究台。' },
    interpret_evidence: { title: '在研究台判断证据关系', description: '选择一张手中证据，判断它与当前任务是支持、冲突还是待确认。' },
    restore: { title: '选择要修护的节点', description: '选择一处承压节点，确认后消耗行动点和修护资源。' },
    restore_route: { title: '选择要修护的路线', description: '选择一条受损路线，确认后降低路线风险。' },
    survey_route: { title: '选择要勘察的路线', description: '选择一条路线，确认后揭示或改善它的通行状况。' },
    establish_connection: { title: '选择要建立连接的路线', description: '选择一条符合条件的路线，确认后推进遗产网络连接。' },
  };
  const guide = presentation[mode] || {
    title: actionLabels[mode] || '选择行动目标',
    description: '请选择一个合法目标，确认后将显示这次行动的实际变化。',
  };
  const name = (action: Action) =>
    action.card_id ? cards[action.card_id]?.name || '已选证据' : resolveActionTargetName(action, sites, routes);
  return (
    <section className="action-target-guide" role="status" aria-live="polite">
      <div>
        <span>{guide.title}</span>
        <button type="button" className="action-target-guide-close" onClick={onCancel} aria-label="取消目标选择">
          <X size={15} />
          <span>取消选择</span>
        </button>
      </div>
      <p>
        {guide.description}
      </p>
      <div>
        {actions.map((action, index) => (
          <button
            type="button"
            key={`${action.type}-${action.card_id || action.target_id || index}`}
            onClick={() => onRun(action)}
          >
            <b>{name(action)}</b>
            <small>
              {action.cost || 0} 行动点 · {actionLabels[action.type] || action.label || '当前行动'}
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}
