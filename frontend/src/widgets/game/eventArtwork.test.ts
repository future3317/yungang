import { describe, expect, it } from 'vitest';
import { resolveEventSceneAsset } from './eventArtwork';

describe('resolveEventSceneAsset', () => {
  it('keeps event scenes distinct when an event has no type metadata', () => {
    expect(resolveEventSceneAsset({ id: 'sandstorm' })).toBe('generated/scene_frontier_pass.webp');
    expect(resolveEventSceneAsset({ id: 'event_08' })).toBe('generated/scene_archive_cave.webp');
    expect(resolveEventSceneAsset({ id: 'event_18' })).toBe('generated/scene_trade_meeting.webp');
  });

  it('prefers the content-provided scene asset', () => {
    expect(resolveEventSceneAsset({ id: 'sandstorm', scene_asset: 'generated/scene_yungang_night.webp' })).toBe(
      'generated/scene_yungang_night.webp'
    );
  });
});
