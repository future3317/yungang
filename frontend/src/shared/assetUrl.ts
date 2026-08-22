const generatedPrefixes = ['icon_', 'scene_', 'card_', 'ui_', 'effect_'];

export function assetUrl(asset: string | undefined, fallback = 'generated/icon_card_scroll.webp') {
  const value = asset?.trim();
  if (!value) return `/ui-assets/${fallback}`;
  if (value.startsWith('/')) return value;
  if (value.startsWith('generated/') || value.startsWith('game-ui/') || value.startsWith('interaction/') || value.startsWith('ornaments/')) return `/ui-assets/${value}`;
  if (generatedPrefixes.some(prefix => value.startsWith(prefix))) return `/ui-assets/generated/${value}`;
  return `/ui-assets/${value}`;
}
