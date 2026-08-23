import { expect, test } from '@playwright/test';

import AxeBuilder from '@axe-core/playwright';

test('two devices can join, ready, and start a room', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  await host.goto('/');
  await host.getByRole('button', { name: '自定义旅程' }).click();
  await host.getByRole('button', { name: '多设备房间' }).click();
  await host.locator('.scenario-options > button').first().click();
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
  await expect(host.locator('.game-viewport')).toBeVisible();
  await expect(guest.locator('.game-viewport')).toBeVisible();
  const roomResults = await new AxeBuilder({ page: host }).include('.game-viewport').analyze();
  const roomSerious = roomResults.violations.filter(item => item.impact === 'serious' || item.impact === 'critical');
  expect(roomSerious, roomSerious.map(item => `${item.id}: ${item.help}`).join('\\n')).toEqual([]);
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
  await host.getByRole('button', { name: '自定义旅程' }).click();
  await host.getByRole('button', { name: '多设备房间' }).click();
  await host.locator('.scenario-options > button').first().click();
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
  await expect(host.locator('.game-viewport')).toBeVisible();
  await expect(guest.locator('.game-viewport')).toBeVisible();
  const tutorialClose = host.getByRole('button', { name: /^(跳过，自己探索|知道了)$/ }).first();
  if (await tutorialClose.isVisible()) await tutorialClose.click();

  const syncContext = await host.evaluate(() => {
    const roomId = location.pathname.split('/')[2];
    const token = sessionStorage.getItem(`yungang-room-token:${roomId}`) || '';
    return { roomId, token };
  });
  const before = await host.evaluate(async ({ roomId, token }) => (await fetch(`/api/rooms/${roomId}/game`, { headers: { 'X-Seat-Token': token } })).json(), syncContext);
  const move = host.getByRole('button', { name: /^移动/ }).first();
  await expect(move).toBeVisible();
  await move.click();
  const actionTutorial = host.getByRole('button', { name: /^(跳过，自己探索|知道了)$/ }).first();
  if (await actionTutorial.isVisible()) {
    try {
      await actionTutorial.click({ timeout: 1000 });
    } catch {
      await expect(actionTutorial).toBeHidden({ timeout: 1000 });
    }
  }
  const preview = host.locator('.action-preview');
  await expect(preview).toBeVisible();
  await preview.getByRole('button', { name: /踏上这一步/ }).click();
  await expect(preview).toBeHidden();
  const after = await host.evaluate(async ({ roomId, token }) => (await fetch(`/api/rooms/${roomId}/game`, { headers: { 'X-Seat-Token': token } })).json(), syncContext);
  expect(after.revision).toBeGreaterThan(before.revision);
  expect(after.players[after.shared.active_player_id].location).not.toBe(before.players[before.shared.active_player_id].location);
  const expectedSync = {
    revision: after.revision,
    event: after.shared.current_event_id,
    activePlayer: after.shared.active_player_id,
    players: Object.fromEntries(Object.entries(after.players).map(([id, player]) => [id, { name: player.name, role_id: player.role_id, location: player.location, hand: player.hand, action_hand: player.action_hand }]))
  };

  await guestContext.close();
  const recovered = await recoveredContext.newPage();
  await recovered.goto(roomUrl);
  await expect(recovered.getByText('恢复同行席位', { exact: true })).toBeVisible();
  await expect(recovered.getByLabel('恢复席位')).toContainText('同行者');
  await recovered.getByRole('button', { name: '继续这段旅程' }).click();
  await expect(recovered).toHaveURL(/\/room\/room-.*\/game/);
  await expect(recovered.getByText('当前行动者', { exact: true })).toBeVisible();
  const recoveredContextState = await recovered.evaluate(async ({ roomId, expectedRevision, expectedLocation }) => {
    const token = sessionStorage.getItem(`yungang-room-token:${roomId}`) || '';
    const state = await (await fetch(`/api/rooms/${roomId}/game`, { headers: { 'X-Seat-Token': token } })).json();
    return { revision: state.revision, location: state.players[state.shared.active_player_id].location, event: state.shared.current_event_id, activePlayer: state.shared.active_player_id, players: Object.fromEntries(Object.entries(state.players).map(([id, player]) => [id, { name: player.name, role_id: player.role_id, location: player.location, hand: player.hand, action_hand: player.action_hand }])), expectedRevision, expectedLocation };
  }, { roomId: syncContext.roomId, expectedRevision: after.revision, expectedLocation: after.players[after.shared.active_player_id].location });
  expect(recoveredContextState.revision).toBe(expectedSync.revision);
  expect(recoveredContextState.location).toBe(expectedSync.players[expectedSync.activePlayer].location);
  expect(recoveredContextState.event).toBe(expectedSync.event);
  expect(recoveredContextState.activePlayer).toBe(expectedSync.activePlayer);
  expect(recoveredContextState.players).toEqual(expectedSync.players);

  await hostContext.close();
  await recoveredContext.close();
});

