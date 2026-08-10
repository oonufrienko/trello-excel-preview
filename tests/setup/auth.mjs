#!/usr/bin/env node
// One-time headed login flow.
// Run: npm run auth
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const STORAGE_PATH = process.env.STORAGE_STATE_PATH || './storageState.json';
const IDS_FILE = './tests/fixtures/.attachment-ids.json';

async function authorizePowerUp(page) {
  const ids = JSON.parse(await readFile(IDS_FILE, 'utf8'));
  const card = Object.values(ids)[0].cardShortLink;
  await page.goto(`https://trello.com/c/${card}`);
  const powerUp = page.frameLocator('iframe[src*="trello-excel-preview"]').first();
  await powerUp.locator('.attachment-item').first().waitFor({ state: 'visible', timeout: 30_000 });
  const frame = page.frames().find(f => f.url().includes('attachments-html'));
  if (!frame) throw new Error('Power-Up attachments frame was not found.');
  return frame.evaluate(async (token) => {
    try { localStorage.removeItem('trello_token'); } catch {}
    const t = window.TrelloPowerUp.iframe({ appKey: window.TRELLO_APP_KEY || '', appName: 'Excel Viewer' });
    await t.set('member', 'private', 'trello_token', token);
    return t.getRestApi().isAuthorized();
  }, process.env.TRELLO_USER_TOKEN);
}

async function main() {
  if (!process.env.TRELLO_USER_TOKEN) {
    throw new Error(
      'TRELLO_USER_TOKEN is required. Add the dedicated account token to .env.local before running npm run auth.'
    );
  }
  if (!existsSync(IDS_FILE)) {
    throw new Error(
      `Fixture IDs are missing at ${IDS_FILE}. Run npm run generate-fixtures and npm run seed-board first.`
    );
  }

  console.log('Opening Trello. Log in manually, then navigate to any board.');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext(
    existsSync(STORAGE_PATH) ? { storageState: STORAGE_PATH } : {}
  );
  const page = await context.newPage();
  await page.goto('https://trello.com/login');
  await page.waitForURL(
    url => /\/b\/[A-Za-z0-9]+/.test(url.toString()) || url.pathname.endsWith('/boards'),
    { timeout: 5 * 60_000 }
  );

  console.log('Login OK. Authorizing the Power-Up REST API.');
  const authorized = await authorizePowerUp(page);
  if (!authorized) {
    throw new Error('Power-Up REST API authorization failed; Preview tests would hang.');
  }
  console.log('Power-Up REST API authorized.');

  await context.storageState({ path: STORAGE_PATH });
  console.log(`Saved auth state to ${STORAGE_PATH}`);
  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
