import type { Action, ActionOption, ActionType, ContentEvent, GameState, Player, ProjectState, RouteState, Site } from '../../types/game';

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
  influence: '共同影响',
  restoration_resource: '修护资源',
  research_clues: '研究线索',
  threat: '风化压力',
  weathering: '风化压力',
  risk: '路线风险',
  restoration: '修护进度',
  supplies: '个人补给',
  cards: '手牌',
  damage: '节点损伤',
  closed_sites: '关闭节点',
  site_influence: '地点影响',
  route_connection_score: '区域连接',
};

export function metricLabel(metric: string) { return previewDeltaLabels[metric] || ({ weathering_track: '风化压力', threat: '风化压力', 威胁: '风化压力', route_status: '路线状态', 路线状态: '路线状态', site_status: '节点状态', 节点状态: '节点状态', 修护资源: '修护资源', 共同修护资源: '修护资源', 路线风险: '路线风险', 节点损伤: '节点损伤', 个人影响: '个人影响' }[metric] || '状态变化'); }

const actionErrorMessages: Record<string, string> = {
  action_card_wrong_timing: '当前时机不能使用这张策略牌。',
  action_card_unavailable: '手中没有这张策略牌。',
  invalid_action_card_target: '请选择一个合法的策略牌目标。',
  no_valid_action_card_target: '当前没有可用的策略牌目标。',
  not_enough_ap: '行动点不足。',
  not_enough_research_clues: '研究线索不足。',
  unsupported_action_card_effect: '这张策略牌暂时无法结算。',
  archive_empty: '档案库暂时没有可取回的线索。',
  archive_retrieve_needs_matching_hand: '手牌中没有可与档案调换的同领域线索。',
  card_not_in_hand: '这张牌已经不在当前手牌中，请重新读取状态。',
  evidence_already_placed: '这件证据已经归入研究台，请选择另一件线索。',
  game_is_over: '这段旅程已经结束，请打开结算记录。',
  game_needs_one_to_four_players: '旅程需要 1 至 4 位同行者才能开始。',
  interpretation_already_formed: '当前解释已经形成，请选择后续干预。',
  interpretation_not_ready: '证据条件尚未满足，请先补齐领域、来源或组合要求。',
  intervention_not_available: '当前还不能进行干预，请先完成解释。',
  invalid_archive_choice: '请选择档案中显示的线索。',
  invalid_connection: '当前两处地点不能建立连接，请选择合法路线。',
  invalid_discard_choice: '请选择手牌中的一件线索放入弃牌堆。',
  invalid_event_choice: '请选择当前事件提供的应对方式。',
  invalid_exchange: '只能与同地点的同行者交换证据。',
  invalid_explore: '当前不能寻访，请确认已抵达节点且有行动点。',
  invalid_interpretation_evidence: '这件证据当前不能归入研究台。',
  invalid_intervention: '请选择当前解释提供的干预方式。',
  invalid_market_choice: '请选择公开市场中仍可取走的线索。',
  invalid_node_ability_target: '当前地点能力不能作用于这个目标。',
  invalid_plan_target: '请选择地图上允许规划的地点、路线或项目。',
  invalid_prepare: '当前没有可准备的事件。',
  invalid_restore: '当前节点不需要修护，或你还未抵达这里。',
  invalid_route: '这条路线当前不可通行，请选择地图上高亮的路线。',
  invalid_route_restoration: '这条路线当前不能修护，请先勘察或选择承压路线。',
  invalid_route_survey: '当前不能勘察这条路线，请选择相邻路线。',
  invalid_upgrade_choice: '请选择当前角色提供的专长。',
  nothing_to_repair: '当前没有需要修护的节点或路线。',
  node_ability_unavailable: '地点能力本轮已经使用，或当前条件尚未满足。',
  not_active_player: '现在轮到另一位同行者，请等待行动交接。',
  not_enough_restoration_resource: '团队修护资源不足，可先交换资源或改做其他行动。',
  planning_limit_reached: '本轮规划名额已用完，请先执行已有规划。',
  planning_not_active: '当前不在团队规划阶段，请继续本轮行动。',
  site_does_not_need_restoration: '这个节点当前不需要修护。',
  skill_unavailable: '角色专长本轮已经使用，或当前行动点不足。',
  unknown_action: '这项行动暂时无法识别，请重新选择地图上的合法行动。',
  upgrade_unavailable: '当前没有可用的角色专长。',
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
    .map(([key, value]) => `${metricLabel(key)} ${Number(value) > 0 ? '+' : ''}${value}`)
    .join(' · ');
  return text || fallback;
}

