// Preview header bar (inside the preview iframe): print button triggers
// window.print(), donate link points to Ko-fi and opens in a new tab.
// Also covers the "Added:" upload date line under each file name in the list.
import { test, expect } from './_setup.mjs';

const FIXTURE = 'simple-2col.xlsx';

test('Attachment list shows labelled upload date under the file name', async ({ page, fixtureIds }) => {
  const info = fixtureIds[FIXTURE];
  expect(info).toBeTruthy();

  await page.goto(`https://trello.com/c/${info.cardShortLink}`);
  const powerUp = page.frameLocator('iframe[src*="trello-excel-preview"]').first();
  const row = powerUp.locator('.attachment-item', { hasText: FIXTURE });
  await row.waitFor({ state: 'visible' });

  // Seeded attachments always carry an upload timestamp → label + digits.
  // The label is locale-driven (browser locale): "Added" or "Додано".
  await expect(row.locator('.file-date')).toHaveText(/^(Added|Додано) .*\d/);
});

async function openPreviewFrame(page, info) {
  await page.goto(`https://trello.com/c/${info.cardShortLink}`);
  const powerUp = page.frameLocator('iframe[src*="trello-excel-preview"]').first();
  const row = powerUp.locator('.attachment-item', { hasText: FIXTURE });
  await row.waitFor({ state: 'visible' });
  await row.locator('.btn-preview').click();

  const preview = page.frameLocator('iframe[src*="trello-excel-preview"][src*="preview-html"]');
  await expect(preview.locator('table').first()).toBeVisible({ timeout: 15_000 });
  return preview;
}

test('Print: header print button calls window.print() in the preview iframe', async ({ page, fixtureIds }) => {
  const info = fixtureIds[FIXTURE];
  expect(info).toBeTruthy();

  // Stub print in every frame before any script runs.
  await page.context().addInitScript(() => {
    window.__printed = 0;
    window.print = () => { window.__printed++; };
  });

  const preview = await openPreviewFrame(page, info);
  await preview.locator('#print-btn').click();

  const previewFrame = page
    .frames()
    .find(f => f.url().includes('preview-html'));
  expect(previewFrame).toBeTruthy();
  await expect
    .poll(() => previewFrame.evaluate(() => window.__printed), { timeout: 5_000 })
    .toBe(1);
});

test('Donate: header link points to Ko-fi and opens in a new tab', async ({ page, fixtureIds }) => {
  const info = fixtureIds[FIXTURE];
  expect(info).toBeTruthy();

  const preview = await openPreviewFrame(page, info);
  const donate = preview.locator('#donate-btn');
  await expect(donate).toBeVisible();
  await expect(donate).toHaveAttribute('href', 'https://ko-fi.com/river44');
  await expect(donate).toHaveAttribute('target', '_blank');
  await expect(donate).toHaveAttribute('title', /Support the project/);
});
