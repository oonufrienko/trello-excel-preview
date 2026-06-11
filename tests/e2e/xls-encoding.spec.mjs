// Regression for the cp1251 re-read: old BIFF .xls files saved without a
// CODEPAGE record decode with SheetJS's cp1252 default, turning Ukrainian
// text into mojibake ("Ïîñòà÷àëüíèê"). The fixture is a real invoice
// (gitignored tests/fixtures/real/vydatkova-cp1251.xls) — the preview must
// show readable Cyrillic, not the cp1252 misdecode.
import { test, expect } from './_setup.mjs';

const FIXTURE = 'vydatkova-cp1251.xls';

test(`XLS encoding: ${FIXTURE} renders Cyrillic, not cp1252 mojibake`, async ({ page, fixtureIds }) => {
  const info = fixtureIds[FIXTURE];
  test.skip(!info, `${FIXTURE} not seeded (run npm run seed-board)`);

  await page.goto(`https://trello.com/c/${info.cardShortLink}`);
  const powerUp = page.frameLocator('iframe[src*="trello-excel-preview"]').first();
  const row = powerUp.locator('.attachment-item', { hasText: FIXTURE });
  await row.waitFor({ state: 'visible' });
  await row.locator('.btn-preview').click();

  const preview = page.frameLocator('iframe[src*="trello-excel-preview"][src*="preview-html"]');
  const table = preview.locator('table').first();
  await expect(table).toBeVisible({ timeout: 15_000 });

  const text = await table.innerText();
  expect(text, 'Cyrillic must decode via cp1251').toContain('Постачальник');
  expect(text, 'cp1252 mojibake must be gone').not.toContain('Ïîñòà');
});
