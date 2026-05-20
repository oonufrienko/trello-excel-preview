// Rename via the "⋯" menu persists across reload.
import { test, expect } from './_setup.mjs';

const FIXTURE = 'data.csv';

test('Rename: prompt → new name persists after reload', async ({ page, fixtureIds }) => {
  const info = fixtureIds[FIXTURE];
  expect(info).toBeTruthy();

  const newName = `renamed-${Date.now()}.csv`;
  page.on('dialog', async d => {
    if (d.type() === 'prompt') await d.accept(newName);
    else await d.dismiss();
  });

  await page.goto(`https://trello.com/c/${info.cardShortLink}`);
  const powerUp = page.frameLocator('iframe[src*="trello-excel-preview"]').first();
  const row = powerUp.locator('.attachment-item', { hasText: FIXTURE });
  await row.waitFor({ state: 'visible' });
  await row.locator('.btn-more').click();
  await page.locator('text=Rename').click();

  const renamedRow = powerUp.locator('.attachment-item', { hasText: newName });
  await expect(renamedRow).toBeVisible({ timeout: 8000 });

  // Reload — name persists.
  await page.reload();
  const powerUp2 = page.frameLocator('iframe[src*="trello-excel-preview"]').first();
  const renamedRow2 = powerUp2.locator('.attachment-item', { hasText: newName });
  await expect(renamedRow2).toBeVisible({ timeout: 10_000 });

  // Restore original name so seed-board's idempotency works on re-runs.
  page.removeAllListeners('dialog');
  page.on('dialog', async d => {
    if (d.type() === 'prompt') await d.accept(FIXTURE);
    else await d.dismiss();
  });
  await renamedRow2.locator('.btn-more').click();
  await page.locator('text=Rename').click();
  await expect(powerUp2.locator('.attachment-item', { hasText: FIXTURE })).toBeVisible({ timeout: 8000 });
});
