#!/usr/bin/env node
// One-time headed login flow.
// Run: npm run auth
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const STORAGE_PATH = process.env.STORAGE_STATE_PATH || './storageState.json';
const IDS_FILE = './tests/fixtures/.attachment-ids.json';

export function validatePreflight({ env = process.env, idsFile = IDS_FILE, fileExists = existsSync } = {}) {
  if (!env.TRELLO_USER_TOKEN) {
    throw new Error(
      'TRELLO_USER_TOKEN is required. Add the dedicated account token to .env.local before running npm run auth.'
    );
  }
  if (!fileExists(idsFile)) {
    throw new Error(
      `Fixture IDs are missing at ${idsFile}. Run npm run generate-fixtures and npm run seed-board first.`
    );
  }
}

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

export async function runAuth({
  env = process.env,
  idsFile = IDS_FILE,
  storagePath = STORAGE_PATH,
  fileExists = existsSync,
  launch = chromium.launch,
} = {}) {
  validatePreflight({ env, idsFile, fileExists });

  console.log('Opening Trello. Log in manually, then navigate to any board.');
  let browser;
  try {
    browser = await launch({ headless: false });
    const context = await browser.newContext(
      existsSync(storagePath) ? { storageState: storagePath } : {}
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

    await context.storageState({ path: storagePath });
    console.log(`Saved auth state to ${storagePath}`);
  } finally {
    await browser?.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runAuth().catch(err => { console.error(err); process.exit(1); });
}
