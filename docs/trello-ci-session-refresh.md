# Refreshing the Trello CI session

The e2e tests use a dedicated Trello account and a Playwright browser state. Trello/Atlassian can revoke that state, so refresh it before the scheduled watchdog or e2e workflow fails.

## Refresh locally

Ensure the dedicated account is a member of the CI test board, then create a
read/write Trello user token for that account. Put the local-only values in
`.env.local`:

```dotenv
TRELLO_API_KEY=<Power-Up API key>
TRELLO_USER_TOKEN=<dedicated-account token>
TRELLO_TEST_BOARD_ID=<CI test board ID>
```

Run the commands from the repository checkout:

```bash
npm ci
npm run generate-fixtures
npm run seed-board
npm run auth
```

`npm run auth` opens Trello for an interactive login, refreshes the dedicated
account's Power-Up authorization, and saves `storageState.json`. It fails if
the token or seeded fixture IDs are missing, preventing an apparently valid
browser state from being uploaded without Power-Up authorization.

## Update GitHub Actions

In PowerShell from the repository root:

```powershell
$stateB64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes('.\storageState.json'))
$stateB64 | gh secret set TRELLO_STORAGE_STATE_B64 --repo oonufrienko/trello-excel-preview
$userToken = (Get-Content .\.env.local | Where-Object { $_ -match '^TRELLO_USER_TOKEN=' }) -replace '^TRELLO_USER_TOKEN=', ''
$userToken | gh secret set TRELLO_USER_TOKEN --repo oonufrienko/trello-excel-preview
```

In Git Bash or Linux:

```bash
base64 -w 0 storageState.json | gh secret set TRELLO_STORAGE_STATE_B64 --repo oonufrienko/trello-excel-preview
sed -n 's/^TRELLO_USER_TOKEN=//p' .env.local | gh secret set TRELLO_USER_TOKEN --repo oonufrienko/trello-excel-preview
```

If `base64 -w 0` is unavailable, use:

```bash
base64 storageState.json | tr -d '\n' | gh secret set TRELLO_STORAGE_STATE_B64 --repo oonufrienko/trello-excel-preview
sed -n 's/^TRELLO_USER_TOKEN=//p' .env.local | gh secret set TRELLO_USER_TOKEN --repo oonufrienko/trello-excel-preview
```

Then manually run **trello-session-watchdog** in GitHub Actions. The full e2e workflow should only be re-run after the watchdog passes.

## Security rules

- Keep the Trello password in a password manager; never add it to GitHub or `.env` committed files.
- Keep `storageState.json` local and verify it is ignored by Git.
- Do not download or attach the session state to workflow artifacts.
- Use the dedicated account only for the CI test board.
