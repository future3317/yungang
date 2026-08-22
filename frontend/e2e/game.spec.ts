import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function startSolo(page: Page, seed?: string) {
  await page.goto('/');
  if (seed) {
    await page.getByRole('button', { name: /旅程种子：高级设置/ }).click();
    await page.getByLabel('可复现种子').fill(seed);
  }
  await page.getByRole('button', { name: '进入准备厅' }).click();
  await page.getByLabel('席位 1 角色').selectOption('pingcheng_artisan');
  await page.getByLabel('席位 2 角色').selectOption('grassland_rider');
  await expect(page.getByRole('button', { name: '准备' }).nth(0)).toBeEnabled();
  await page.getByRole('button', { name: '准备' }).nth(0).click();
  const closeSettings = page.getByRole('button', { name: '关闭设置' });
  if (await closeSettings.isVisible()) await closeSettings.click();
  await expect(page.getByRole('button', { name: '准备' }).nth(1)).toBeEnabled();
  await page.getByRole('button', { name: '准备' }).nth(1).click();
  await page.getByRole('button', { name: '开始旅程' }).click();
  await expect(page).toHaveURL(/\/room\/room-.*\/game/);
  await expect(page.getByRole('heading', { name: '云冈行旅地图' })).toBeVisible();
  const tutorialClose = page.getByRole('button', { name: /^(跳过，自己探索|知道了)$/ }).first();
  if (await tutorialClose.isVisible()) await tutorialClose.click();
}

async function expectNoInternalTerms(page: Page) {
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toMatch(/target_rule|effect\.type|player-seat-|\bRoute:\s|\bProject:\s|use_action_card|form_interpretation|weathering_track/);
}

test('game HUD and map have no serious axe findings', async ({ page }) => {
  await startSolo(page);
  await expectNoInternalTerms(page);
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(item => item.impact === 'serious' || item.impact === 'critical');
  expect(serious, serious.map(item => `${item.id}: ${item.help}`).join('\n')).toEqual([]);
});

test('game page keeps the map inside the viewport', async ({ page }) => {
  await startSolo(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test('desktop HUD keeps side rails below the top bar and moves the shared goal panel', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'This geometry contract is desktop-only.');
  await startSolo(page);
  const header = await page.locator('.game-header').boundingBox();
  const roster = await page.locator('.roster-column').boundingBox();
  expect(header).not.toBeNull();
  expect(roster).not.toBeNull();
  expect(roster!.y).toBeGreaterThanOrEqual(header!.y + header!.height + 12);

  const goal = page.getByRole('region', { name: '胜利清单' });
  const handle = page.getByRole('button', { name: '拖动胜利清单面板' });
  const before = await goal.boundingBox();
  const handleBox = await handle.boundingBox();
  expect(before).not.toBeNull();
  expect(handleBox).not.toBeNull();
  await page.mouse.move(handleBox!.x + 8, handleBox!.y + 8);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + 88, handleBox!.y + 28, { steps: 4 });
  await page.mouse.up();
  const after = await goal.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.x).toBeGreaterThan(before!.x);
});

test('game actions expose a guided target mode without internal enums', async ({ page }) => {
  await startSolo(page);
  const move = page.getByRole('button', { name: /^移动/ }).first();
  await expect(move).toBeVisible();
  await move.click();
  const actionTutorialClose = page.getByRole('button', { name: /^(跳过，自己探索|知道了)$/ }).first();
  if (await actionTutorialClose.isVisible()) await actionTutorialClose.click();
  await expect(page.locator('.action-preview')).toBeVisible();
  await expectNoInternalTerms(page);
});

