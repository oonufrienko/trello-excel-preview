// Regression: deleting an attachment must NOT show an alert about "500" or
// "Failed to delete". Trello's REST API sometimes returns 500 even though
// the deletion succeeded; our code should detect that and stay quiet.
import { test, expect } from './_setup.mjs';

// Use a fixture no other spec depends on; seed-board re-uploads it on next run.
const DELETABLE_FIXTURE = 'large-5mb.xlsx';

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
  const row = powerUp.locator('.attachment-item', { hasText: DELETABLE_FIXTURE });
  await row.waitFor({ state: 'visible' });
  await row.locator('.btn-more').click();

  // t.popup({items}) renders the items via Trello's UI in the main page DOM.
  await page.locator('text=Delete').click();

  // Give the delete + verify-poll path time to complete.
  await page.waitForTimeout(4000);

  // CRITICAL contract — no alert about "500" / "Failed to delete".
  // (Asserted FIRST: an alert means the user-visible bug fired even if the
  // row eventually disappears via Trello's own refresh.)
  const bad = dialogs.find(d => d.type === 'alert' && /500|failed to delete/i.test(d.message));
  expect(bad, `Got unwanted alert: ${bad?.message}`).toBeUndefined();

  // And the row should be gone after Trello's state syncs.
  await expect(row).toBeHidden({ timeout: 8000 });
});
