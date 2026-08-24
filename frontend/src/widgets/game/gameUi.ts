import type {
  Action,
  ActionOption,
  ActionType,
  ContentEvent,
  FeedbackChange,
  GameState,
  Meta,
  Player,
  ProjectState,
  RouteState,
  Site,
  SiteReference,
} from '../../types/game';
import { errorText } from './contentLabels';

export function actionTimingLabel(timing?: string) {
  return ({
    player_action: '行动阶段',
    event_forecast: '事件预告阶段',
    event_response: '事件响应阶段',
    any_action: '任意行动阶段',
  } as Record<string, string>)[timing || ''] || timing || '当前行动阶段';
}

export type ActionMode = Extract<
  ActionType,
  | 'move'
  | 'explore'
  | 'interpret_evidence'
  | 'restore'
  | 'survey_route'
  | 'restore_route'
  | 'establish_connection'
  | 'exchange'
  | 'plan'
> | null;
export const actionLabels: Partial<Record<ActionType, string>> = {
  move: '移动',
  survey_route: '勘察路线',
  explore: '寻访证据',
  interpret_evidence: '研判证据',
  form_interpretation: '完成研判',
  choose_intervention: '选择处理方式',
  restore: '修护节点',
  restore_route: '修护路线',
  establish_connection: '建立连接',
  exchange: '交换证据',
  prepare: '准备',
  use_action_card: '使用策略牌',
  use_node_ability: '地点能力',
  use_upgrade: '角色专长',
  use_skill: '技能',
  end_planning: '开始行动',
  end_turn: '结束回合',
  plan: '规划',
};

const previewDeltaLabels: Record<string, string> = {
  ap: '行动点',
  influence: '共同影响',
  restoration_resource: '修护资源',
  research_clues: '研究点',
  weathering: '风化压力',
  risk: '路线风险',
  restoration: '修护进度',
  supplies: '个人补给',
  cards: '证据卡',
  damage: '节点损伤',
  closed_sites: '关闭节点',
  site_influence: '地点影响',
  route_connection_score: '区域连接',
};

export function metricLabel(metric: string) {
  return (
    previewDeltaLabels[metric] ||
    {
      weathering_track: '风化压力',
      route_status: '路线状态',
      risk: '路线风险',
      site_status: '节点状态',
      site_damage: '节点损伤',
      site_influence: '地点影响',
    }[metric] ||
    '状态变化'
  );
}