test('learning chain explains why interpretation is not ready', async ({ page }) => {
  await startSolo(page);

  const confirmPreview = async () => {
    const tutorialClose = page.getByRole('button', { name: /^(跳过，自己探索|知道了)$/ }).first();
    if (await tutorialClose.isVisible()) await tutorialClose.click();
    const preview = page.locator('.action-preview');
    await expect(preview).toBeVisible();
    await preview.getByRole('button', { name: /踏上这一步/ }).click();
    await expect(preview).toBeHidden();
  };

  await page.getByRole('button', { name: /^移动/ }).first().click();
  await confirmPreview();

  const explore = page.getByRole('button', { name: /^探索/ }).first();
  await expect(explore).toBeVisible();
  await explore.click();
  const explorationTutorialClose = page.getByRole('button', { name: /^(跳过，自己探索|知道了)$/ }).first();
  if (await explorationTutorialClose.isVisible()) await explorationTutorialClose.click();
  if (test.info().project.name === 'mobile' || test.info().project.name.endsWith('390')) await page.getByRole('tab', { name: '地点' }).click();
  await page.getByRole('tab', { name: '市场' }).click();
  await page.locator('.inspector-content').evaluate(element => { element.scrollTop = element.scrollHeight; });
  const marketCard = page.locator('.culture-card').first();
  await expect(marketCard).toBeVisible();
  await marketCard.scrollIntoViewIfNeeded();
  const marketTutorialClose = page.getByRole('button', { name: /^(跳过，自己探索|知道了)$/ }).first();
  if (await marketTutorialClose.isVisible()) await marketTutorialClose.click();
  await marketCard.click();
  await confirmPreview();
  await page.getByRole('tab', { name: '任务' }).click({ force: true });

  const evidence = page.locator('.evidence-choice').first();
  await expect(evidence).toBeVisible();
  await evidence.getByRole('button', { name: /支持/ }).click();
  await confirmPreview();

  const form = page.getByRole('button', { name: '形成当前解释', exact: true });
  await expect(form).toBeVisible();
  await expect(form).toBeDisabled();
  await expect(page.locator('.interpretation-hint')).toBeVisible();
  await expectNoInternalTerms(page);
});

