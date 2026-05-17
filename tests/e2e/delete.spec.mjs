// Regression: deleting an attachment must NOT show an alert about "500" or
// "Failed to delete". Trello's REST API sometimes returns 500 even though
// the deletion succeeded; our code should detect that and stay quiet.
import { test, expect } from './_setup.mjs';

// We need a fixture that's safe to delete and re-upload. The seed script
// re-uploads anything missing on each run, so destroying a fixture between
// test runs is fine.
const DELETABLE_FIXTURE = 'simple-2col.xlsx';

test('Delete: no "500" alert when Trello returns 500-but-deleted', async ({ page, fixtureIds }) => {
  const info = fixtureIds[DELETABLE_FIXTURE];
  expect(info, `Fixture ${DELETABLE_FIXTURE} not seeded`).toBeTruthy();

  // Collect any dialogs Trello/page shows during the test.
  const dialogs = [];
  page.on('dialog', async d => {
    dialogs.push({ type: d.type(), message: d.message() });
    // Accept confirm; dismiss alert so it doesn't block.
    if (d.type() === 'confirm') await d.accept();
    else await d.dismiss();
  });

  await page.goto(`https://trello.com/c/${info.cardShortLink}`);

  // Power-Up "Excel Files" attachment-section iframe
  const powerUp = page.frameLocator('iframe[src*="trello-excel-preview"]').first();

  // Click "⋯" on our fixture row.
  await powerUp.locator(`text=${DELETABLE_FIXTURE}`).first().waitFor({ state: 'visible' });
  await powerUp.locator('.btn-more').first().click();

  // Trello opens a popup as a NEW iframe — find it and click Delete inside.
  const popup = page.frameLocator('iframe[src*="trello-excel-preview"]').nth(1);
  await popup.locator('text=Delete').click();

  // The row should disappear from the list within a few seconds.
  await expect(powerUp.locator(`text=${DELETABLE_FIXTURE}`)).toBeHidden({ timeout: 8000 });

  // CRITICAL: no alert mentioning "500" or "Failed to delete".
  const bad = dialogs.find(d => d.type === 'alert' && /500|failed to delete/i.test(d.message));
  expect(bad, `Got unwanted alert: ${bad?.message}`).toBeUndefined();
});
