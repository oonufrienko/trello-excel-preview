// globalSetup: verify the saved Trello session is still alive before the
// suite starts. Without this, an expired storageState.json makes all 27
// board tests time out (15s each) against Trello's login wall.
import { request } from '@playwright/test';

export default async function checkSession() {
  const storageState = process.env.STORAGE_STATE_PATH || './storageState.json';
  const ctx = await request.newContext({ storageState, baseURL: 'https://trello.com' });
  let res;
  try {
    res = await ctx.get('/1/members/me');
  } finally {
    await ctx.dispose().catch(() => {});
  }
  if (!res.ok()) {
    throw new Error(
      `Trello session in ${storageState} is invalid or expired ` +
      `(GET /1/members/me -> ${res.status()}).\n` +
      'Fix locally: npm run auth (log in manually).\n' +
      'Fix CI: re-encode the fresh storageState.json as base64 and update the ' +
      'TRELLO_STORAGE_STATE_B64 GitHub secret.'
    );
  }
}
