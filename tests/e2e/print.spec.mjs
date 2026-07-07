// Print button: printer action in the Trello modal header triggers
// window.print() inside the preview iframe (bridged via BroadcastChannel).
// Also covers the upload date line shown under each file name in the list.
import { test, expect } from './_setup.mjs';

const FIXTURE = 'simple-2col.xlsx';

test('Attachment list shows upload date under the file name', async ({ page, fixtureIds }) => {
  const info = fixtureIds[FIXTURE];
  expect(info).toBeTruthy();

  await page.goto(`https://trello.com/c/${info.cardShortLink}`);
  const powerUp = page.frameLocator('iframe[src*="trello-excel-preview"]').first();
  const row = powerUp.locator('.attachment-item', { hasText: FIXTURE });
  await row.waitFor({ state: 'visible' });

  // Seeded attachments always carry an upload timestamp → non-empty, has digits.
  await expect(row.locator('.file-date')).toHaveText(/\d/);
});

test('Print: header printer action calls window.print() in the preview iframe', async ({ page, fixtureIds }) => {
  const info = fixtureIds[FIXTURE];
  expect(info).toBeTruthy();

  // Stub print in every frame before any script runs.
  await page.context().addInitScript(() => {
    window.__printed = 0;
    window.print = () => { window.__printed++; };
  });

  await page.goto(`https://trello.com/c/${info.cardShortLink}`);
  const powerUp = page.frameLocator('iframe[src*="trello-excel-preview"]').first();
  const row = powerUp.locator('.attachment-item', { hasText: FIXTURE });
  await row.waitFor({ state: 'visible' });
  await row.locator('.btn-preview').click();

  const preview = page.frameLocator('iframe[src*="trello-excel-preview"][src*="preview-html"]');
  await expect(preview.locator('table').first()).toBeVisible({ timeout: 15_000 });

  // The printer action lives in Trello's modal chrome (top-level page).
  const printButton = page
    .locator('button:has(img[alt="Print"]), a:has(img[alt="Print"]), img[alt="Print"]')
    .first();
  await printButton.waitFor({ state: 'visible' });
  await printButton.click();

  const previewFrame = page
    .frames()
    .find(f => f.url().includes('preview-html'));
  expect(previewFrame).toBeTruthy();
  await expect
    .poll(() => previewFrame.evaluate(() => window.__printed), { timeout: 5_000 })
    .toBe(1);
});
