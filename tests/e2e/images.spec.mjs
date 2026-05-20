// Verify that embedded images appear on each sheet of with-images-multi.xlsx.
// This is the test that should catch the "drift on non-first sheets" follow-up.
import { test, expect } from './_setup.mjs';

const FIXTURE = 'with-images-multi.xlsx';

test('Images: one image per sheet appears for all 3 sheets', async ({ page, fixtureIds }) => {
  const info = fixtureIds[FIXTURE];
  expect(info).toBeTruthy();

  await page.goto(`https://trello.com/c/${info.cardShortLink}`);
  const powerUp = page.frameLocator('iframe[src*="trello-excel-preview"]').first();
  const row = powerUp.locator('.attachment-item', { hasText: FIXTURE });
  await row.waitFor({ state: 'visible' });
  await row.locator('.btn-preview').click();

  const preview = page.frameLocator('iframe[src*="trello-excel-preview"][src*="preview-html"]');
  await expect(preview.locator('table').first()).toBeVisible({ timeout: 15_000 });

  for (const sheetName of ['Sheet1', 'Sheet2', 'Sheet3']) {
    // Click the tab if it exists
    const tab = preview.locator('.sheet-tab', { hasText: sheetName });
    if (await tab.count()) await tab.click();

    const imgs = preview.locator('.embedded-img');
    await expect(imgs).toHaveCount(1, { timeout: 5000 });

    // Image must be inside the visible sheet-wrapper rect (sanity check that
    // positioning didn't push it outside).
    const wrapperBox = await preview.locator('.sheet-wrapper').boundingBox();
    const imgBox = await imgs.first().boundingBox();
    expect(wrapperBox, 'sheet-wrapper not visible').not.toBeNull();
    expect(imgBox, 'image has no bounding box').not.toBeNull();
    expect(imgBox.x).toBeGreaterThanOrEqual(wrapperBox.x - 1);
    expect(imgBox.y).toBeGreaterThanOrEqual(wrapperBox.y - 1);
  }
});