test('strict learning chain completes interpretation, strategy response, and round settlement', async ({ page }) => {
  await startSolo(page, '4');

  const confirmAction = async () => {
    const contextualTutorial = page.getByRole('button', { name: /^(跳过，自己探索|知道了)$/ }).first();
    if (await contextualTutorial.isVisible()) await contextualTutorial.click();
    const preview = page.locator('.action-preview');
    await expect(preview).toBeVisible();
    await preview.getByRole('button', { name: '确认行动：踏上这一步' }).click();
    await expect(preview).toBeHidden();
  };
  const finishSeat = async () => {
    const contextualTutorial = page.locator('.tutorial-backdrop .tutorial-skip');
    if (await contextualTutorial.isVisible()) await contextualTutorial.click();
    let endTurn = page.getByRole('button', { name: '结束回合' }).first();
    if (!await endTurn.isVisible()) {
      await page.locator('.more-actions > summary').click();
      endTurn = page.getByRole('button', { name: '结束回合' }).first();
    }
    await expect(endTurn).toBeVisible();
    await endTurn.click();
    await confirmAction();
    const handoff = page.getByRole('button', { name: '我已接过席位' });
    if (await handoff.isVisible()) await handoff.click();
  };
  const selectMove = async (name: string) => {
    const contextualTutorial = page.getByRole('button', { name: /^(跳过，自己探索|知道了)$/ }).first();
    if (await contextualTutorial.isVisible()) await contextualTutorial.click();
    const preview = page.locator('.action-preview');
    if (!await preview.isVisible()) {
      const target = page.locator('.action-target-guide button').filter({ hasText: name }).first();
      await expect(target).toBeVisible();
      await target.evaluate(element => (element as HTMLButtonElement).click());
    }
    await confirmAction();
  };
  const moveToWorkshop = async () => {
    await page.getByRole('button', { name: /^移动/ }).first().click();
    await selectMove('云冈石窟');
    await page.getByRole('button', { name: /^移动/ }).first().click();
    await selectMove('北线工坊');
  };

  await moveToWorkshop();
  await page.getByRole('button', { name: /^探索/ }).first().click();
  const exploreTutorial = page.getByRole('button', { name: /^(跳过，自己探索|知道了)$/ }).first();
  if (await exploreTutorial.isVisible()) await exploreTutorial.click();
  await page.getByRole('tab', { name: '市场' }).click();
  await page.locator('[data-card-id="culture_14"]').click();
  await confirmAction();
  await finishSeat();

  await moveToWorkshop();
  await page.getByRole('button', { name: /^探索/ }).first().click();
  const secondExploreTutorial = page.getByRole('button', { name: /^(跳过，自己探索|知道了)$/ }).first();
  if (await secondExploreTutorial.isVisible()) await secondExploreTutorial.click();
  await page.getByRole('tab', { name: '市场' }).click();
  await page.locator('[data-card-id="culture_27"]').click();
  await confirmAction();
  await finishSeat();

  await page.getByRole('tab', { name: '任务' }).click({ force: true });
  const firstEvidence = page.locator('[data-card-id="culture_14"]').filter({ has: page.getByRole('button', { name: /支持/ }) }).first();
  await expect(firstEvidence).toBeVisible();
  await firstEvidence.getByRole('button', { name: /支持/ }).click();
  await confirmAction();
  await finishSeat();

  await page.getByRole('tab', { name: '任务' }).click({ force: true });
  const secondEvidence = page.locator('[data-card-id="culture_27"]').filter({ has: page.getByRole('button', { name: /支持/ }) }).first();
  await expect(secondEvidence).toBeVisible();
  await secondEvidence.getByRole('button', { name: /支持/ }).click({ force: true });
  await confirmAction();

  const form = page.getByRole('button', { name: '形成当前解释', exact: true });
  await expect(form).toBeEnabled();
  await form.click();
  await confirmAction();
  const minimal = page.getByRole('button', { name: /^最小干预/ });
  await expect(minimal).toBeVisible();
  await minimal.click();
  await confirmAction();
  await page.getByRole('button', { name: '继续旅程' }).click();

  const strategy = page.locator('[aria-label^="整备行装：事件将影响"]').first();
  await expect(strategy).toBeVisible();
  await strategy.click();
  await expect(page.locator('.strategy-card-dialog')).toBeVisible();
  await page.getByRole('button', { name: '继续选择目标' }).click();
  await expect(page.locator('.strategy-card-dialog')).toBeHidden();

  await finishSeat();
  await finishSeat();
  await expect(page.locator('.round-summary')).toBeVisible();
  await expect(page.locator('.round-summary')).toContainText('上一回合');
  await expect(page.locator('.event-history-bar')).toBeVisible();
  await expectNoInternalTerms(page);
});

test('decision surfaces remain accessible when opened', async ({ page }) => {
  await startSolo(page);

  const inspectorResults = await new AxeBuilder({ page }).include('.site-inspector').analyze();
  const inspectorSerious = inspectorResults.violations.filter(item => item.impact === 'serious' || item.impact === 'critical');
  expect(inspectorSerious, inspectorSerious.map(item => `${item.id}: ${item.help}`).join('\\n')).toEqual([]);

  await page.getByRole('button', { name: /^移动/ }).first().click();
  const tutorialClose = page.getByRole('button', { name: /^(跳过，自己探索|知道了)$/ }).first();
  if (await tutorialClose.isVisible()) await tutorialClose.click();
  const actionResults = await new AxeBuilder({ page }).include('.action-preview').analyze();
  const actionSerious = actionResults.violations.filter(item => item.impact === 'serious' || item.impact === 'critical');
  expect(actionSerious, actionSerious.map(item => `${item.id}: ${item.help}`).join('\\n')).toEqual([]);
  await page.getByRole('button', { name: '返回浏览' }).click();

  const strategy = page.locator('.strategy-card').first();
  await expect(strategy).toBeVisible();
  await strategy.click();
  const strategyResults = await new AxeBuilder({ page }).include('.strategy-card-dialog').analyze();
  const strategySerious = strategyResults.violations.filter(item => item.impact === 'serious' || item.impact === 'critical');
  expect(strategySerious, strategySerious.map(item => `${item.id}: ${item.help}`).join('\\n')).toEqual([]);
  await page.getByRole('button', { name: /返回|关闭/ }).last().click();
});
