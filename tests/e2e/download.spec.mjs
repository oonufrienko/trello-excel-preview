// Download via the "⋯" menu triggers a file download via blob.
import { test, expect } from './_setup.mjs';

const FIXTURE = 'simple-2col.xlsx';

test('Download: triggers blob download with original filename', async ({ page, fixtureIds }) => {
  const info = fixtureIds[FIXTURE];
  expect(info).toBeTruthy();

  await page.goto(`https://trello.com/c/${info.cardShortLink}`);
  const powerUp = page.frameLocator('iframe[src*="trello-excel-preview"]').first();
  const row = powerUp.locator('.attachment-item', { hasText: FIXTURE });
  await row.waitFor({ state: 'visible' });
  await row.locator('.btn-more').click();

  const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
  await page.locator('text=Download').click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe(FIXTURE);
});
