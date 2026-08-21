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
  await expect(page.getByRole('heading', { name: '遗产节点网络' })).toBeVisible();
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

test('game actions expose a guided target mode without internal enums', async ({ page }) => {
  await startSolo(page);
  const move = page.getByRole('button', { name: /^移动/ }).first();
  await expect(move).toBeVisible();
  await move.click();
  await expect(page.getByRole('status').filter({ hasText: /正在选择.*目标/ })).toBeVisible();
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toMatch(/use_action_card|form_interpretation|project_[0-9]+/);
});
