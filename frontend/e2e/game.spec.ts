import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function startSolo(page: Page) {
  await page.goto('/');
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

test('game HUD and map have no serious axe findings', async ({ page }) => {
  await startSolo(page);
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
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toMatch(/use_action_card|form_interpretation|project_[0-9]+/);
});

test('single player can follow the learning chain with visible confirmations', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'The full learning-chain journey is covered on desktop.');
  await startSolo(page);

  const confirmPreview = async () => {
    const tutorialClose = page.getByRole('button', { name: /^(跳过，自己探索|知道了)$/ }).first();
    if (await tutorialClose.isVisible()) await tutorialClose.click();
    const preview = page.locator('.action-preview');
    if (await preview.isVisible()) {
      await preview.getByRole('button', { name: /踏上这一步/ }).click();
      await expect(preview).toBeHidden();
    }
  };

  await page.getByRole('button', { name: /^移动/ }).first().click();
  await confirmPreview();

  const explore = page.getByRole('button', { name: /^探索/ }).first();
  await expect(explore).toBeVisible();
  await explore.click();
  await confirmPreview();

  await page.locator('.inspector-content').evaluate(element => { element.scrollTop = element.scrollHeight; });
  const marketCard = page.locator('.culture-card').first();
  await expect(marketCard).toBeVisible();
  await marketCard.click();
  await confirmPreview();
  await page.getByRole('tab', { name: '任务' }).click();

  const evidence = page.locator('.evidence-choice').first();
  await expect(evidence).toBeVisible();
  await evidence.getByRole('button', { name: /支持/ }).click();
  await confirmPreview();

  const form = page.getByRole('button', { name: '形成当前解释' });
  if (await form.isVisible()) {
    if (await form.isEnabled()) {
      await form.click();
      await confirmPreview();
    } else {
      await expect(page.locator('.interpretation-hint')).toBeVisible();
    }
  }

  const intervention = page.getByRole('button', { name: /最小干预/ });
  if (await intervention.isVisible()) {
    await intervention.click();
    await confirmPreview();
  }

  await expect(page.locator('.toast-queue, .timeline-drawer').first()).toBeVisible();
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toMatch(/player-seat-|target_rule|use_action_card|form_interpretation/);
});