export function interpretationConfidenceGuidance(confidence = 0) {
  if (confidence <= 2) return '可信度较低：立即处理会增加 1 点风化压力；先记录可获得 3 点研究线索。';
  if (confidence <= 4) return '可信度一般：先记录可以保留研究线索，立即处理不会额外增加风化压力。';
  return '可信度较高：证据互相印证更充分，可以更安心地立即处理。';
}

export function eventDecisionBrief(event?: Partial<Pick<ContentEvent, 'forecast_text' | 'description' | 'mitigation_hint'>>) {
  return {
    whatHappens: event?.forecast_text || event?.description || '回合结束时，事件会按照当前影响范围结算。',
    ifIgnored: event?.description || '如果不回应，事件会按预告中的风险结算。',
    whatYouCanDo: event?.mitigation_hint || '从下方应对选项中选择一种处理方式。',
  };
}

export function localizeActionText(value?: string) {
  return (value || '').replace(/\s+/g, ' ').trim()
    .replace(/\btwo_open_sites\b/gi, '两处仍可守护的节点')
    .replace(/\ball_players\b/gi, '所有同行者')
    .replace(/\bshared_resource\b/gi, '团队修护资源')
    .replace(/\btarget_site\b/gi, '目标地点')
    .replace(/\btarget_route\b/gi, '目标路线')
    .replace(/\bafter_arrival\b/gi, '抵达后')
    .replace(/\bround_end\b/gi, '回合结束时')
    .replace(/\bplayer_action\b/gi, '玩家行动阶段')
    .replace(/\broute_risk\b/gi, '路线风险')
    .replace(/\bweathering_track\b/gi, '风化压力')
    .replace(/\bthreat_delta\b/gi, '风化压力变化')
    .replace(/\brisk_delta\b/gi, '路线风险变化')
    .replace(/\brestore_discount\b/gi, '修护费用减免')
    .replace(/\bexchange_discount\b/gi, '交换费用减免')
    .replace(/\bfree_exchange\b/gi, '本次交换免费')
    .replace(/\barchive_inspect\b/gi, '查看档案牌')
    .replace(/\b(open|blocked|strained|restored|illuminated)\b/gi, match => ({ open: '通行', blocked: '阻断', strained: '承压', restored: '已修护', illuminated: '已点亮' }[match.toLowerCase()] || match))
    .replace(/Use Action Card/gi, '使用策略牌')
    .replace(/\bRoute:\s*/gi, '路线：')
    .replace(/\bProject:\s*/gi, '项目：')
    .replace(/use_action_card/gi, '使用策略牌');
}

export function resolveTargetName(target: string | undefined, sites: Record<string, Site>, routes: Record<string, RouteState> = {}, projects: Record<string, ProjectState> = {}, players: Record<string, Player> = {}) {
  if (!target) return '当前地点';
  return routes[target]?.name || sites[target]?.name || projects[target]?.name || players[target]?.name || '未知目标';
}

export function localizeTimelineMessage(message: string, context: { sites: Record<string, Site>; routes: Record<string, RouteState>; projects: Record<string, ProjectState>; players?: Record<string, Player> }) {
  return localizeActionText(message).replace(/\s*[（(]目标[：:]\s*([^）)]+)[）)]/g, (_, target: string) => `（目标：${resolveTargetName(target.trim(), context.sites, context.routes, context.projects, context.players)}）`);
}

export function localizeActionError(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown } | null;
  const code = typeof candidate?.code === 'string' ? candidate.code : '';
  if (code && actionErrorMessages[code]) return actionErrorMessages[code];
  const message = typeof candidate?.message === 'string' ? candidate.message : '';
  const embeddedCode = Object.keys(actionErrorMessages).find(key => message.includes(key));
  if (embeddedCode) return actionErrorMessages[embeddedCode];
  if (/network|failed to fetch|fetch|timeout|offline|连接|网络/i.test(message)) return '网络暂时中断，状态未确定。请先重新连接，再继续选择行动。';
  return actionErrorMessages[message] || localizeActionText(message) || '行动暂时无法完成，请重新选择。';
}

export function findCardAction(actions: Action[], type: ActionType, cardId: string) {
  return actions.find(action => action.type === type && action.card_id === cardId);
}

export function actionModeLabel(mode: ActionMode) {
  return mode ? actionLabels[mode] || '当前行动' : '';
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
    requirements: option.requirements,
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
  delta('风化压力', before?.shared.weathering_track ?? before?.shared.threat, after.shared.weathering_track ?? after.shared.threat);
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
