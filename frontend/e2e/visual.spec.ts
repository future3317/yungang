import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const NEUTRAL_MASK = '#1a1a1a';

function commonScreenshot(page: Page, overrides: Record<string, unknown> = {}) {
  return {
    animations: 'disabled' as const,
    maxDiffPixels: 400,
    maskColor: NEUTRAL_MASK,
    mask: [] as Array<ReturnType<typeof page.locator>>,
    ...overrides,
  };
}

function isMobileProject() {
  return Boolean(test.info().project.use.isMobile);
}

async function skipNonVisual() {
  if (!test.info().project.name.startsWith('visual-')) {
    test.skip(true, 'Visual baselines use fixed viewport projects.');
  }
}

async function gotoLanding(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /开始新手导览/ })).toBeVisible();
}

async function createRoom(page: Page) {
  await gotoLanding(page);
  await page.getByRole('button', { name: '自定义旅程' }).click();
  await page.locator('.scenario-options > button').first().click();
  await page.getByRole('button', { name: /旅程种子：高级设置/ }).click();
  await page.getByLabel('可复现种子').fill('901');
  await page.getByRole('button', { name: '进入准备厅' }).click();
  await expect(page.getByRole('heading', { name: /配置.+角色/ })).toBeVisible();
}

async function startSolo(page: Page) {
  await createRoom(page);
  await page.getByLabel('席位 1 角色').selectOption('pingcheng_artisan');
  await page.getByLabel('席位 2 角色').selectOption('grassland_rider');
  await page.getByRole('button', { name: '准备' }).nth(0).click();
  await page.getByRole('button', { name: '准备' }).nth(1).click();
  await page.getByRole('button', { name: '开始旅程' }).click();
  await expect(page.locator('.network-stage')).toBeVisible();
  const tutorial = page.getByRole('button', { name: /^(跳过，自己寻访证据|知道了)$/ }).first();
  if (await tutorial.isVisible()) await tutorial.click();
}

async function openInspector(page: Page) {
  const expand = page.locator('.inspector-expand');
  if (await expand.isVisible()) {
    await expand.click();
    await expect(page.locator('.inspector-tabs')).toBeVisible();
  }
}

async function clickActionButton(page: Page, label: RegExp) {
  const locator = page.getByRole('button').filter({ hasText: label });
  const visible = await locator.locator(':visible').count();
  if (visible === 0) {
    await page.locator('details.moreActions').evaluate((el: HTMLDetailsElement) => {
      el.open = true;
    });
  }
  await locator.first().click();
}

async function acquireCard(page: Page) {
  await clickActionButton(page, /寻访证据/);
  const tutorial = page.getByRole('heading', { name: '从市场带回一张证据卡' });
  await expect(tutorial).toBeVisible();
  await page.locator('.tutorial-backdrop .tutorial-skip').click();
  await expect(page.locator('.tutorial-backdrop')).toBeHidden();
  let clearPasses = 0;
  for (let attempt = 0; attempt < 12 && clearPasses < 3; attempt += 1) {
    const overlay = page.locator('.tutorial-backdrop:visible');
    if (await overlay.count()) {
      clearPasses = 0;
      await overlay.locator('button').first().click();
    } else {
      clearPasses += 1;
    }
    await page.waitForTimeout(250);
  }
  await openInspector(page);
  await page.getByRole('tab', { name: '市场' }).click();
  const card = page.locator('[data-card-id]').first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.locator('.dialog.action-preview')).toBeVisible();
  await page.getByRole('button', { name: /踏上这一步/ }).click();
  await expect(page.locator('.dialog.action-preview')).not.toBeVisible();
}

async function assertPrimaryCtaAboveFold(page: Page) {
  const box = await page.getByRole('button', { name: /开始新手导览/ }).boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport && box.y + box.height <= viewport.height).toBe(true);
}

async function assertMapWidthAtLeast(page: Page, ratio: number) {
  if (isMobileProject()) return;
  const box = await page.locator('.network-stage').first().boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport && box.width >= viewport.width * ratio).toBe(true);
}

