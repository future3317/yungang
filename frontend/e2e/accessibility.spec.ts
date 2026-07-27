import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('landing has no serious or critical axe findings', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(item => item.impact === 'serious' || item.impact === 'critical');
  expect(serious, serious.map(item => `${item.id}: ${item.help}`).join('\n')).toEqual([]);
});

