// Rename via the "⋯" menu persists across reload.
import { test, expect } from './_setup.mjs';

const FIXTURE = 'data.csv';

// Restore the original name over REST, not through the UI. The rename itself
// is what this spec tests; the restore is only cleanup, and doing it in the
// browser made a slow Trello sync leave the board dirty. seed-board matches
// attachments by name in CI, so a leftover renamed-*.csv makes it upload a
// duplicate data.csv on the next run.
test.afterEach(async ({ fixtureIds }) => {
  const info = fixtureIds[FIXTURE];
  const url = new URL(`https://api.trello.com/1/cards/${info.cardId}/attachments/${info.attachmentId}`);
  url.searchParams.set('key', process.env.TRELLO_API_KEY);
  url.searchParams.set('token', process.env.TRELLO_USER_TOKEN);
  url.searchParams.set('name', FIXTURE);
  const res = await fetch(url.toString(), { method: 'PUT' });
  if (!res.ok) throw new Error(`Restoring ${FIXTURE} failed: ${res.status} ${await res.text()}`);
});

test('Rename: prompt → new name persists after reload', async ({ page, fixtureIds }) => {
  const info = fixtureIds[FIXTURE];
  expect(info).toBeTruthy();

  const newName = `renamed-${Date.now()}.csv`;
  page.on('dialog', async d => {
    if (d.type() === 'prompt') await d.accept(newName);
    else await d.dismiss();
  });

  await page.goto(`https://trello.com/c/${info.cardShortLink}`);
  const powerUp = page.frameLocator('iframe[src*="trello-excel-preview"]').first();
  const row = powerUp.locator('.attachment-item', { hasText: FIXTURE });
  await row.waitFor({ state: 'visible' });
  await row.locator('.btn-more').click();
  await page.locator('text=Rename').click();

  // Normally instant: renameAttachment patches the row right after the PUT.
  // The generous timeout only covers the fallback re-render from
  // t.card('attachments') — Trello's client-side model — whose sync can lag
  // the write by tens of seconds. Same lag delete.spec allows 20s for.
  const renamedRow = powerUp.locator('.attachment-item', { hasText: newName });
  await expect(renamedRow).toBeVisible({ timeout: 20_000 });

  // Reload — name persists.
  await page.reload();
  const powerUp2 = page.frameLocator('iframe[src*="trello-excel-preview"]').first();
  const renamedRow2 = powerUp2.locator('.attachment-item', { hasText: newName });
  await expect(renamedRow2).toBeVisible({ timeout: 20_000 });
});
