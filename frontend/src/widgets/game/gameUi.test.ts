import { describe, expect, it } from 'vitest';
import { eventDecisionBrief, interpretationConfidenceGuidance, localizeActionText, localizeTimelineMessage, optionAction } from './gameUi';
import { errorText } from './contentLabels';

describe('game UI localization and previews', () => {
  it('reads business errors from the shared terminology catalog', () => {
    expect(errorText({ terminology: { errors: { invalid_route: '请选择一条可通行路线。' } } } as never, 'invalid_route')).toBe('请选择一条可通行路线。');
  });

  it('localizes planning target prefixes', () => {
    expect(localizeActionText('Route: route_shanhua_temple_yungang', { sites: {}, routes: { route_shanhua_temple_yungang: { name: '善化寺—云冈石窟' } as never } })).toBe('路线：善化寺—云冈石窟');
    expect(localizeActionText('Project: project_01', { sites: {}, projects: { project_01: { name: '云冈造像线索工程' } as never } })).toBe('项目：云冈造像线索工程');
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
    expect(optionAction({ id: 'skill', type: 'use_skill', label: '凿刻辨识', category_label: '角色技能', action_label: '使用角色技能', description: '修护当前节点。', cost: { ap: 1 }, enabled: true, targets: [], recommendation_score: 0, reason: '', confirmation: '' }).description).toBe('修护当前节点。');
  });

  it('explains how interpretation confidence changes intervention choices', () => {
    expect(interpretationConfidenceGuidance(2)).toContain('立即处理会增加 1 点风化压力');
    expect(interpretationConfidenceGuidance(5)).toContain('更安心地立即处理');
  });

  it('keeps event response copy in a three-part decision brief', () => {
    const brief = eventDecisionBrief({ forecast_text: '回合末影响两处地点。', description: '不处理会增加节点损伤。', mitigation_hint: '优先修护受影响节点。' });
    expect(brief.whatHappens).toBe('回合末影响两处地点。');
    expect(brief.ifIgnored).toBe('不处理会增加节点损伤。');
    expect(brief.whatYouCanDo).toBe('优先修护受影响节点。');
  });
});
