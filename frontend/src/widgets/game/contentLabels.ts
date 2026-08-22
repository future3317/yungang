import type { Meta } from '../../types/game';

type TextEntry = string | { name?: string; short_name?: string };

export function displayText(meta: Meta | undefined, namespace: string, id: string | undefined, fallback = '未标注') {
  if (!id) return fallback;
  const section = meta?.terminology?.[namespace];
  const entry = section && typeof section === 'object' ? (section as Record<string, unknown>)[id] as TextEntry | undefined : undefined;
  if (typeof entry === 'string' && entry.trim()) return entry;
  if (entry && typeof entry === 'object') return entry.short_name || entry.name || fallback;
  return fallback;
}

const domainLabels: Record<string, string> = {
  architecture: '建筑',
  statue: '造像',
  pattern: '纹样',
  frontier: '边地',
  trade: '交流',
  archive: '档案',
  material: '材料',
  religion: '信仰',
};

export const comboNames: Record<string, string> = {
  archive_context: '档案互证',
  craft_coordination: '工序协同',
  cross_origin: '跨来源互证',
  image_reconstruction: '图像重构',
  material_diagnosis: '材料诊断',
  route_governance: '路线治理',
};

export function domainName(meta: Meta, id: string) {
  return displayText(meta, 'domains', id, meta.domain_meta?.[id]?.short_name || domainLabels[id] || '未标注领域');
}

export function contentTagName(tag: string, meta?: Meta) {
  return displayText(meta, 'combo_tags', tag, comboNames[tag] || domainLabels[tag] || '未标注组合');
}
