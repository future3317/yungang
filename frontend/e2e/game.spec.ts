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
  await startSolo(page);
  const header = await page.locator('.game-header').boundingBox();
  const layout = await page.locator('.hud-layout').boundingBox();
  const roster = await page.locator('.roster-column').boundingBox();
  const world = await page.locator('.hud-slot-world').boundingBox();
  const inspector = await page.locator('.hud-slot-right').boundingBox();
  const dock = await page.locator('.hud-slot-bottom').boundingBox();
  const viewport = page.viewportSize();
  expect(header).not.toBeNull();
  expect(layout).not.toBeNull();
  expect(roster).not.toBeNull();
  expect(world).not.toBeNull();
  expect(inspector).not.toBeNull();
  expect(dock).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(roster!.y).toBeGreaterThanOrEqual(header!.y + header!.height + 12);
  expect(roster!.x + roster!.width).toBeLessThanOrEqual(world!.x + 1);
  expect(world!.x + world!.width).toBeLessThanOrEqual(inspector!.x + 1);
  expect(inspector!.x + inspector!.width).toBeLessThanOrEqual(viewport!.width);
  expect(world!.width).toBeGreaterThan(0);
  expect(dock!.y).toBeGreaterThanOrEqual(layout!.y + layout!.height - 1);

  await expect(page.locator('.hud-layout > .hud-slot-left')).toHaveCSS('overflow-y', 'scroll');
  await expect(page.locator('.hud-layout > .hud-slot-right.site-inspector .inspector-content')).toHaveCSS('overflow-y', 'scroll');

  const inspectorBoxBeforeTabs = await page.locator('.site-inspector').boundingBox();
  expect(inspectorBoxBeforeTabs).not.toBeNull();
  for (const tabName of ['地点任务', '团队项目', '事件', '市场']) {
    await page.getByRole('tab', { name: tabName }).click();
    const inspectorBoxAfterTab = await page.locator('.site-inspector').boundingBox();
    expect(inspectorBoxAfterTab).not.toBeNull();
    expect(inspectorBoxAfterTab!.x).toBe(inspectorBoxBeforeTabs!.x);
    expect(inspectorBoxAfterTab!.y).toBe(inspectorBoxBeforeTabs!.y);
    expect(inspectorBoxAfterTab!.width).toBe(inspectorBoxBeforeTabs!.width);
    expect(inspectorBoxAfterTab!.height).toBe(inspectorBoxBeforeTabs!.height);
  }

  const goalButton = page.getByRole('button', { name: /^胜利条件/ });
  const goalButtonBox = await goalButton.boundingBox();
  expect(goalButtonBox).not.toBeNull();
  expect(goalButtonBox!.y).toBeLessThanOrEqual(header!.y + header!.height);
  await goalButton.click();
  await expect(page.getByLabel('胜利条件清单')).toBeVisible();
});

test('narrow viewport shows the desktop-only notice instead of a partial game UI', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '请使用桌面端访问' })).toBeVisible();
  await expect(page.locator('.game-viewport')).toHaveCount(0);
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
  await page.getByRole('tab', { name: '市场' }).click();
  await page.locator('.inspector-content').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(page.locator('.culture-card').first()).toBeVisible();
  await expect(page.getByText('公开文化市场')).toBeVisible();
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

test('real display preference increases text and survives reload', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('打开显示与辅助设置').click();
  const before = await page.locator('.landing-copy').evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  await page.getByRole('button', { name: '放大文字' }).click();
  const after = await page.locator('.landing-copy').evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(after).toBeGreaterThan(before);
  await page.reload();
  await expect(page.locator('html[data-large-text="true"]')).toBeAttached();
});

test('desktop interactive controls keep the shared hitbox contract', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'This runtime hitbox contract is desktop-only.');
  await startSolo(page);
  const violations = await page.locator('button, [role="button"], summary, select, input').evaluateAll((elements) =>
    elements.flatMap((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) return [];
      if (rect.width >= 44 && rect.height >= 44) return [];
      const label = element.getAttribute('aria-label') || (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      return [`${element.tagName}.${element.className} [${label}]: ${rect.width}x${rect.height}`];
    })
  );
  expect(violations).toEqual([]);
});
