import { describe, expect, it } from 'vitest';
import { assetUrl } from './assetUrl';

describe('assetUrl', () => {
  it('resolves data bare names into generated assets', () => {
    expect(assetUrl('scene_archive_cave.webp')).toBe('/ui-assets/generated/scene_archive_cave.webp');
    expect(assetUrl('icon_role_scribe.webp')).toBe('/ui-assets/generated/icon_role_scribe.webp');
  });

  it('preserves named asset groups and absolute paths', () => {
    expect(assetUrl('generated/nodes/icon_node_yungang.webp')).toBe(
      '/ui-assets/generated/nodes/icon_node_yungang.webp'
    );
    expect(assetUrl('interaction/rings/focus.webp')).toBe('/ui-assets/interaction/rings/focus.webp');
    expect(assetUrl('/custom/asset.webp')).toBe('/custom/asset.webp');
  });

  it('uses the requested fallback only when the asset is empty', () => {
    expect(assetUrl(undefined, 'ornaments/heritage-medallion-1.webp')).toBe(
      '/ui-assets/ornaments/heritage-medallion-1.webp'
    );
  });
});
