import type { ContentCard, Meta, Task } from '../../types/game';
import { contentTagName, displayText, domainName } from './contentLabels';

export type CardRecord = Record<string, unknown>;
export { contentTagName, domainName } from './contentLabels';

export function originName(value?: string, meta?: Meta) {
  return displayText(meta, 'origins', value, '未标注线索脉络');
}

export function formatRequirementValues(meta: Meta, key: string, values: string[]) {
  return values
    .map((value) => {
      if (meta.domain_meta?.[value]) return domainName(meta, value);
      if (key.includes('origin')) return originName(value, meta);
      return contentTagName(value, meta);
    })
    .join('、');
}

export function formatProjectRequirements(meta: Meta, requirements: Record<string, unknown>) {
  const labels: Record<string, string> = {
    domains: '领域',
    required_domains: '领域',
    origins: '线索脉络',
    required_origins: '线索脉络',
    origin_diversity: '线索脉络数',
    action_type: '行动',
    tags: '标签',
    cards: '证据',
    contributors: '参与者',
    restore_actions: '修护行动',
    restoration_resource: '修护资源',
    clues: '线索',
    influence: '共同影响',
    market_reserve: '市场储备',
    archive_retrieve: '档案回收',
    finale_unlock: '终局解锁',
  };
  const entries = Object.entries(requirements || {}).filter(([, value]) => hasMeaningfulProjectValue(value));
  return entries.map(([key, value]) => (labels[key] || key) + '：' + formatProjectValue(meta, key, value)).join(' · ');
}
export function formatProjectReward(reward?: Record<string, unknown>) {
  const labels: Record<string, string> = {
    shared_impact: '共同影响',
    research_points: '研究点',
    research_clues: '研究点',
    restoration_resource: '修护资源',
    route_connection: '路线连接',
    connection_level: '路线连接',
    weathering: '风化压力',
    reputation: '个人声望',
    free_move: '免费移动',
    card_draw: '抽牌',
    influence: '共同影响',
    weathering_reduction: '风化压力降低',
    market_reserve: '市场储备',
    archive_retrieve: '档案回收',
    finale_unlock: '终局解锁',
  };
  const entries = Object.entries(reward || {}).filter(([, value]) => hasMeaningfulProjectValue(value));
  if (!entries.length) return '暂无额外奖励';
  return entries.map(([key, value]) => {
    const label = labels[key] || key;
    if (typeof value === 'number') return label + ' ' + (value > 0 ? '+' : '') + value;
    if (typeof value === 'boolean') return value ? label : '';
    return label + ' ' + formatProjectValue(undefined, key, value);
  }).filter(Boolean).join(' · ');
}

function hasMeaningfulProjectValue(value: unknown) {
  if (value === null || value === undefined || value === false || value === 0 || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).some(hasMeaningfulProjectValue);
  return true;
}

function formatProjectValue(meta: Meta | undefined, key: string, value: unknown) {
  if (key === 'origin_diversity' && typeof value === 'number') return '至少 ' + value + ' 种';
  if (key === 'action_type' && value === 'interpret_evidence') return '研判证据';
  if (Array.isArray(value)) {
    return value.map(item => key.includes('domain') && meta ? domainName(meta, String(item)) : String(item)).join('、');
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record.current === 'number' && typeof record.target === 'number') return String(record.current) + ' / ' + String(record.target);
    return Object.entries(record).filter(([, item]) => hasMeaningfulProjectValue(item)).map(([name, item]) => name + ' ' + String(item)).join(' · ');
  }
  return String(value);
}
export function statusName(status?: string) {
  const labels: Record<string, string> = {
    stable: '稳定',
    normal: '稳定',
    open: '开放',
    at_risk: '有风险',
    blocked: '受阻',
    strained: '紧张',
    restored: '已修护',
    illuminated: '已点亮',
    closed: '已关闭',
  };
  return labels[status || ''] || '未知状态';
}

export function siteTypeName(type?: string) {
  const labels: Record<string, string> = {
    heritage: '遗产节点',
    gameplay: '协作节点',
    workshop: '协作节点',
    event: '事件节点',
    route: '路线节点',
  };
  return labels[type || ''] || '未知节点';
}

export function contentClassName(value?: string) {
  return (
    (
      {
        documented: '遗产实景',
        interpretive: '研究性解读',
        gameplay: '协作场景',
      } as Record<string, string>
    )[value || ''] || '未知内容分类'
  );
}

export function eventTypeName(type?: string) {
  const labels: Record<string, string> = {
    weathering: '风化压力',
    route: '路线变化',
    exchange: '交流变化',
    research: '研究点',
  };
  return labels[type || ''] || '区域事件';
}

export function eventTargetRuleName(rule?: string, meta?: Meta) {
  return displayText(meta, 'event_target_rules', rule, '由本局旅程决定的影响范围');
}

function cardRecord(card?: ContentCard): CardRecord {
  return (card || {}) as unknown as CardRecord;
}

export function textField(card: ContentCard | undefined, ...keys: string[]) {
  const record = cardRecord(card);
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

export function recordText(value: unknown, ...keys: string[]) {
  const record = (value || {}) as CardRecord;
  for (const key of keys) {
    const item = record[key];
    if (typeof item === 'string' && item.trim()) return item;
  }
  return '';
}

export function marketReason(card: ContentCard | undefined, task?: Task, useful = false, meta?: Meta) {
  const domain = card?.domain;
  const label = domain ? (meta ? domainName(meta, domain) : domain) : '';
  if (useful && domain) return `回应此处地点任务的「${label}」证据卡，适合优先归类。`;
  if (task?.required_origin_diversity && task.required_origin_diversity > 1)
    return '来自另一条脉络，可补足这段故事的互证。';
  return domain ? `属于「${label}」证据卡，也许会在后续节点显出意义。` : '先收进手中，等待合适的节点召唤它。';
}

export function marketOutcome(card: ContentCard | undefined) {
  const instant = textField(card, 'instant_use_text', 'combo_reward_text');
  return instant ? `收入手中；${instant}` : '收入手中；之后可归入地点任务，或在合适时机使用。';
}
