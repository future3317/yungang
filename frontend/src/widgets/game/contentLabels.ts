import type { Meta } from '../../types/game';

type TextEntry = string | { name?: string; short_name?: string };

export function displayText(meta: Meta | undefined, namespace: string, id: string | undefined, fallback = '未标注') {
  if (!id) return fallback;
  const section = (meta?.terminology as Record<string, unknown> | undefined)?.[namespace];
  const entry =
    section && typeof section === 'object'
      ? ((section as Record<string, unknown>)[id] as TextEntry | undefined)
      : undefined;
  if (typeof entry === 'string' && entry.trim()) return entry;
  if (entry && typeof entry === 'object') return entry.short_name || entry.name || fallback;
  return fallback;
}

export function errorText(
  meta: Meta | undefined,
  code: string | undefined,
  fallback = '操作暂时无法完成，请重新选择。'
) {
  if (!code) return fallback;
  const terminology = meta?.terminology as Record<string, unknown> | undefined;
  const catalog = terminology?.errors;
  const entry = catalog && typeof catalog === 'object' ? (catalog as Record<string, unknown>)[code] : undefined;
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object' && 'message' in entry && typeof entry.message === 'string')
    return entry.message;
  return fallback;
}

export function domainName(meta: Meta, id: string) {
  return displayText(meta, 'domains', id, '未标注领域');
}

export function contentTagName(tag: string, meta?: Meta) {
  return displayText(meta, 'combo_tags', tag, '未标注组合');
}
