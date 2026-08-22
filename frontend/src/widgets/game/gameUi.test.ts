import { describe, expect, it } from 'vitest';
import { localizeActionText, localizeTimelineMessage, optionAction } from './gameUi';

describe('game UI localization and previews', () => {
  it('localizes planning target prefixes', () => {
    expect(localizeActionText('Route: route_shanhua_temple_yungang')).toBe('路线：route_shanhua_temple_yungang');
    expect(localizeActionText('Project: project_01')).toBe('项目：project_01');
  });

  it('resolves timeline target ids into player-facing names', () => {
    expect(localizeTimelineMessage('放置规划标记（目标：route_shanhua_temple_yungang）', {
      sites: {},
      routes: { route_shanhua_temple_yungang: { name: '善化寺—云冈石窟' } as never },
      projects: {},
    })).toBe('放置规划标记（目标：善化寺—云冈石窟）');
  });

  it('resolves half-width timeline target markers too', () => {
    expect(localizeTimelineMessage('规划目标 (目标: project_01)', {
      sites: {},
      routes: {},
      projects: { project_01: { name: '云冈造像线索工程' } as never },
    })).toBe('规划目标（目标：云冈造像线索工程）');
  });

  it('carries action descriptions into confirmation previews', () => {
    expect(optionAction({ id: 'skill', type: 'use_skill', label: '凿刻辨识', description: '修护当前节点。', cost: { ap: 1 }, enabled: true, targets: [] }).description).toBe('修护当前节点。');
  });
});
