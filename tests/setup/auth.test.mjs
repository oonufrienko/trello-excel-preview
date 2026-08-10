import assert from 'node:assert/strict';
import test from 'node:test';
import { runAuth } from './auth.mjs';

const missingFixture = './tests/fixtures/missing-attachment-ids.json';

test('missing TRELLO_USER_TOKEN fails before chromium.launch', async () => {
  let launchCalled = false;

  await assert.rejects(
    runAuth({
      env: {},
      fileExists: () => true,
      launch: async () => {
        launchCalled = true;
        throw new Error('chromium.launch should not be called');
      },
    }),
    { message: 'TRELLO_USER_TOKEN is required. Add the dedicated account token to .env.local before running npm run auth.' }
  );

  assert.equal(launchCalled, false);
});

test('missing fixture IDs fail before chromium.launch', async () => {
  let launchCalled = false;

  await assert.rejects(
    runAuth({
      env: { TRELLO_USER_TOKEN: 'test-token' },
      idsFile: missingFixture,
      fileExists: file => file !== missingFixture,
      launch: async () => {
        launchCalled = true;
        throw new Error('chromium.launch should not be called');
      },
    }),
    { message: `Fixture IDs are missing at ${missingFixture}. Run npm run generate-fixtures and npm run seed-board first.` }
  );

  assert.equal(launchCalled, false);
});
