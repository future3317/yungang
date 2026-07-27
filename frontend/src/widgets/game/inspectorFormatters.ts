import type { ContentCard, Meta, Task } from '../../types/game';
import { comboNames, domainName } from './contentLabels';

export type CardRecord = Record<string, unknown>;
export { comboNames, domainName } from './contentLabels';

const originNames: Record<string, string> = {
  central: '中原',
  western: '西域',
  frontier: '边地',
  craft: '工坊',
  silk: '丝路',
};

const requirementNames: Record<string, string> = {
  cross_origin: '跨来源互证',
  image_reconstruction: '图像重构',
  material_diagnosis: '材料诊断',
  craft_coordination: '工序协同',
  route_governance: '路线治理',
  archive_context: '档案互证',
};

export function formatRequirementValues(meta: Meta, key: string, values: string[]) {
  return values.map(value => {
    if (meta.domain_meta?.[value]) return domainName(meta, value);
    if (key.includes('origin')) return originNames[value] || '未标注来源';
    return requirementNames[value] || comboNames[value] || '未标注条件';
  }).join('、');
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
  return labels[status || ''] || '稳定';
}

export function siteTypeName(type?: string) {
  const labels: Record<string, string> = {
    heritage: '遗产节点',
    workshop: '协作节点',
    event: '事件节点',
    route: '路线节点',
  };
  return labels[type || ''] || '遗产节点';
}

export function contentClassName(value?: string) {
  return ({
    documented: '真实遗产信息',
    interpretive: '研究性解释节点',
    gameplay: '游戏化功能节点',
  } as Record<string, string>)[value || ''] || '遗产节点';
}

export function eventTypeName(type?: string) {
  const labels: Record<string, string> = {
    weathering: '风化压力',
    route: '路线变化',
    exchange: '交流变化',
    research: '研究线索',
  };
  return labels[type || ''] || '区域事件';
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

export function marketReason(card: ContentCard | undefined, task?: Task, useful = false) {
  const domain = card?.domain;
  if (useful && domain) return `回应此处委托的「${domain}」线索，适合优先交付。`;
  if (task?.required_origin_diversity && task.required_origin_diversity > 1) return '来自另一条脉络，可补足这段故事的互证。';
  return domain ? `属于「${domain}」线索，也许会在后续节点显出意义。` : '先收进手中，等待合适的节点召唤它。';
}

export function marketOutcome(card: ContentCard | undefined) {
  const instant = textField(card, 'instant_use_text', 'combo_reward_text');
  return instant ? `收入手中；${instant}` : '收入手中；之后可交付给委托，或在合适时机使用。';
}
