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
  await powerUp.locator(`text=${FIXTURE}`).first().waitFor({ state: 'visible' });
  await powerUp.locator('.btn-more').first().click();

  const popup = page.frameLocator('iframe[src*="trello-excel-preview"]').nth(1);
  await popup.locator('text=Rename').click();

  await expect(powerUp.locator(`text=${newName}`)).toBeVisible({ timeout: 8000 });

  // Reload card — name still there?
  await page.reload();
  const powerUp2 = page.frameLocator('iframe[src*="trello-excel-preview"]').first();
  await expect(powerUp2.locator(`text=${newName}`)).toBeVisible({ timeout: 10_000 });

  // Restore original name so seed-board's idempotency works on re-runs.
  page.removeAllListeners('dialog');
  page.on('dialog', async d => {
    if (d.type() === 'prompt') await d.accept(FIXTURE);
    else await d.dismiss();
  });
  await powerUp2.locator('.btn-more').first().click();
  const popup2 = page.frameLocator('iframe[src*="trello-excel-preview"]').nth(1);
  await popup2.locator('text=Rename').click();
  await expect(powerUp2.locator(`text=${FIXTURE}`)).toBeVisible({ timeout: 8000 });
});
