// Download via the "⋯" menu triggers a file download via blob.
import { test, expect } from './_setup.mjs';

const FIXTURE = 'simple-2col.xlsx';

test('Download: triggers blob download with original filename', async ({ page, fixtureIds }) => {
  const info = fixtureIds[FIXTURE];
  expect(info).toBeTruthy();

  await page.goto(`https://trello.com/c/${info.cardShortLink}`);
  const powerUp = page.frameLocator('iframe[src*="trello-excel-preview"]').first();
  await powerUp.locator(`text=${FIXTURE}`).first().waitFor({ state: 'visible' });
  await powerUp.locator('.btn-more').first().click();

  const popup = page.frameLocator('iframe[src*="trello-excel-preview"]').nth(1);

  const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
  await popup.locator('text=Download').click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe(FIXTURE);
});
