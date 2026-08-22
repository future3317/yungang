import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

type OutcomeCase = {
  reason: string;
  title: string;
  detail: RegExp;
  mutate: (state: Record<string, any>) => void;
};

const outcomes: OutcomeCase[] = [
  {
    reason: 'too_many_closed_sites',
    title: '守护网络失守',
    detail: /节点已关闭|场景上限/,
    mutate: state => Object.values(state.sites).slice(0, 2).forEach((site: any) => { site.status = 'closed'; }),
  },
  {
    reason: 'weathering_track_reached_limit',
    title: '风化压力失控',
    detail: /风化压力达到/,
    mutate: state => { state.shared.weathering_track = state.shared.weathering_limit; },
  },
  {
    reason: 'round_limit_reached',
    title: '旅程暂告一段落',
    detail: /回合|行动不足/,
    mutate: state => { state.shared.turn = state.shared.max_rounds + 1; },
  },
  {
    reason: 'core_project_and_objectives_completed',
    title: '遗产网络已显影',
    detail: /共同目标|核心项目/,
    mutate: state => { state.shared.outcome = 'victory'; },
  },
];

for (const outcome of outcomes) {
  test(`result page explains ${outcome.reason}`, async ({ page }) => {
    const response = await page.request.post('http://127.0.0.1:8000/api/games', {
      data: { player_ids: ['p1'], difficulty_id: 'normal', scenario_id: 'sand_and_stone', seed: 901 },
    });
    expect(response.ok()).toBe(true);
    const state = await response.json() as Record<string, any>;
    state.shared.outcome = outcome.reason === 'core_project_and_objectives_completed' ? 'victory' : 'defeat';
    state.shared.outcome_reason = outcome.reason;
    state.result = {
      outcome: state.shared.outcome,
      outcome_reason: outcome.reason,
      outcome_summary: outcome.title,
      completed_projects: [],
      completed_objectives: [],
      seed: state.seed,
    };
    outcome.mutate(state);
    await page.route(`**/api/games/${state.session_id}`, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state) }));

    await page.goto(`/result/${state.session_id}`);
    await expect(page.getByRole('heading', { name: outcome.title })).toBeVisible();
    const resultResults = await new AxeBuilder({ page }).include('.result-card').analyze();
    const resultSerious = resultResults.violations.filter(item => item.impact === 'serious' || item.impact === 'critical');
    expect(resultSerious, resultSerious.map(item => `${item.id}: ${item.help}`).join('\\n')).toEqual([]);
    if (state.shared.outcome === 'defeat') await expect(page.locator('.result-failure-reason')).toContainText(outcome.detail);
  });
}
