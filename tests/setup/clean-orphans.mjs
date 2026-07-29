#!/usr/bin/env node
// Delete orphan attachments left on the test board by interrupted rename runs.
//
// When rename.spec fails between renaming a fixture and restoring its name,
// the fixture stays renamed (e.g. data.csv -> renamed-<timestamp>.csv).
// seed-board then re-uploads a fresh data.csv but never removes the orphan,
// so the card slowly fills with renamed-*.csv attachments that break the
// e2e locators. Run this once to sweep them off every "Test Fixtures" card.
//
// Only attachments whose name matches renamed-<digits>.<ext> are deleted —
// the canonical fixtures (data.csv, *.xlsx, ...) are left untouched.
//
// Run: npm run clean-orphans
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const ORPHAN_RE = /^renamed-\d+\.[A-Za-z0-9]+$/;

const { TRELLO_API_KEY, TRELLO_USER_TOKEN, TRELLO_TEST_BOARD_ID } = process.env;

function requireEnv() {
  const missing = [];
  if (!TRELLO_API_KEY) missing.push('TRELLO_API_KEY');
  if (!TRELLO_USER_TOKEN) missing.push('TRELLO_USER_TOKEN');
  if (!TRELLO_TEST_BOARD_ID) missing.push('TRELLO_TEST_BOARD_ID');
  if (missing.length) {
    console.error('Missing env vars in .env.local:', missing.join(', '));
    process.exit(1);
  }
  // Safety guard: refuse to run against an unexpected board.
  if (TRELLO_TEST_BOARD_ID.length !== 24 && TRELLO_TEST_BOARD_ID.length !== 8) {
    console.error('TRELLO_TEST_BOARD_ID looks wrong:', TRELLO_TEST_BOARD_ID);
    process.exit(1);
  }
}

async function trello(method, path, params = {}) {
  const url = new URL(`https://api.trello.com/1${path}`);
  url.searchParams.set('key', TRELLO_API_KEY);
  url.searchParams.set('token', TRELLO_USER_TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { method });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function main() {
  requireEnv();
  console.log(`Cleaning orphan attachments from board ${TRELLO_TEST_BOARD_ID}`);

  const board = await trello('GET', `/boards/${TRELLO_TEST_BOARD_ID}`, { fields: 'id,name' });
  console.log(`  board: ${board.name} (id ${board.id})`);

  const lists = await trello('GET', `/boards/${board.id}/lists`);
  const list = lists.find(l => l.name === 'Test Fixtures');
  if (!list) {
    console.log('  No "Test Fixtures" list — nothing to clean.');
    return;
  }

  const cards = await trello('GET', `/lists/${list.id}/cards`, { fields: 'id,name,shortLink' });
  let deleted = 0;
  for (const card of cards) {
    const atts = await trello('GET', `/cards/${card.id}/attachments`, { fields: 'id,name' });
    const orphans = atts.filter(a => ORPHAN_RE.test(a.name));
    for (const o of orphans) {
      await trello('DELETE', `/cards/${card.id}/attachments/${o.id}`);
      console.log(`  − ${card.name}: deleted ${o.name}`);
      deleted++;
    }
  }

  console.log(deleted ? `Done. Removed ${deleted} orphan attachment(s).` : 'Done. No orphans found.');
}

main().catch(err => { console.error(err); process.exit(1); });
