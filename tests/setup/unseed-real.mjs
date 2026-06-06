#!/usr/bin/env node
// Remove ONLY the cards created for real fixtures ([real] *) from the
// test board, and drop their entries from .attachment-ids.json.
//
// Why a separate manual step (not auto-after-e2e): seed-board makes the
// fixture cards persistent on purpose so the e2e suite is idempotent.
// Deleting them after every run would break the next run. Use this when
// you are done testing with real (private) fixtures and want them off the
// shared board. Generated/synthetic fixture cards are left untouched.
//
// Run: npm run unseed-real
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const IDS_FILE = join(REPO_ROOT, 'tests', 'fixtures', '.attachment-ids.json');

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
  console.log(`Unseeding REAL fixtures from board ${TRELLO_TEST_BOARD_ID}`);

  const board = await trello('GET', `/boards/${TRELLO_TEST_BOARD_ID}`, { fields: 'id,name' });
  console.log(`  board: ${board.name} (id ${board.id})`);

  // Find the "Test Fixtures" list, then delete only cards named "[real] ...".
  const lists = await trello('GET', `/boards/${board.id}/lists`);
  const list = lists.find(l => l.name === 'Test Fixtures');
  if (!list) {
    console.log('  No "Test Fixtures" list — nothing to clean.');
    return;
  }

  const cards = await trello('GET', `/lists/${list.id}/cards`, { fields: 'id,name,shortLink' });
  const realCards = cards.filter(c => c.name.startsWith('[real] '));

  if (!realCards.length) {
    console.log('  No [real] cards found — nothing to delete.');
  }
  for (const c of realCards) {
    await trello('DELETE', `/cards/${c.id}`);
    console.log(`  − deleted card ${c.shortLink}  ${c.name}`);
  }

  // Drop real-fixture entries from the ids file so a later seed re-creates
  // them cleanly if needed.
  try {
    const ids = JSON.parse(await readFile(IDS_FILE, 'utf8'));
    let removed = 0;
    for (const [name, info] of Object.entries(ids)) {
      if (info && info.kind === 'real') { delete ids[name]; removed++; }
    }
    if (removed) {
      await writeFile(IDS_FILE, JSON.stringify(ids, null, 2), 'utf8');
      console.log(`  cleaned ${removed} real entr${removed === 1 ? 'y' : 'ies'} from .attachment-ids.json`);
    }
  } catch { /* ids file absent — nothing to prune */ }

  console.log('Done. Generated/synthetic fixtures left untouched.');
}

main().catch(err => { console.error(err); process.exit(1); });
