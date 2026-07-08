#!/usr/bin/env node
// One-time headed login flow.
// Run: npm run auth
//   - Opens a real Chromium window pointed at https://trello.com/login
//     (reuses storageState.json if present, so you may already be logged in)
//   - Waits for you to log in and reach a Trello board page
//   - Then authorizes the Power-Up REST API automatically (writes
//     TRELLO_USER_TOKEN into member-private pluginData; needs seeded
//     fixtures). Without this, e2e tests that click Preview hang on
//     an authorize() popup nobody approves.
//   - Saves cookies + localStorage to storageState.json (gitignored)
// Re-run when cookies expire (~30 days).
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const STORAGE_PATH = process.env.STORAGE_STATE_PATH || './storageState.json';
const IDS_FILE = './tests/fixtures/.attachment-ids.json';

// Write TRELLO_USER_TOKEN into member-private pluginData — the exact place
// the client lib's authorize() popup flow stores it (tokenStorageKey =
// 'trello_token'). Persists server-side per member+plugin, so this is a
// one-time step; without it openPreview hangs on an authorize() popup.
async function authorizePowerUp(page) {
  const ids = JSON.parse(await readFile(IDS_FILE, 'utf8'));
  const card = Object.values(ids)[0].cardShortLink;
  await page.goto(`https://trello.com/c/${card}`);
  const powerUp = page.frameLocator('iframe[src*="trello-excel-preview"]').first();
  await powerUp.locator('.attachment-item').first().waitFor({ state: 'visible', timeout: 30_000 });
  const frame = page.frames().find(f => f.url().includes('attachments-html'));
  return frame.evaluate(async (token) => {
    // A stale localStorage copy would win over pluginData: the SDK's
    // getToken() re-persists whatever it finds there. Clear it first.
    try { localStorage.removeItem('trello_token'); } catch {}
    const t = window.TrelloPowerUp.iframe({ appKey: window.TRELLO_APP_KEY || '', appName: 'Excel Viewer' });
    // Unconditional set: also heals a stale/mismatched stored token.
    await t.set('member', 'private', 'trello_token', token);
    return t.getRestApi().isAuthorized();
  }, process.env.TRELLO_USER_TOKEN);
}

async function main() {
  console.log('Opening Trello — log in manually, then navigate to any board.');
  console.log('The script auto-detects success when URL contains /b/ or /boards.');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext(
    existsSync(STORAGE_PATH) ? { storageState: STORAGE_PATH } : {}
  );
  const page = await context.newPage();
  await page.goto('https://trello.com/login');

  // Wait until we land on a board or boards listing.
  await page.waitForURL(
    url => /\/b\/[A-Za-z0-9]+/.test(url.toString()) || url.pathname.endsWith('/boards'),
    { timeout: 5 * 60_000 }
  );

  if (process.env.TRELLO_USER_TOKEN && existsSync(IDS_FILE)) {
    console.log('\nLogin OK. Authorizing the Power-Up REST API…');
    try {
      const authorized = await authorizePowerUp(page);
      console.log(authorized
        ? 'Power-Up REST API authorized ✓'
        : 'WARNING: Power-Up not authorized — e2e tests that click Preview will hang.');
    } catch (err) {
      console.warn('WARNING: Power-Up authorization failed:', err.message);
    }
  } else {
    console.warn('TRELLO_USER_TOKEN or seeded fixtures missing — skipped Power-Up REST');
    console.warn('authorization. Run `npm run seed-board` then `npm run auth` again,');
    console.warn('otherwise e2e tests that click Preview will hang.');
  }

  await context.storageState({ path: STORAGE_PATH });
  console.log(`\nSaved auth state to ${STORAGE_PATH}`);
  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
