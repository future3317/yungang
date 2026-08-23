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
    const created = await page.request.post('http://127.0.0.1:8000/api/rooms', {
      data: { play_mode: 'solo', name: '测试玩家', difficulty_id: 'normal', scenario_id: 'sand_and_stone', seed: 901 },
    });
    expect(created.ok()).toBe(true);
    const roomPayload = await created.json() as Record<string, any>;
    const roomId = roomPayload.room.room_id as string;
    const token = roomPayload.seat_token as string;
    for (const [seatId, roleId] of [['seat-1', 'pingcheng_artisan'], ['seat-2', 'grassland_rider']]) {
      const configured = await page.request.post(`http://127.0.0.1:8000/api/rooms/${roomId}/seats/${seatId}`, {
        headers: { 'X-Seat-Token': token },
        data: { role_id: roleId, ready: true },
      });
      expect(configured.ok()).toBe(true);
    }
    const started = await page.request.post(`http://127.0.0.1:8000/api/rooms/${roomId}/start`, { headers: { 'X-Seat-Token': token } });
    expect(started.ok()).toBe(true);
    const response = await page.request.get(`http://127.0.0.1:8000/api/rooms/${roomId}/game`, { headers: { 'X-Seat-Token': token } });
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
    await page.route(`**/api/rooms/${roomId}/game`, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state) }));
    await page.goto('/');
    await page.evaluate(({ id, value }) => sessionStorage.setItem(`yungang-room-token:${id}`, value), { id: roomId, value: token });

    await page.goto(`/room/${roomId}/result`);
    await expect(page.getByRole('heading', { name: outcome.title })).toBeVisible();
    const resultResults = await new AxeBuilder({ page }).include('.result-card').analyze();
    const resultSerious = resultResults.violations.filter(item => item.impact === 'serious' || item.impact === 'critical');
    expect(resultSerious, resultSerious.map(item => `${item.id}: ${item.help}`).join('\\n')).toEqual([]);
    if (state.shared.outcome === 'defeat') await expect(page.locator('.result-failure-reason')).toContainText(outcome.detail);
  });
}
