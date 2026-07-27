import { expect, test } from '@playwright/test';

test('two devices can join, ready, and start a room', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  await host.goto('/');
  await host.getByRole('button', { name: '多设备房间' }).click();
  await host.getByLabel('你的名字').fill('房主');
  await host.getByRole('button', { name: '进入 Lobby' }).click();
  await expect(host).toHaveURL(/\/room\/room-/);
  const roomUrl = host.url();
  await guest.goto(roomUrl);
  await guest.getByLabel('你的名字').fill('同行者');
  await guest.getByRole('button', { name: '加入席位' }).click();
  await expect(guest.getByRole('button', { name: '准备好了' })).toBeVisible();
  for (const page of [host, guest]) {
    const closeSettings = page.getByRole('button', { name: '关闭设置' });
    if (await closeSettings.isVisible()) await closeSettings.click();
  }
  await host.getByRole('button', { name: '准备好了' }).click();
  await guest.getByRole('button', { name: '准备好了' }).click();
  await host.getByRole('button', { name: '点亮旅程' }).click();
  await expect(host).toHaveURL(/\/room\/room-.*\/game/);
  await expect(guest).toHaveURL(/\/room\/room-.*\/game/);
  await hostContext.close();
  await guestContext.close();
});
