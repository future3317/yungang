import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function startSolo(page: Page, seed?: string) {
  await page.goto('/');
  if (seed) {
    await page.getByRole('button', { name: '自定义旅程' }).click();
    await page.getByRole('button', { name: /风沙与石/ }).click();
    await page.getByRole('button', { name: /旅程种子：高级设置/ }).click();
    await page.getByLabel('可复现种子').fill(seed);
    await page.getByRole('button', { name: '进入准备厅' }).click();
  } else {
    await page.getByRole('button', { name: /开始新手导览/ }).click();
  }
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
  await expect(page.locator('.network-stage')).toBeVisible();
  const tutorialClose = page.getByRole('button', { name: /^(跳过，自己探索|知道了)$/ }).first();
  if (await tutorialClose.isVisible()) await tutorialClose.click();
}

async function clickGameAction(page: Page, name: RegExp) {
  let action = page.getByRole('button', { name }).first();
  if (!await action.isVisible()) {
    const more = page.locator('details.moreActions, details[class*="moreActions"]').first();
    await expect(more).toBeVisible();
    await more.locator('summary').click();
    action = page.getByRole('button', { name }).first();
  }
  await expect(action).toBeVisible();
  await action.click();
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

test('desktop HUD keeps side rails below the top bar and expands the fixed victory list', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'This geometry contract is desktop-only.');
  await startSolo(page);
  const header = await page.locator('.game-header').boundingBox();
  const roster = await page.locator('.roster-column').boundingBox();
  expect(header).not.toBeNull();
  expect(roster).not.toBeNull();
  expect(roster!.y).toBeGreaterThanOrEqual(header!.y + header!.height + 12);

  const goalButton = page.getByRole('button', { name: /^胜利条件/ });
  const goalButtonBox = await goalButton.boundingBox();
  expect(goalButtonBox).not.toBeNull();
  expect(goalButtonBox!.y).toBeLessThanOrEqual(header!.y + header!.height);
  await goalButton.click();
  await expect(page.getByLabel('胜利条件清单')).toBeVisible();
});

test('game actions expose a guided target mode without internal enums', async ({ page }) => {
  await startSolo(page, '41');
  await clickGameAction(page, /^(前往|移动|寻访)/);
  const actionTutorialClose = page.getByRole('button', { name: /^(跳过，自己探索|知道了)$/ }).first();
  if (await actionTutorialClose.isVisible()) await actionTutorialClose.click();
  await expect(page.locator('.mode-strip')).toContainText('正在选择');
  await expectNoInternalTerms(page);
});

test('evidence selection opens the market without exposing internal terms', async ({ page }) => {
  await startSolo(page, '42');

  await clickGameAction(page, /^(寻访|探索)/);
  const explorationTutorialClose = page.getByRole('button', { name: /^(跳过，自己探索|知道了)$/ }).first();
  if (await explorationTutorialClose.isVisible()) await explorationTutorialClose.click();
  if (test.info().project.name === 'mobile' || test.info().project.name.endsWith('390')) await page.getByRole('tab', { name: '地点' }).click();
  await page.getByRole('tab', { name: '市场' }).click();
  await page.locator('.inspector-content').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(page.locator('.culture-card').first()).toBeVisible();
  await expect(page.getByText('公开文化市场')).toBeVisible();
  await expectNoInternalTerms(page);
});

test('complete learning-chain state transitions are covered by the backend contract suite', async ({ page }) => {
  test.skip(true, 'The deterministic full state chain is asserted in tests/test_release_mechanics.py; UI tests cover navigable decision surfaces.');
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
    if (test.info().project.name === 'mobile' || test.info().project.name.endsWith('390')) await page.getByRole('tab', { name: '地图' }).click();
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
  const openInspectorTab = async (name: '任务' | '市场') => {
    if (test.info().project.name === 'mobile' || test.info().project.name.endsWith('390')) await page.getByRole('tab', { name: '地点' }).click();
    await page.getByRole('tab', { name }).click({ force: true });
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
    await clickGameAction(page, /^(前往|移动)/);
    await selectMove('云冈石窟');
    await page.getByRole('button', { name: /^移动/ }).first().click();
    await selectMove('北线工坊');
  };

  await moveToWorkshop();
  await clickGameAction(page, /^(寻访|探索)/);
  const exploreTutorial = page.getByRole('button', { name: /^(跳过，自己探索|知道了)$/ }).first();
  if (await exploreTutorial.isVisible()) await exploreTutorial.click();
  await openInspectorTab('市场');
  await page.locator('[data-card-id="culture_14"]').click();
  await confirmAction();
  await finishSeat();

  await moveToWorkshop();
  await clickGameAction(page, /^(寻访|探索)/);
  const secondExploreTutorial = page.getByRole('button', { name: /^(跳过，自己探索|知道了)$/ }).first();
  if (await secondExploreTutorial.isVisible()) await secondExploreTutorial.click();
  await openInspectorTab('市场');
  await page.locator('[data-card-id="culture_27"]').click();
  await confirmAction();
  await finishSeat();

  await openInspectorTab('任务');
  const firstEvidence = page.locator('[data-card-id="culture_14"]').filter({ has: page.getByRole('button', { name: /支持/ }) }).first();
  await expect(firstEvidence).toBeVisible();
  await firstEvidence.getByRole('button', { name: /支持/ }).click();
  await confirmAction();
  await finishSeat();

  await openInspectorTab('任务');
  const secondEvidence = page.locator('[data-card-id="culture_27"]').filter({ has: page.getByRole('button', { name: /支持/ }) }).first();
  await expect(secondEvidence).toBeVisible();
  await secondEvidence.getByRole('button', { name: /支持/ }).click({ force: true });
  await confirmAction();

  const form = page.getByRole('button', { name: '完成当前研判', exact: true });
  await expect(form).toBeEnabled();
  await form.click();
  await confirmAction();
  const minimal = page.getByRole('button', { name: /^最小干预/ });
  await expect(minimal).toBeVisible();
  await minimal.click();
  await confirmAction();
  await page.getByRole('button', { name: '继续旅程' }).click();

  let strategy = page.locator('[aria-label^="整备行装：事件将影响"]').first();
  if (test.info().project.name === 'mobile' || test.info().project.name.endsWith('390')) {
    await page.getByRole('tab', { name: '手牌' }).click();
    strategy = page.locator('.strategy-card:visible').filter({ hasText: '整备行装' }).first();
  }
  await expect(strategy).toBeVisible();
  await strategy.click();
  const strategyTutorial = page.locator('.tutorial-backdrop .tutorial-skip');
  if (await strategyTutorial.isVisible()) await strategyTutorial.click();
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

  await expect(page.locator('.site-inspector')).toBeVisible();
  await clickGameAction(page, /^(前往|移动|寻访)/);
  const tutorialClose = page.getByRole('button', { name: /^(跳过，自己探索|知道了)$/ }).first();
  if (await tutorialClose.isVisible()) await tutorialClose.click();
  const actionResults = await new AxeBuilder({ page }).include('.mode-strip').analyze();
  const actionSerious = actionResults.violations.filter(item => item.impact === 'serious' || item.impact === 'critical');
  expect(actionSerious, actionSerious.map(item => `${item.id}: ${item.help}`).join('\\n')).toEqual([]);
  await page.getByRole('button', { name: '取消选择' }).click();
});
