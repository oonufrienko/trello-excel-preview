// Charts: bar/line/pie graphicFrames render as SVG from the chart XML's
// cached series data; unsupported types (scatter) get a labelled placeholder.
import { test, expect } from './_setup.mjs';

const FIXTURE = 'with-charts.xlsx';

test('Charts: bar/line/pie render as SVG, scatter shows a placeholder', async ({ page, fixtureIds }) => {
  const info = fixtureIds[FIXTURE];
  expect(info, `Fixture ${FIXTURE} not seeded — run npm run generate-fixtures && npm run seed-board`).toBeTruthy();

  await page.goto(`https://trello.com/c/${info.cardShortLink}`);
  const powerUp = page.frameLocator('iframe[src*="trello-excel-preview"]').first();
  const row = powerUp.locator('.attachment-item', { hasText: FIXTURE });
  await row.waitFor({ state: 'visible' });
  await row.locator('.btn-preview').click();

  const preview = page.frameLocator('iframe[src*="trello-excel-preview"][src*="preview-html"]');
  await expect(preview.locator('table').first()).toBeVisible({ timeout: 15_000 });

  // Four supported charts (bar, line, pie, bar+line combo) → four SVGs.
  const charts = preview.locator('.embedded-chart');
  await expect(charts).toHaveCount(4, { timeout: 10_000 });

  // Bar chart: 8 columns (2 series × 4 categories) + 2 legend swatches
  // share the two series colors.
  const barRects = charts.nth(0).locator('svg rect[fill="#4472c4"], svg rect[fill="#ed7d31"]');
  await expect(barRects).toHaveCount(10);

  // Line chart: one polyline per series.
  await expect(charts.nth(1).locator('svg polyline')).toHaveCount(2);

  // Pie chart: one slice path per category.
  await expect(charts.nth(2).locator('svg path')).toHaveCount(4);

  // Chart titles come from the cached chart XML.
  await expect(charts.nth(0).locator('svg text').first()).toHaveText('Sales by Region');

  // Combo (barChart + lineChart in one plotArea): bars AND a line overlay
  // share one SVG — 4 column rects + 1 polyline.
  await expect(charts.nth(3).locator('svg rect[fill="#4472c4"]')).toHaveCount(5); // 4 bars + legend swatch
  await expect(charts.nth(3).locator('svg polyline')).toHaveCount(1);

  // Scatter is not supported → honest labelled placeholder, not silence.
  await expect(preview.locator('.embedded-img-missing', { hasText: 'CHART' })).toHaveCount(1);
});
