import { expect, test } from '@playwright/test';

test('new player creates a lobby and starts a solo journey', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '从一束光开始' })).toBeVisible();
  await page.getByRole('button', { name: '进入 Lobby' }).click();
  await expect(page).toHaveURL(/\/room\/room-/);
  await expect(page.getByRole('heading', { name: '等待同行者入席' })).toBeVisible();
  await page.getByRole('button', { name: '点亮旅程' }).click();
  await expect(page).toHaveURL(/\/room\/room-.*\/game/);
  await expect(page.getByRole('heading', { name: '遗产节点网络' })).toBeVisible();
  await expect(page.getByRole('button', { name: '放大地图' })).toBeVisible();
});

test('mobile landing does not overflow horizontally', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
