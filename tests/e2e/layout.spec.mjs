// Verifies preview layout fixes from feature/preview-layout-fixes:
//  - narrow table is centered (margin: 0 auto on .sheet-wrapper)
//  - grey backdrop visible (body bg != table cell bg)
import { test, expect } from './_setup.mjs';

const FIXTURE = 'simple-2col.xlsx';

test('Layout: narrow table is centered with grey backdrop around it', async ({ page, fixtureIds }) => {
  const info = fixtureIds[FIXTURE];
  expect(info).toBeTruthy();

  await page.goto(`https://trello.com/c/${info.cardShortLink}`);
  const powerUp = page.frameLocator('iframe[src*="trello-excel-preview"]').first();
  const row = powerUp.locator('.attachment-item', { hasText: FIXTURE });
  await row.waitFor({ state: 'visible' });
  await row.locator('.btn-preview').click();

  const preview = page.frameLocator('iframe[src*="trello-excel-preview"][src*="preview-html"]');
  await expect(preview.locator('table').first()).toBeVisible({ timeout: 15_000 });

  // Centering check: gap on the left equals gap on the right (~±20px tolerance).
  const wrapperBox = await preview.locator('.sheet-wrapper').boundingBox();
  const containerBox = await preview.locator('.preview-container').boundingBox();
  expect(wrapperBox).not.toBeNull();
  expect(containerBox).not.toBeNull();
  const leftGap = wrapperBox.x - containerBox.x;
  const rightGap = (containerBox.x + containerBox.width) - (wrapperBox.x + wrapperBox.width);
  expect(Math.abs(leftGap - rightGap), `left=${leftGap} right=${rightGap}`).toBeLessThan(20);

  // Grey backdrop: body background should be #dfe1e6 (not white).
  const bodyBg = await preview.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
  expect(bodyBg).not.toBe('rgb(255, 255, 255)');
});
