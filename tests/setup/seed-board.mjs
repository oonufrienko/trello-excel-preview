#!/usr/bin/env node
// Upload fixture files as Trello attachments on the test board.
// Idempotent: tracks IDs in tests/fixtures/.attachment-ids.json.
// Run: npm run seed-board
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const FIXTURES_ROOT = join(REPO_ROOT, 'tests', 'fixtures');
const IDS_FILE = join(FIXTURES_ROOT, '.attachment-ids.json');

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
  if (TRELLO_TEST_BOARD_ID.length !== 24 && TRELLO_TEST_BOARD_ID.length !== 8) {
    console.error('TRELLO_TEST_BOARD_ID looks wrong (expected 8 or 24 chars):', TRELLO_TEST_BOARD_ID);
    process.exit(1);
  }
}

async function trello(method, path, params = {}, body) {
  const url = new URL(`https://api.trello.com/1${path}`);
  url.searchParams.set('key', TRELLO_API_KEY);
  url.searchParams.set('token', TRELLO_USER_TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    method,
    headers: body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
    body: body && !(body instanceof FormData) ? JSON.stringify(body) : body
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function findOrCreateList(boardId, name) {
  const lists = await trello('GET', `/boards/${boardId}/lists`);
  const existing = lists.find(l => l.name === name);
  if (existing) return existing;
  return trello('POST', '/lists', { name, idBoard: boardId });
}

async function findOrCreateCard(listId, name) {
  const cards = await trello('GET', `/lists/${listId}/cards`);
  const existing = cards.find(c => c.name === name);
  if (existing) return existing;
  return trello('POST', '/cards', { idList: listId, name });
}

async function uploadAttachment(cardId, filePath) {
  const fileBuf = await readFile(filePath);
  const fileName = basename(filePath);
  const form = new FormData();
  form.append('name', fileName);
  form.append('file', new Blob([fileBuf]), fileName);
  const url = new URL(`https://api.trello.com/1/cards/${cardId}/attachments`);
  url.searchParams.set('key', TRELLO_API_KEY);
  url.searchParams.set('token', TRELLO_USER_TOKEN);
  const res = await fetch(url.toString(), { method: 'POST', body: form });
  if (!res.ok) throw new Error(`upload ${fileName} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function attachmentExists(cardId, attachmentId) {
  try {
    await trello('GET', `/cards/${cardId}/attachments/${attachmentId}`);
    return true;
  } catch { return false; }
}

async function loadIdsFile() {
  try { return JSON.parse(await readFile(IDS_FILE, 'utf8')); }
  catch { return {}; }
}

async function listFixtures() {
  const out = [];
  for (const sub of ['generated', 'real']) {
    const dir = join(FIXTURES_ROOT, sub);
    let entries;
    try { entries = await readdir(dir); } catch { continue; }
    for (const f of entries) {
      const full = join(dir, f);
      const s = await stat(full);
      if (s.isFile() && !f.startsWith('.')) out.push({ file: f, fullPath: full, kind: sub });
    }
  }
  return out;
}

async function main() {
  requireEnv();
  console.log(`Seeding board ${TRELLO_TEST_BOARD_ID}`);

  // Trello list/card creation requires the long board ID, not the short link
  const board = await trello('GET', `/boards/${TRELLO_TEST_BOARD_ID}`, { fields: 'id,name' });
  console.log(`  board: ${board.name} (id ${board.id})`);

  const fixtures = await listFixtures();
  if (!fixtures.length) {
    console.error('No fixtures found. Run `npm run generate-fixtures` first.');
    process.exit(1);
  }

  const ids = await loadIdsFile();
  const list = await findOrCreateList(board.id, 'Test Fixtures');

  for (const fx of fixtures) {
    const cardName = `[${fx.kind}] ${fx.file}`;
    const card = await findOrCreateCard(list.id, cardName);

    const cached = ids[fx.file];
    if (cached && cached.cardId === card.id && await attachmentExists(card.id, cached.attachmentId)) {
      console.log(`  ✓ ${fx.file} (cached)`);
      continue;
    }

    const att = await uploadAttachment(card.id, fx.fullPath);
    ids[fx.file] = { cardId: card.id, cardShortLink: card.shortLink, attachmentId: att.id, kind: fx.kind };
    console.log(`  + ${fx.file} → card ${card.shortLink} att ${att.id}`);
  }

  await writeFile(IDS_FILE, JSON.stringify(ids, null, 2), 'utf8');
  console.log(`Saved ${IDS_FILE}`);
}

main().catch(err => { console.error(err); process.exit(1); });
