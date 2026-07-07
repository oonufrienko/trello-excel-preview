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
  },

  // If PREVIEW_HOST is set, transparently rewrite all requests to
  // trello-excel-preview.vercel.app -> that host. Lets the suite validate
  // a preview deploy without touching the Trello Power-Up admin config.
  //
  // Also installs a securitypolicyviolation listener in every frame, so
  // CSP blocks emit a clearly-tagged console.error caught by the
  // cspViolations fixture. Without this, source-map fetches and other
  // browser-internal CSP blocks only surface when DevTools is open.
  context: async ({ context }, use) => {
    const previewHost = process.env.PREVIEW_HOST;
    if (previewHost) {
      // fetch+fulfill (not continue) so the frame keeps the production
      // origin: the Power-Up REST token lives in localStorage keyed by
      // that origin, and signed URLs embed it too.
      await context.route('https://trello-excel-preview.vercel.app/**', async route => {
        const u = new URL(route.request().url());
        u.host = previewHost;
        const response = await route.fetch({ url: u.toString() });
        return route.fulfill({ response });
      });
    }
    await context.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => {
        console.error(
          `[csp-violation] ${e.violatedDirective} blocked ${e.blockedURI} (source: ${e.sourceFile || 'inline'})`
        );
      });
    });
    await use(context);
  },

  // Auto-collect CSP violations + general console errors per test.
  // Capture from page + every subframe (the Power-Up iframe is where
  // violations would fire). Tests can assert: expect(cspViolations).toEqual([]).
  cspViolations: async ({ page }, use) => {
    const violations = [];
    const isCsp = (text) => /Content Security Policy|Refused to (load|execute|connect|frame|apply)|\[csp-violation\]/i.test(text);
    page.on('console', msg => {
      if (msg.type() === 'error' && isCsp(msg.text())) violations.push(msg.text());
    });
    page.on('pageerror', err => {
      if (isCsp(err.message)) violations.push(err.message);
    });
    await use(violations);
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
