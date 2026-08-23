import { expect, test } from '@playwright/test';

test('new player creates a lobby and starts a solo journey', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '从一束光开始' })).toBeVisible();
  await page.getByRole('button', { name: '自定义旅程' }).click();
  await page.locator('.scenario-options > button').first().click();
  await page.getByRole('button', { name: '进入准备厅' }).click();
  await expect(page).toHaveURL(/\/room\/room-/);
  await expect(page.getByRole('heading', { name: '配置两位同行角色' })).toBeVisible();
  await page.getByLabel('席位 1 角色').selectOption('pingcheng_artisan');
  await expect(page.getByLabel('席位 1 角色')).toHaveValue('pingcheng_artisan');
  await page.getByLabel('席位 2 角色').selectOption('grassland_rider');
  await expect(page.getByLabel('席位 2 角色')).toHaveValue('grassland_rider');
  await page.getByRole('button', { name: '准备' }).nth(0).click();
  await expect(page.getByRole('button', { name: '已准备' }).nth(0)).toBeVisible();
  const closeSettings = page.getByRole('button', { name: '关闭设置' });
  if (await closeSettings.isVisible()) await closeSettings.click();
  await page.getByRole('button', { name: '准备' }).nth(1).click();
  await page.getByRole('button', { name: '开始旅程' }).click();
  await expect(page).toHaveURL(/\/room\/room-.*\/game/);
  await expect(page.locator('.game-viewport')).toBeVisible();
  await expect(page.getByRole('button', { name: '适应全部节点' })).toBeVisible();
});

