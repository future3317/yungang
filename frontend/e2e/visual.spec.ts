import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

async function startSolo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /旅程种子：高级设置/ }).click();
  await page.getByLabel('可复现种子').fill('901');
  await page.getByRole('button', { name: '进入准备厅' }).click();
  await page.getByLabel('席位 1 角色').selectOption('pingcheng_artisan');
  await page.getByLabel('席位 2 角色').selectOption('grassland_rider');
  await page.getByRole('button', { name: '准备' }).nth(0).click();
  await page.getByRole('button', { name: '准备' }).nth(1).click();
  await page.getByRole('button', { name: '开始旅程' }).click();
  await expect(page.getByRole('heading', { name: '云冈行旅地图' })).toBeVisible();
  const tutorial = page.getByRole('button', { name: /^(跳过，自己探索|知道了)$/ }).first();
  if (await tutorial.isVisible()) await tutorial.click();
}

test('landing visual baseline', async ({ page }) => {
  test.skip(!test.info().project.name.startsWith('visual-'), 'Visual baselines use fixed viewport projects.');
  await page.goto('/');
  await expect(page.getByRole('button', { name: '进入准备厅' })).toBeVisible();
  await expect(page).toHaveScreenshot('landing.png', { animations: 'disabled' });
});

test('game HUD visual baseline', async ({ page }) => {
  test.skip(!test.info().project.name.startsWith('visual-'), 'Visual baselines use fixed viewport projects.');
  await startSolo(page);
  const screenshotOptions = { animations: 'disabled' as const, mask: [page.locator('.header-actions')], maxDiffPixels: test.info().project.name.endsWith('390') ? 64 : 8 };
  await expect(page).toHaveScreenshot('game-hud.png', screenshotOptions);
  if (!test.info().project.name.endsWith('390')) {
    await page.getByRole('button', { name: '查看胜利条件（全部）' }).click();
  }
  await expect(page).toHaveScreenshot('game-goals-open.png', screenshotOptions);
});
