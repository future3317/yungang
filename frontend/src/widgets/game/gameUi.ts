import type { Action, ActionOption, ActionType, GameState, Player, ProjectState, RouteState, Site } from '../../types/game';

export type ActionMode = Extract<ActionType, 'move' | 'explore' | 'interpret_evidence' | 'restore' | 'survey_route' | 'restore_route' | 'establish_connection' | 'exchange' | 'plan'> | null;

export const actionLabels: Partial<Record<ActionType, string>> = {
  move: '移动',
  survey_route: '勘察路线',
  explore: '探索',
  interpret_evidence: '研判证据',
  form_interpretation: '形成解释',
  choose_intervention: '选择干预',
  restore: '修护节点',
  restore_route: '修护路线',
  establish_connection: '建立连接',
  exchange: '交换',
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
  influence: '个人影响',
  restoration_resource: '修护资源',
  research_clues: '研究线索',
  threat: '风化压力',
  risk: '路线风险',
  restoration: '修护进度',
};

const actionErrorMessages: Record<string, string> = {
  action_card_wrong_timing: '当前时机不能使用这张策略牌。',
  action_card_unavailable: '手中没有这张策略牌。',
  invalid_action_card_target: '请选择一个合法的策略牌目标。',
  no_valid_action_card_target: '当前没有可用的策略牌目标。',
  not_enough_ap: '行动点不足。',
  not_enough_research_clues: '研究线索不足。',
  unsupported_action_card_effect: '这张策略牌暂时无法结算。',
};

const roleBadgeAssets: Record<string, string> = {
  pingcheng_artisan: 'role-badge-artisan.png',
  western_dancer: 'role-badge-dancer.png',
  grassland_rider: 'role-badge-rider.png',
  central_scribe: 'role-badge-scribe.png',
};

export function previewDeltaText(delta: Record<string, unknown> | undefined, fallback: string) {
  const text = Object.entries(delta || {})
    .filter(([, value]) => typeof value === 'number')
    .map(([key, value]) => `${previewDeltaLabels[key] || '状态变化'} ${Number(value) > 0 ? '+' : ''}${value}`)
    .join(' · ');
  return text || fallback;
}

export function localizeActionText(value?: string) {
  return (value || '').replace(/\s+/g, ' ').trim()
    .replace(/\b(open|blocked|strained|restored|illuminated)\b/gi, match => ({ open: '通行', blocked: '阻断', strained: '承压', restored: '已修护', illuminated: '已点亮' }[match.toLowerCase()] || match))
    .replace(/Use Action Card/gi, '使用策略牌')
    .replace(/\bRoute:\s*/gi, '路线：')
    .replace(/\bProject:\s*/gi, '项目：')
    .replace(/use_action_card/gi, '使用策略牌');
}

export function resolveTargetName(target: string | undefined, sites: Record<string, Site>, routes: Record<string, RouteState> = {}, projects: Record<string, ProjectState> = {}, players: Record<string, Player> = {}) {
  if (!target) return '当前地点';
  return routes[target]?.name || sites[target]?.name || projects[target]?.name || players[target]?.name || localizeActionText(target);
}

export function localizeTimelineMessage(message: string, context: { sites: Record<string, Site>; routes: Record<string, RouteState>; projects: Record<string, ProjectState>; players?: Record<string, Player> }) {
  return localizeActionText(message).replace(/（目标：([^）]+)）/g, (_, target: string) => `（目标：${resolveTargetName(target, context.sites, context.routes, context.projects, context.players)}）`);
}

export function localizeActionError(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown } | null;
  const code = typeof candidate?.code === 'string' ? candidate.code : '';
  if (code && actionErrorMessages[code]) return actionErrorMessages[code];
  const message = typeof candidate?.message === 'string' ? candidate.message : '';
  const embeddedCode = Object.keys(actionErrorMessages).find(key => message.includes(key));
  if (embeddedCode) return actionErrorMessages[embeddedCode];
  return actionErrorMessages[message] || localizeActionText(message) || '行动暂时无法完成，请重新选择。';
}

export function findCardAction(actions: Action[], type: ActionType, cardId: string) {
  return actions.find(action => action.type === type && action.card_id === cardId);
}

export function actionModeLabel(mode: ActionMode) {
  return mode ? actionLabels[mode] || mode : '';
}

export function roleBadgeAsset(roleId: string | undefined, fallback?: string) {
  return roleBadgeAssets[roleId || ''] ? `ornaments/${roleBadgeAssets[roleId || '']}` : fallback || 'icon_role_scribe.png';
}

export function optionAction(option: ActionOption, target?: ActionOption['targets'][number]): Action {
  const payload = { ...(option.payload || {}), ...(target?.payload || {}) };
  return {
    ...payload,
    type: option.type,
    label: target?.label || option.label,
    description: option.description,
    cost: option.cost?.ap,
    preview_delta: target?.preview_delta || option.preview_delta,
  } as Action;
}

export function actionFeedback(action: Action, before: GameState | undefined, after: GameState) {
  const actorId = before?.shared.active_player_id || after.shared.active_player_id;
  const previousPlayer = actorId ? before?.players[actorId] : undefined;
  const nextPlayer = actorId ? after.players[actorId] : undefined;
  const changes: string[] = [];
  const delta = (label: string, previous?: number, next?: number) => {
    if (typeof previous === 'number' && typeof next === 'number' && previous !== next) changes.push(`${label} ${next - previous > 0 ? '+' : ''}${next - previous}`);
  };
  delta('AP', previousPlayer?.ap, nextPlayer?.ap);
  delta('研究线索', before?.shared.research_clues, after.shared.research_clues);
  delta('修护资源', before?.shared.restoration_resource, after.shared.restoration_resource);
  delta('威胁', before?.shared.threat, after.shared.threat);
  delta('共同影响', before?.shared.influence, after.shared.influence);
  const copy: Partial<Record<ActionType, string>> = {
    move: '已抵达新地点。新的线索与风险已经显影。',
    explore: '文化证据已进入手牌，可用于当前地点的互证。',
    interpret_evidence: '证据已归入研究台；它的关系会影响解释的可信度与后续风险。',
    form_interpretation: '当前解释已形成。现在需要决定如何在不确定中行动。',
    choose_intervention: '干预已写入遗产网络，项目、风险与档案将随之改变。',
    restore: '节点损伤已降低，可以继续推进当前项目。',
    restore_route: '路线已恢复通行，新的协作路径已经打开。',
    survey_route: '路线状况已记录，可以据此决定修护或绕行。',
    establish_connection: '地点之间已建立稳定连接。',
    use_action_card: '策略牌已结算，地图、资源和旅程记录已经更新。',
    end_planning: '规划标记已结算，现在开始本轮行动。',
  };
  return `${copy[action.type] || '行动已记录，世界状态已更新。'}${changes.length ? ` ${changes.join('、')}。` : ''}`;
}
