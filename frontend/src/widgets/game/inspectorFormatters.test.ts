import { describe, expect, it } from 'vitest';
import type { ContentCard, Meta } from '../../types/game';
import { contentTagName, eventTargetRuleName, formatProjectRequirements, marketReason } from './inspectorFormatters';

const meta = {
  domain_meta: {
    statue: { name: '造像', short_name: '造像' },
    pattern: { name: '纹样', short_name: '纹样' },
  },
  terminology: {
    domains: { statue: '造像', pattern: '纹样' },
    combo_tags: {},
  },
} as unknown as Meta;

describe('inspector player-facing labels', () => {
  it('formats project requirements without exposing internal keys', () => {
    const text = formatProjectRequirements(meta, {
      domains: ['statue', 'pattern'],
      origin_diversity: 2,
      action_type: 'interpret_evidence',
    });

    expect(text).toContain('领域：造像、纹样');
    expect(text).toContain('线索脉络数：至少 2 种');
    expect(text).toContain('行动：研判证据');
    expect(text).not.toContain('origin_diversity');
    expect(text).not.toContain('interpret_evidence');
  });

  it('uses Chinese labels for market domains and unknown combo tags', () => {
    expect(marketReason({ domain: 'statue' } as ContentCard, undefined, false, meta)).toContain('造像');
    expect(marketReason({ domain: 'statue' } as ContentCard, undefined, false, meta)).not.toContain('statue');
    expect(contentTagName('unknown_combo')).toBe('未标注组合');
  });

  it('uses the shared terminology catalog for event target rules', () => {
    const eventMeta = {
      ...meta,
      terminology: { event_target_rules: { two_open_sites: '两处仍可守护的节点' } },
    } as Meta;
    expect(eventTargetRuleName('two_open_sites', eventMeta)).toBe('两处仍可守护的节点');
    expect(eventTargetRuleName('two_open_sites', eventMeta)).not.toContain('two_open_sites');
  });
});
