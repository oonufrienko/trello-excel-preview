#!/usr/bin/env node
// One-time headed login flow.
// Run: npm run auth
//   - Opens a real Chromium window pointed at https://trello.com/login
//   - Waits for you to log in and reach a Trello board page
//   - Saves cookies + localStorage to storageState.json (gitignored)
// Re-run when cookies expire (~30 days).
import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const STORAGE_PATH = process.env.STORAGE_STATE_PATH || './storageState.json';

async function main() {
  console.log('Opening Trello — log in manually, then navigate to any board.');
  console.log('The script auto-detects success when URL contains /b/ or /boards.');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://trello.com/login');

  // Wait until we land on a board or boards listing.
  await page.waitForURL(
    url => /\/b\/[A-Za-z0-9]+/.test(url.toString()) || url.pathname === '/boards',
    { timeout: 5 * 60_000 }
  );

  await context.storageState({ path: STORAGE_PATH });
  console.log(`\nSaved auth state to ${STORAGE_PATH}`);
  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
