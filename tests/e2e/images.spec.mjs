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

// Regression for the geometry-based positioning fix: a twoCellAnchor image
// over a tall vertical merge (whose `to` cell sits visually ABOVE the `from`
// cell) used to compute a negative height and get silently dropped. The fix
// sizes from monotonic column/row edges instead of the to/from rect diff, so
// the image must now appear with a sane (non-sliver) size, inside the wrapper.
const TWO_CELL_FIXTURE = 'two-cell-anchor.xlsx';

test(`Images: ${TWO_CELL_FIXTURE} twoCellAnchor over merge renders with sane size`, async ({ page, fixtureIds }) => {
  const info = fixtureIds[TWO_CELL_FIXTURE];
  test.skip(!info, `${TWO_CELL_FIXTURE} not seeded (run npm run generate-fixtures && npm run seed-board)`);

  await page.goto(`https://trello.com/c/${info.cardShortLink}`);
  const powerUp = page.frameLocator('iframe[src*="trello-excel-preview"]').first();
  const row = powerUp.locator('.attachment-item', { hasText: TWO_CELL_FIXTURE });
  await row.waitFor({ state: 'visible' });
  await row.locator('.btn-preview').click();

  const preview = page.frameLocator('iframe[src*="trello-excel-preview"][src*="preview-html"]');
  await expect(preview.locator('table').first()).toBeVisible({ timeout: 15_000 });

  const imgs = preview.locator('.embedded-img');
  await expect(imgs).toHaveCount(1, { timeout: 5000 });

  const wrapperBox = await preview.locator('.sheet-wrapper').boundingBox();
  const imgBox = await imgs.first().boundingBox();
  expect(imgBox, 'image has no bounding box').not.toBeNull();
  // Before the fix this was 0 (dropped) or a few-px sliver. Require a real size.
  expect(imgBox.width, 'image width too small (sliver/dropped)').toBeGreaterThan(20);
  expect(imgBox.height, 'image height too small (sliver/dropped)').toBeGreaterThan(20);
  expect(imgBox.x).toBeGreaterThanOrEqual(wrapperBox.x - 1);
  expect(imgBox.y).toBeGreaterThanOrEqual(wrapperBox.y - 1);
});

// Regression for the images-v2 work (rotation, groups, WMF placeholder).
// The fixture is hand-built (tests/fixtures/real/images-v2.xlsx): anchor 1 is a
// PNG rotated 45° with intrinsic size 50×50 px; anchor 2 is a grpSp group of
// two stacked PNGs; anchor 3 is a real WMF (browser can't decode it → must
// render as a same-size placeholder, not vanish).
const V2_FIXTURE = 'images-v2.xlsx';

test(`Images: ${V2_FIXTURE} rotation, group children and WMF placeholder`, async ({ page, fixtureIds }) => {
  const info = fixtureIds[V2_FIXTURE];
  test.skip(!info, `${V2_FIXTURE} not seeded (run npm run seed-board)`);

  await page.goto(`https://trello.com/c/${info.cardShortLink}`);
  const powerUp = page.frameLocator('iframe[src*="trello-excel-preview"]').first();
  const row = powerUp.locator('.attachment-item', { hasText: V2_FIXTURE });
  await row.waitFor({ state: 'visible' });
  await row.locator('.btn-preview').click();

  const preview = page.frameLocator('iframe[src*="trello-excel-preview"][src*="preview-html"]');
  await expect(preview.locator('table').first()).toBeVisible({ timeout: 15_000 });

  // 3 decodable images: the rotated one + both group children (the group must
  // not collapse to a single image).
  const imgs = preview.locator('img.embedded-img');
  await expect(imgs).toHaveCount(3, { timeout: 5000 });

  // Anchor order is document order: nth(0) is the rotated pic.
  expect(await imgs.nth(0).getAttribute('style')).toContain('rotate(45');
  // Intrinsic size (50×50 px) must win over the anchor-box stretch.
  const rotBox = await imgs.nth(0).boundingBox();
  expect(rotBox.width).toBeGreaterThan(30);
  expect(rotBox.width).toBeLessThan(90); // 50px rotated 45° → bbox ≈ 70px

  // Group children: B sits below A inside the same anchor box.
  const aBox = await imgs.nth(1).boundingBox();
  const bBox = await imgs.nth(2).boundingBox();
  expect(bBox.y).toBeGreaterThan(aBox.y + 5);

  // WMF placeholder: present, labelled, with the pic's intrinsic size (60×40).
  const ph = preview.locator('.embedded-img-missing');
  await expect(ph).toHaveCount(1);
  await expect(ph).toHaveText('WMF');
  const phBox = await ph.boundingBox();
  expect(phBox.width).toBeGreaterThan(40);
  expect(phBox.height).toBeGreaterThan(25);
});
