// Shared test base: validates safety guard, loads attachment IDs.
import { test as base, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const __dirname = dirname(fileURLToPath(import.meta.url));
const IDS_FILE = join(__dirname, '..', 'fixtures', '.attachment-ids.json');

async function loadFixtureIds() {
  try { return JSON.parse(await readFile(IDS_FILE, 'utf8')); }
  catch { throw new Error(`Cannot read ${IDS_FILE}. Run \`npm run seed-board\` first.`); }
}

export const test = base.extend({
  // Hard fail if test board ID is missing or unexpected length.
  testBoardId: async ({}, use) => {
    const id = process.env.TRELLO_TEST_BOARD_ID;
    if (!id) throw new Error('TRELLO_TEST_BOARD_ID missing in .env.local');
    if (![8, 24].includes(id.length)) {
      throw new Error(`TRELLO_TEST_BOARD_ID length ${id.length} unexpected — refusing to run`);
    }
    await use(id);
  },

  fixtureIds: async ({}, use) => {
    const ids = await loadFixtureIds();
    await use(ids);
  }
});

// Safety hook: every test must navigate to OUR test board.
// If a test somehow ends up on a different board, fail loudly.
test.beforeEach(async ({ page, testBoardId }) => {
  page.on('framenavigated', frame => {
    const url = frame.url();
    // Only assert on top-level Trello board navigations
    if (frame === page.mainFrame() && /^https:\/\/trello\.com\/b\//.test(url)) {
      if (!url.includes(testBoardId)) {
        throw new Error(
          `Navigated to wrong board: ${url} (expected board ID ${testBoardId})`
        );
      }
    }
  });
});

export { expect };