export function feedbackChangeText(changes: FeedbackChange[]) {
  const seen = new Set<string>();
  return changes
    .filter((change) => {
      const key =
        change.metric === 'weathering' || change.metric === 'weathering_track'
          ? 'weathering'
          : change.metric || change.label || '状态变化';
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((change) => {
      const label = change.label || metricLabel(change.metric || '');
      if (change.before !== undefined && change.before !== null && change.after !== undefined && change.after !== null)
        return `${label} ${change.before}→${change.after}`;
      return `${label} ${change.delta && change.delta > 0 ? '+' : ''}${change.delta ?? ''}`;
    });
}

const roleBadgeAssets: Record<string, string> = {
  pingcheng_artisan: 'role-badge-artisan.webp',
  western_dancer: 'role-badge-dancer.webp',
  grassland_rider: 'role-badge-rider.webp',
  central_scribe: 'role-badge-scribe.webp',
};

export function previewDeltaText(delta: Record<string, unknown> | undefined, fallback: string) {
  const text = Object.entries(delta || {})
    .filter(([, value]) => typeof value === 'number')
    .map(([key, value]) => `${metricLabel(key)} ${Number(value) > 0 ? '+' : ''}${value}`)
    .join(' · ');
  return text || fallback;
}

export function actionPresentation(
  action: Pick<Action, 'type' | 'label' | 'description' | 'cost'> | Pick<ActionOption, 'type' | 'label' | 'description' | 'cost'>
) {
  const rawCost = action.cost;
  const cost = typeof rawCost === 'number' ? rawCost : rawCost?.ap || 0;
  return {
    label: action.label || actionLabels[action.type] || '确认行动',
    description: action.description || '确认后将立即结算这次行动，并更新地图上的路线、资源或地点状态。',
    cost,
  };
}

export function interpretationConfidenceGuidance(confidence = 0) {
  if (confidence <= 2) return '可信度较低：立即处理会增加 1 点风化压力；先记录可获得 3 点研究点。';
  if (confidence <= 4) return '可信度一般：先记录可以保留研究点，立即处理不会额外增加风化压力。';
  return '可信度较高：证据互相印证更充分，可以更安心地立即处理。';
}

export function eventDecisionBrief(
  event?: Partial<Pick<ContentEvent, 'forecast_text' | 'description' | 'mitigation_hint'>>
) {
  return {
    whatHappens: event?.forecast_text || event?.description || '回合结束时，事件会按照当前影响范围结算。',
    ifIgnored: event?.description || '如果不回应，事件会按预告中的风险结算。',
    whatYouCanDo: event?.mitigation_hint || '从下方应对选项中选择一种处理方式。',
  };
}

export function resolveTargetName(
  target: string | undefined,
  sites: Record<string, SiteReference>,
  routes: Record<string, RouteState> = {},
  projects: Record<string, ProjectState> = {},
  players: Record<string, Player> = {}
) {
  if (!target) return '当前地点';
  return routes[target]?.name || sites[target]?.name || projects[target]?.name || players[target]?.name || '未知目标';
}

export function formatTimelineEntry(
  entry: { message: string; target?: { kind?: string; id?: string; label?: string } | null },
  context: {
    sites: Record<string, SiteReference>;
    routes: Record<string, RouteState>;
    projects: Record<string, ProjectState>;
    players?: Record<string, Player>;
  }
) {
  if (!entry.target?.id) return entry.message;
  const label = entry.target.label || resolveTargetName(entry.target.id, context.sites, context.routes, context.projects, context.players);
  return `${entry.message}（目标：${label}）`;
}

export function localizeActionError(error: unknown, meta?: Meta) {
  const candidate = error as { code?: unknown; message?: unknown } | null;
  const code = typeof candidate?.code === 'string' ? candidate.code : '';
  if (code) {
    const catalogMessage = errorText(meta, code, '');
    if (catalogMessage) return catalogMessage;
  }
  const message = typeof candidate?.message === 'string' ? candidate.message : '';
  if (code) return '操作暂时无法完成，请根据提示调整后重试。';
  if (/network|failed to fetch|fetch|timeout|offline|连接|网络/i.test(message))
    return '网络暂时中断，状态未确定。请先重新连接，再继续选择行动。';
  return message || '操作暂时无法完成，请重新选择。';
}

export function findCardAction(actions: Action[], type: ActionType, cardId: string) {
  return actions.find((action) => action.type === type && action.card_id === cardId);
}

export function actionModeLabel(mode: ActionMode) {
  return mode ? actionLabels[mode] || '当前行动' : '';
}

export function roleBadgeAsset(roleId: string | undefined, fallback?: string) {
  return roleBadgeAssets[roleId || '']
    ? `ornaments/${roleBadgeAssets[roleId || '']}`
    : fallback || 'icon_role_scribe.webp';
}

export function optionAction(option: ActionOption, target?: ActionOption['targets'][number]): Action {
  const payload = { ...(option.payload || {}), ...(target?.payload || {}) };
  const targetKind = option.type.includes('route') || option.type === 'survey_route' || option.type === 'establish_connection' ? 'route' : option.type === 'exchange' ? 'player' : option.type === 'use_action_card' || option.type === 'explore' ? 'card' : option.type === 'plan' ? 'project' : target ? 'site' : 'current';
  return {
    ...payload,
    type: option.type,
    label: target?.label || option.label,
    description: option.description,
    cost: option.cost?.ap,
    preview_delta: target?.preview_delta || option.preview_delta,
    requirements: option.requirements,
    confirmation: option.confirmation,
    target_kind: targetKind,
    target_label: target?.label || option.label,
  } as Action;
}

export function actionFeedback(action: Action, before: GameState | undefined, after: GameState) {
  const actorId = before?.shared.active_player_id || after.shared.active_player_id;
  const previousPlayer = actorId ? before?.players[actorId] : undefined;
  const nextPlayer = actorId ? after.players[actorId] : undefined;
  const changes: string[] = [];
  const delta = (label: string, previous?: number, next?: number) => {
    if (typeof previous === 'number' && typeof next === 'number' && previous !== next)
      changes.push(`${label} ${next - previous > 0 ? '+' : ''}${next - previous}`);
  };
  delta('行动点', previousPlayer?.ap, nextPlayer?.ap);
  delta('研究点', before?.shared.research_clues, after.shared.research_clues);
  delta('修护资源', before?.shared.restoration_resource, after.shared.restoration_resource);
  delta(
    '风化压力',
    before?.shared.weathering_track,
    after.shared.weathering_track
  );
  delta('共同影响', before?.shared.influence, after.shared.influence);
  const copy: Partial<Record<ActionType, string>> = {
    move: '已抵达新地点。新的线索与风险已经显影。',
    explore: '已取得证据卡，可用于当前地点的互证。',
    interpret_evidence: '证据卡已归入研究台；它的关系会影响解释的可信度与后续风险。',
    form_interpretation: '当前研判已完成。现在需要决定如何在不确定中行动。',
    choose_intervention: '处理方式已写入遗产网络，团队项目、风险与档案将随之改变。',
    restore: '节点损伤已降低，可以继续推进当前团队项目。',
    restore_route: '路线已恢复通行，新的协作路径已经打开。',
    survey_route: '路线状况已记录，可以据此决定修护或绕行。',
    establish_connection: '地点之间已建立稳定连接。',
    use_action_card: '策略牌已结算，地图、资源和旅程记录已经更新。',
    end_planning: '规划标记已结算，现在开始本轮行动。',
  };
  return `${copy[action.type] || '行动已记录，世界状态已更新。'}${changes.length ? ` ${changes.join('、')}。` : ''}`;
}
