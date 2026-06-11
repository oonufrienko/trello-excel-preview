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
    // sheet_to_html tags cells id="excel-table-A1"; address is the suffix.
    for (const td of table.querySelectorAll('td[id]')) {
      const w = td.style.fontWeight;
      if (w === '700' || w === 'bold') bold++;
      if (td.style.backgroundColor) filled++;
    }
    return { bold, filled };
  });

  expect(counts.bold, 'expected at least one bold cell').toBeGreaterThan(0);
  expect(counts.filled, 'expected at least one filled cell').toBeGreaterThan(0);
});

// Regression for theme-palette colors: colorOf() previously read only the
// rgb= attribute, so fills written as <fgColor theme="8" tint="0.4"/> (what
// Excel's default color picker produces) were silently dropped. The fixture
// styles cells with theme+tint fills, one direct ARGB fill, and a theme-1
// (default text) font color that must stay unresolved for dark mode.
// Expected values come from the same HSL tint formula preview.js uses,
// applied to ExcelJS's default (Office 2007) theme palette.
const THEME_FIXTURE = 'theme-colors.xlsx';

test(`Cell styles: ${THEME_FIXTURE} resolves theme+tint colors`, async ({ page, fixtureIds }) => {
  const info = fixtureIds[THEME_FIXTURE];
  test.skip(!info, `${THEME_FIXTURE} not seeded (npm run generate-fixtures && npm run seed-board)`);

  await page.goto(`https://trello.com/c/${info.cardShortLink}`);

  const powerUp = page.frameLocator('iframe[src*="trello-excel-preview"]').first();
  const row = powerUp.locator('.attachment-item', { hasText: THEME_FIXTURE });
  await row.waitFor({ state: 'visible' });
  await row.locator('.btn-preview').click();

  const modal = page.frameLocator('iframe[src*="trello-excel-preview"][src*="preview-html"]');
  await expect(modal.locator('table').first()).toBeVisible({ timeout: 15_000 });

  const styles = await modal.locator('table').first().evaluate((table) => {
    const cell = (addr) => table.querySelector(`td[id$="-${addr}"]`);
    const bg = (addr) => cell(addr)?.style.backgroundColor ?? null;
    return {
      a1bg: bg('A1'), a2bg: bg('A2'), b2bg: bg('B2'),
      a1color: cell('A1')?.style.color ?? null,
      a3color: cell('A3')?.style.color ?? null,
    };
  });

  expect(styles.a1bg, 'A1: accent5 + tint 0.4').toBe('rgb(147, 205, 221)');
  expect(styles.a2bg, 'A2: white + tint -0.15').toBe('rgb(217, 217, 217)');
  expect(styles.b2bg, 'B2: direct ARGB fill').toBe('rgb(255, 192, 0)');
  expect(styles.a3color, 'A3: accent2 font color').toBe('rgb(192, 80, 77)');
  expect(styles.a1color, 'A1: theme-1 font color must stay default').toBe('');
});
