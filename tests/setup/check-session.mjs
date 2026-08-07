// globalSetup: verify the saved Trello session is still alive before the
// suite starts. Without this, an expired storageState.json makes all 27
// board tests time out (15s each) against Trello's login wall.
import { request } from '@playwright/test';

async function main() {
  const storageState = process.env.STORAGE_STATE_PATH || './storageState.json';
  const ctx = await request.newContext({ storageState, baseURL: 'https://trello.com' });

  try {
    const res = await ctx.get('/1/members/me');

    if (res.ok()) {
      console.log(`Trello session OK (GET /1/members/me -> ${res.status()})`);
      process.exit(0);
    }

    // Not ok: inspect status and response for better diagnostics.
    const status = res.status();
    let body = '';
    try {
      body = await res.text();
    } catch (e) {
      body = `<failed to read response body: ${e.message}>`;
    }

    if (status === 400 || status === 401 || status === 403) {
      // Authentication/authorization style failures -> guide maintainers to rotate secret.
      console.error(
        `AUTH_ERROR: Trello session in ${storageState} is invalid or expired ` +
        `(GET /1/members/me -> ${status}).`
      );
      process.exit(2);
    }

    // Other HTTP errors (rate limit, 5xx, etc) — preserve diagnostics.
    console.error(`HTTP_ERROR: Trello session check returned ${status}. Response body:\n${body}`);
    process.exit(3);
  } catch (err) {
    // Network/exception — preserve full diagnostics to help root-cause analysis.
    console.error(`EXCEPTION: Trello session check threw: ${err && err.message}`);
    if (err && err.stack) console.error(err.stack);
    process.exit(4);
  } finally {
    await ctx.dispose().catch(() => {});
  }
}

main();
