// Regression for cell-styles v2: applyCellStyles previously queried
// td[data-r] but SheetJS sheet_to_html emits id="sjs-A1", so NO style
// was ever applied on real files. This asserts that, after opening a
// real styled workbook, at least some cells carry inline font-weight
// and background-color from xl/styles.xml.
//
// Requires the real fixtures hr_budget.xlsx / sales_report.xlsx seeded
// on the test board (tests/fixtures/real/, gitignored). If they are not
// seeded, the test skips rather than failing the suite.
import { test, expect } from './_setup.mjs';

const STYLED_FIXTURE = 'hr_budget.xlsx';

test(`Cell styles: ${STYLED_FIXTURE} renders bold + filled cells`, async ({ page, fixtureIds }) => {
  const info = fixtureIds[STYLED_FIXTURE];
  test.skip(!info, `${STYLED_FIXTURE} not seeded (drop it into tests/fixtures/real/ and re-seed)`);

  await page.goto(`https://trello.com/c/${info.cardShortLink}`);

  const powerUp = page.frameLocator('iframe[src*="trello-excel-preview"]').first();
  const row = powerUp.locator('.attachment-item', { hasText: STYLED_FIXTURE });
  await row.waitFor({ state: 'visible' });
  await row.locator('.btn-preview').click();

  const modal = page.frameLocator('iframe[src*="trello-excel-preview"][src*="preview-html"]');
  await expect(modal.locator('table').first()).toBeVisible({ timeout: 15_000 });

  // Count cells that received an inline font-weight (bold headers) and
  // an inline background-color (filled totals/headers). Before the fix
  // both counts were 0 because the td[data-r] selector matched nothing.
  const counts = await modal.locator('table').first().evaluate((table) => {
    let bold = 0, filled = 0;
    for (const td of table.querySelectorAll('td[id^="sjs-"]')) {
      const w = td.style.fontWeight;
      if (w === '700' || w === 'bold') bold++;
      if (td.style.backgroundColor) filled++;
    }
    return { bold, filled };
  });

  expect(counts.bold, 'expected at least one bold cell').toBeGreaterThan(0);
  expect(counts.filled, 'expected at least one filled cell').toBeGreaterThan(0);
});
