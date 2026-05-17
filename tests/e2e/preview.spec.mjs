// Smoke test: clicking Preview opens the modal and renders a table.
import { test, expect } from './_setup.mjs';

const CASES = [
  'multi-sheet.xlsx',
  'with-images-multi.xlsx',
  'oversized-dim.xlsx',
  'data.csv'
];

for (const fixture of CASES) {
  test(`Preview: ${fixture} renders without console errors`, async ({ page, fixtureIds }) => {
    const info = fixtureIds[fixture];
    expect(info, `Fixture ${fixture} not seeded`).toBeTruthy();

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`https://trello.com/c/${info.cardShortLink}`);

    const powerUp = page.frameLocator('iframe[src*="trello-excel-preview"]').first();
    await powerUp.locator(`text=${fixture}`).first().waitFor({ state: 'visible' });
    await powerUp.locator(`text=${fixture}`).first().locator('..').locator('text=Preview').click();

    // Preview modal iframe
    const previewModal = page.frameLocator('iframe[src*="trello-excel-preview"][src*="preview-html"]');
    // Either a table renders, or an empty/too-large message.
    await expect(
      previewModal.locator('table, .empty-state').first()
    ).toBeVisible({ timeout: 15_000 });

    // Critical: no uncaught console errors from our own scripts.
    const ourErrors = consoleErrors.filter(e =>
      e.includes('preview.js') || e.includes('attachments.js')
    );
    expect(ourErrors, ourErrors.join('\n')).toEqual([]);
  });
}
