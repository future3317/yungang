import { describe, expect, it } from 'vitest';
import { assetUrl } from './assetUrl';

describe('assetUrl', () => {
  it('resolves data bare names into generated assets', () => {
    expect(assetUrl('scene_archive_cave.png')).toBe('/ui-assets/generated/scene_archive_cave.png');
    expect(assetUrl('icon_role_scribe.png')).toBe('/ui-assets/generated/icon_role_scribe.png');
  });

  it('preserves named asset groups and absolute paths', () => {
    expect(assetUrl('generated/nodes/icon_node_yungang.png')).toBe('/ui-assets/generated/nodes/icon_node_yungang.png');
    expect(assetUrl('interaction/rings/focus.png')).toBe('/ui-assets/interaction/rings/focus.png');
    expect(assetUrl('/custom/asset.png')).toBe('/custom/asset.png');
  });

  it('uses the requested fallback only when the asset is empty', () => {
    expect(assetUrl(undefined, 'ornaments/heritage-medallion-1.png')).toBe('/ui-assets/ornaments/heritage-medallion-1.png');
  });
});
