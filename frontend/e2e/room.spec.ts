import { expect, test } from '@playwright/test';

test('two devices can join, ready, and start a room', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  await host.goto('/');
  await host.getByRole('button', { name: '多设备房间' }).click();
  await host.getByLabel('你的名字').fill('房主');
  await host.getByRole('button', { name: '进入准备厅' }).click();
  await expect(host).toHaveURL(/\/room\/room-/);
  const roomUrl = host.url();
  await guest.goto(roomUrl);
  await guest.getByLabel('你的名字').fill('同行者');
  await guest.getByLabel('选择角色').selectOption('grassland_rider');
  await expect(guest.getByLabel('选择角色')).toHaveValue('grassland_rider');
  await guest.getByRole('button', { name: '加入席位' }).click();
  await expect(guest.getByRole('button', { name: '准备好了' })).toBeVisible();
  for (const page of [host, guest]) {
    const closeSettings = page.getByRole('button', { name: '关闭设置' });
    if (await closeSettings.isVisible()) await closeSettings.click();
  }
  await host.getByLabel('选择角色').selectOption('pingcheng_artisan');
  await expect(host.getByLabel('选择角色')).toHaveValue('pingcheng_artisan');
  await host.getByRole('button', { name: '准备好了' }).click();
  await guest.getByRole('button', { name: '准备好了' }).click();
  await host.getByRole('button', { name: '开始旅程' }).click();
  await expect(host).toHaveURL(/\/room\/room-.*\/game/);
  await expect(guest).toHaveURL(/\/room\/room-.*\/game/);
  await hostContext.close();
  await guestContext.close();
});

test('a disconnected guest can recover the same room seat', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const recoveredContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await host.goto('/');
  await host.getByRole('button', { name: '多设备房间' }).click();
  await host.getByLabel('你的名字').fill('房主');
  await host.getByRole('button', { name: '进入准备厅' }).click();
  await expect(host).toHaveURL(/\/room\/room-/);
  const roomUrl = host.url();

  await guest.goto(roomUrl);
  await guest.getByLabel('你的名字').fill('同行者');
  await guest.getByLabel('选择角色').selectOption('grassland_rider');
  await guest.getByRole('button', { name: '加入席位' }).click();
  await expect(guest.getByRole('button', { name: '准备好了' })).toBeVisible();

  await host.getByLabel('选择角色').selectOption('pingcheng_artisan');
  await host.getByRole('button', { name: '准备好了' }).click();
  await guest.getByRole('button', { name: '准备好了' }).click();
  await host.getByRole('button', { name: '开始旅程' }).click();
  await expect(host).toHaveURL(/\/room\/room-.*\/game/);
  await expect(guest).toHaveURL(/\/room\/room-.*\/game/);

  await guestContext.close();
  const recovered = await recoveredContext.newPage();
  await recovered.goto(roomUrl);
  await expect(recovered.getByText('恢复同行席位', { exact: true })).toBeVisible();
  await expect(recovered.getByLabel('恢复席位')).toContainText('同行者');
  await recovered.getByRole('button', { name: '继续这段旅程' }).click();
  await expect(recovered).toHaveURL(/\/room\/room-.*\/game/);
  await expect(recovered.getByText('当前行动者', { exact: true })).toBeVisible();

  await hostContext.close();
  await recoveredContext.close();
});

