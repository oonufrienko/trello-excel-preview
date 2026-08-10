# Refreshing the Trello CI session

The e2e tests use a dedicated Trello account and a Playwright browser state. Trello/Atlassian can revoke that state, so refresh it before the scheduled watchdog or e2e workflow fails.

## Refresh locally

Use the repository checkout and the dedicated Trello account:

```bash
npm ci
npm run generate-fixtures
npm run seed-board
npm run auth
```

`npm run auth` opens Trello for an interactive login and saves `storageState.json`. Do not commit or upload that file anywhere except the GitHub Actions secret described below.

## Update GitHub Actions

In PowerShell from the repository root:

```powershell
$stateB64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes('.\storageState.json'))
$stateB64 | gh secret set TRELLO_STORAGE_STATE_B64 --repo oonufrienko/trello-excel-preview
```

In Git Bash or Linux:

```bash
base64 -w 0 storageState.json | gh secret set TRELLO_STORAGE_STATE_B64 --repo oonufrienko/trello-excel-preview
```

If `base64 -w 0` is unavailable, use:

```bash
base64 storageState.json | tr -d '\n' | gh secret set TRELLO_STORAGE_STATE_B64 --repo oonufrienko/trello-excel-preview
```

Then manually run **trello-session-watchdog** in GitHub Actions. The full e2e workflow should only be re-run after the watchdog passes.

## Security rules

- Keep the Trello password in a password manager; never add it to GitHub or `.env` committed files.
- Keep `storageState.json` local and verify it is ignored by Git.
- Do not download or attach the session state to workflow artifacts.
- Use the dedicated account only for the CI test board.
