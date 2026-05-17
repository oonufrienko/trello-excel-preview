# e2e tests

Playwright e2e suite. Tests interact with a dedicated test Trello board
(safety guard refuses any other board ID).

## Prerequisites

```bash
brew install node
npm install
npx playwright install chromium
```

## Setup (one-time)

1. Create a private Trello board named "Power-Up Excel Preview — Tests".
2. Add the Excel Preview Power-Up to it (Show Menu → Power-Ups → enable).
3. Copy the board short ID from the URL (`https://trello.com/b/{SHORTID}/...`).
4. Generate a fresh user token at:
   ```
   https://trello.com/1/authorize?expiration=never&name=Excel-Preview-Tests&scope=read,write&response_type=token&key=eaa6d0d7c57218139af1b772bbd777cb
   ```
   Approve, copy the token shown on the next page.
5. Copy `.env.local.example` → `.env.local` and fill in:
   - `TRELLO_API_KEY` — same as in `.env` (Power-Up key)
   - `TRELLO_USER_TOKEN` — the fresh token from step 4
   - `TRELLO_TEST_BOARD_ID` — short ID from step 3
6. Log in to Trello once via Playwright (saves cookies to `storageState.json`):
   ```bash
   npm run auth
   ```

## Running

```bash
npm run generate-fixtures   # build synthetic xlsx into tests/fixtures/generated/
npm run seed-board          # upload them as attachments on test cards
npm run test:e2e            # headless run
npm run test:e2e:headed     # watch the browser
npm run test:e2e:ui         # Playwright UI for debugging
```

## Fixtures

- `tests/fixtures/generated/` — produced by `npm run generate-fixtures`
  (synthetic, repeatable; gitignored).
- `tests/fixtures/real/` — drop your own production-like files here (gitignored).
  `seed-board` uploads both directories.

## Safety guard

`tests/e2e/_setup.mjs` validates `TRELLO_TEST_BOARD_ID` and refuses to run
if it's missing or unexpected length. Every test asserts the page URL
contains the configured board ID before any destructive action.

## CI

`.github/workflows/e2e.yml` runs the suite on PR to main. Required GitHub
secrets:

- `TRELLO_API_KEY`
- `TRELLO_USER_TOKEN`
- `TRELLO_TEST_BOARD_ID`
- `TRELLO_STORAGE_STATE_B64` — base64 of `storageState.json`:
  ```bash
  base64 -i storageState.json | pbcopy
  ```
  Paste into GitHub repo → Settings → Secrets → Actions.
