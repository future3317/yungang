import type { Meta } from '../../types/game';

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
  return meta.domain_meta?.[id]?.short_name || domainLabels[id] || '未标注领域';
}

export function contentTagName(tag: string) {
  return comboNames[tag] || domainLabels[tag] || '未标注组合';
}