async function assertMapHeightAtLeast(page: Page, ratio: number) {
  if (isMobileProject()) return;
  const map = page.locator('.network-stage').first();
  const box = await map.boundingBox();
  const viewport = page.viewportSize();
  const layout = await map.evaluate((element) => {
    const describe = (node: Element | null) => {
      if (!node) return null;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return {
        className: node.className,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        display: style.display,
        height: style.height,
        gridTemplateRows: style.gridTemplateRows,
        alignSelf: style.alignSelf,
      };
    };
    return [element, element.parentElement, element.parentElement?.parentElement, element.closest('.hud-layout'), element.closest('.game-shell')].map(describe);
  });
  expect(
    box && viewport && box.height >= viewport.height * ratio,
    `map=${JSON.stringify(box)} viewport=${JSON.stringify(viewport)} layout=${JSON.stringify(layout)}`
  ).toBe(true);
}

async function assertNoOverlap(page: Page, aSelector: string, bSelector: string) {
  const a = await page.locator(aSelector).first().boundingBox();
  const b = await page.locator(bSelector).first().boundingBox();
  if (!a || !b) return;
  const overlap = !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
  expect(overlap).toBe(false);
}

async function assertDialogInsideViewport(page: Page) {
  const dialog = await page.locator('.dialog').first().boundingBox();
  const viewport = page.viewportSize();
  expect(dialog && viewport).toBeTruthy();
  if (!dialog || !viewport) return;
  expect(
    dialog.x >= 0 && dialog.y >= 0 && dialog.x + dialog.width <= viewport.width && dialog.y + dialog.height <= viewport.height
  ).toBe(true);
}

test('landing visual baseline', async ({ page }) => {
  await skipNonVisual();
  await gotoLanding(page);
  await assertPrimaryCtaAboveFold(page);
  await expect(page).toHaveScreenshot('landing.png', commonScreenshot(page, { mask: [] }));
});

test('preparation hall visual baseline', async ({ page }) => {
  await skipNonVisual();
  await createRoom(page);
  await expect(page.locator('.room-card')).toBeVisible();
  await expect(page).toHaveScreenshot(
    'preparation-hall.png',
    commonScreenshot(page, { mask: [page.locator('.room-code')] })
  );
});

test('objective selection visual baseline', async ({ page }) => {
  await skipNonVisual();
  await createRoom(page);
  await expect(page.locator('.role-selection-panel')).toBeVisible();
  await expect(page.locator('.role-selection-panel')).toHaveScreenshot('objective-selection.png', commonScreenshot(page));
});

test('game HUD visual baseline', async ({ page }) => {
  await skipNonVisual();
  await startSolo(page);
  await assertMapWidthAtLeast(page, 0.55);
  await assertMapHeightAtLeast(page, 0.5);
  await assertNoOverlap(page, '.game-header', '.site-inspector, .inspector-rail');
  await expect(page).toHaveScreenshot('game-hud.png', commonScreenshot(page, { mask: [page.locator('.header-actions')] }));
});

test('action preview dialog visual baseline', async ({ page }) => {
  await skipNonVisual();
  await startSolo(page);
  await clickActionButton(page, /寻访证据/);
  const tutorial = page.getByRole('heading', { name: '从市场带回一张证据卡' });
  if (await tutorial.isVisible()) {
    await page.locator('.tutorial-backdrop .tutorial-skip').click();
    await expect(page.locator('.tutorial-backdrop')).toBeHidden();
  }
  if (isMobileProject()) await page.getByRole('tab', { name: '地点', exact: true }).click();
  await openInspector(page);
  await page.getByRole('tab', { name: '市场' }).click();
  const card = page.locator('[data-card-id]').first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.locator('.dialog.action-preview')).toBeVisible();
  await assertDialogInsideViewport(page);
  await expect(page.locator('.dialog.action-preview')).toHaveScreenshot('action-preview.png', {
    animations: 'disabled',
    mask: [page.locator('.header-actions')],
    maskColor: NEUTRAL_MASK,
  });
});

test('event panel visual baseline', async ({ page }) => {
  await skipNonVisual();
  await startSolo(page);
  if (isMobileProject()) await page.getByRole('tab', { name: '地点', exact: true }).click();
  await openInspector(page);
  await page.getByRole('tab', { name: '事件' }).click();
  await expect(page.locator('.event-tab')).toBeVisible();
  await expect(page).toHaveScreenshot('event-panel.png', commonScreenshot(page, { mask: [page.locator('.header-actions')] }));
});

test('market panel visual baseline', async ({ page }) => {
  await skipNonVisual();
  await startSolo(page);
  if (isMobileProject()) await page.getByRole('tab', { name: '地点', exact: true }).click();
  await openInspector(page);
  await page.getByRole('tab', { name: '市场' }).click();
  await expect(page.locator('.market-tab')).toBeVisible();
  await expect(page).toHaveScreenshot('market-panel.png', commonScreenshot(page, { mask: [page.locator('.header-actions')] }));
});

