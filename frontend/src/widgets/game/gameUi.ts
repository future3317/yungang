import type { Action, ActionOption, ActionType, GameState } from '../../types/game';

export type ActionMode = Extract<ActionType, 'move' | 'explore' | 'contribute' | 'restore' | 'survey_route' | 'restore_route' | 'establish_connection' | 'exchange' | 'plan'> | null;

export const actionLabels: Partial<Record<ActionType, string>> = {
  move: '移动',
  survey_route: '勘察路线',
  explore: '探索',
  contribute: '贡献',
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
    contribute: '证据已投入委托，节点会按完整条件推进。',
    restore: '节点损伤已降低，可以继续推进当前项目。',
    restore_route: '路线已恢复通行，新的协作路径已经打开。',
    survey_route: '路线状况已记录，可以据此决定修护或绕行。',
    establish_connection: '地点之间已建立稳定连接。',
    use_action_card: '策略牌已结算，地图和资源状态已经更新。',
    end_planning: '规划标记已结算，现在开始本轮行动。',
  };
  return `${copy[action.type] || '行动已记录，世界状态已更新。'}${changes.length ? ` ${changes.join('、')}。` : ''}`;
}