test('full hand visual baseline', async ({ page }) => {
  await skipNonVisual();
  await startSolo(page);
  // Acquire evidence cards until the hand is full or action points run out.
  for (let i = 0; i < 3; i += 1) {
    const handCount = await page.locator('[class*="handCard"]').count();
    if (handCount >= 3) break;
    try {
      await acquireCard(page);
    } catch {
      break;
    }
  }
  await expect(page.locator('[class*="handCard"]')).not.toHaveCount(0);
  await expect(page).toHaveScreenshot('full-hand.png', commonScreenshot(page, { mask: [page.locator('.header-actions')] }));
});

test('disconnect state visual baseline', async ({ page }) => {
  await skipNonVisual();
  await startSolo(page);
  const roomId = page.url().split('/room/')[1]?.split('/')[0];
  expect(roomId).toBeTruthy();
  await page.evaluate((id: string) => sessionStorage.removeItem(`yungang-room-token:${id}`), roomId!);
  await page.goto(`/room/${roomId}/game`);
  await expect(page.locator('.state-screen')).toBeVisible();
  await expect(page).toHaveScreenshot('disconnect.png', commonScreenshot(page, { mask: [] }));
});

test('result page visual baseline', async ({ page }) => {
  await skipNonVisual();
  await startSolo(page);
  const roomId = page.url().split('/room/')[1]?.split('/')[0];
  expect(roomId).toBeTruthy();
  await page.goto(`/room/${roomId}/result`);
  await expect(page.locator('.result-card')).toBeVisible();
  await expect(page).toHaveScreenshot('result-page.png', commonScreenshot(page, { mask: [] }));
});

test('200 percent font visual baseline', async ({ page }) => {
  await skipNonVisual();
  await gotoLanding(page);
  await page.evaluate(() => {
    document.documentElement.dataset.largeText = 'true';
    document.documentElement.style.fontSize = '32px';
  });
  await assertPrimaryCtaAboveFold(page);
  await expect(page).toHaveScreenshot('font-200.png', commonScreenshot(page, { mask: [] }));
});

test('game HUD at 200 percent font remains readable', async ({ page }) => {
  await skipNonVisual();
  await startSolo(page);
  await page.evaluate(() => {
    document.documentElement.dataset.largeText = 'true';
    document.documentElement.style.fontSize = '32px';
  });
  await expect(page.locator('.network-stage')).toBeVisible();
  await expect(page.locator('.site-inspector, .inspector-rail')).toBeVisible();
  await expect(page).toHaveScreenshot('game-hud-font-200.png', commonScreenshot(page, { mask: [page.locator('.header-actions')] }));
});

test('high contrast visual baseline', async ({ page }) => {
  await skipNonVisual();
  await gotoLanding(page);
  await page.evaluate(() => {
    localStorage.setItem(
      'cave-light-atlas-accessibility',
      JSON.stringify({ largeText: false, highContrast: true, reducedMotion: true })
    );
  });
  await page.reload();
  await expect(page.getByRole('button', { name: /开始新手导览/ })).toBeVisible();
  await expect(page.locator('html[data-high-contrast="true"]')).toBeAttached();
  await expect(page).toHaveScreenshot('high-contrast.png', commonScreenshot(page, { mask: [] }));
});

test('mobile landing visual baseline', async ({ page }) => {
  await skipNonVisual();
  if (!isMobileProject()) test.skip(true, 'Mobile snapshot uses the visual-390 project.');
  await gotoLanding(page);
  await assertPrimaryCtaAboveFold(page);
  await expect(page).toHaveScreenshot('mobile-landing.png', {
    animations: 'disabled',
    mask: [page.locator('.header-actions')],
    maskColor: NEUTRAL_MASK,
    maxDiffPixels: 1000,
  });
});

test('mobile game HUD visual baseline', async ({ page }) => {
  await skipNonVisual();
  if (!isMobileProject()) test.skip(true, 'Mobile snapshot uses the visual-390 project.');
  await startSolo(page);
  await page.getByRole('tab', { name: '地图' }).click();
  await expect(page.locator('.network-stage')).toBeVisible();
  await expect(page).toHaveScreenshot('mobile-game-hud.png', {
    animations: 'disabled',
    mask: [page.locator('.header-actions')],
    maskColor: NEUTRAL_MASK,
    maxDiffPixels: 1000,
  });
});
