# Release / Marketplace Submission Checklist

This document is the **handover** for shipping Simple Excel Preview to the Atlassian Marketplace. It lists what is automated/ready and what the publisher (Oleksandr) must do manually in browser UIs we can't drive from CI.

## ✅ Ready in this repo

| Artifact | Location |
|---|---|
| Privacy Policy (EN + UA) | `privacy.html` → deployed at `https://trello-excel-preview.vercel.app/privacy.html` |
| Marketplace icon | `marketing/icon-1024.png` (1024×1024 PNG) |
| Listing copy (name, taglines, long description) | `marketing/listing.md` |
| Changelog (Keep a Changelog format) | `CHANGELOG.md` |
| Versioning | `package.json` → `1.0.0` |
| `/api/health` for uptime monitoring | `https://trello-excel-preview.vercel.app/api/health` |
| Rate limit on `/api/proxy` | 30 req/min/IP, returns `429` with `Retry-After` |
| E2E tests | `tests/e2e/*.spec.mjs` + GitHub Actions workflow on PR |

## 🟡 Manual steps that need a browser

These cannot be done from CI/CLI — they require the developer to log into the relevant admin UI.

### 1. Take 4–5 production screenshots (1280×720)

Open https://trello-excel-preview.vercel.app/ via the Trello Power-Up on a test card, capture:

- [ ] **Excel files section on a card** — list with Preview + ⋯ buttons.
- [ ] **Preview modal — multi-sheet xlsx** — tabs visible, table rendered.
- [ ] **Preview modal — embedded images** — catalog file with photos on the table.
- [ ] **Actions popup** — ⋯ menu open showing Download / Rename / Delete.
- [ ] *(Optional)* **413 too-large state** — error UI for files > 25 MB.

Use macOS Cmd+Shift+4, crop to 1280×720, save as PNG. Drop them into `marketing/screenshots/` (gitignored — they're submitted directly to Marketplace).

### 2. Trello Power-Up admin (https://trello.com/power-ups/admin)

- [ ] Confirm **Iframe Connector URL** = `https://trello-excel-preview.vercel.app/`
- [ ] Confirm **Name** = `Simple Excel Preview`
- [ ] Confirm **Author** = `Oleksandr Onufrienko`
- [ ] Confirm **Support contact** email = `onufrienko.alex@gmail.com`
- [ ] Confirm **Privacy Policy URL** = `https://trello-excel-preview.vercel.app/privacy.html`
- [ ] Upload **Icon** = `marketing/icon-1024.png`
- [ ] Set **Capabilities** = at least `attachment-sections`

### 3. Atlassian Marketplace listing form

- [ ] Paste **Tagline** from `marketing/listing.md` (≤ 120 chars).
- [ ] Paste **Long description** from `marketing/listing.md` (≤ 1500 chars).
- [ ] Pick **Category** = `File Management`.
- [ ] Upload screenshots from step 1.
- [ ] Hit Submit. Average review time: 2–4 weeks. Atlassian may come back with revision requests.

### 4. Land the CI workflow

The current `GITHUB_TOKEN` in `.env` has only `repo` scope, not `workflow`. Pushing `.github/workflows/*.yml` requires a token with `workflow`, so this step must happen in a browser or with a re-scoped token. The file is already committed on `feature/e2e-tests` at commit `1805293`.

**Easiest path — GitHub web UI (no token regeneration needed):**

1. Open the file on `feature/e2e-tests`:
   https://github.com/oonufrienko/trello-excel-preview/blob/feature/e2e-tests/.github/workflows/e2e.yml
2. Click **Raw** → **Copy** the full text.
3. Open the **main** branch tree: https://github.com/oonufrienko/trello-excel-preview/tree/main
4. Click **Add file → Create new file**. Name it `.github/workflows/e2e.yml`. Paste the copied content. Commit directly to `main`.
5. **Don't** merge `feature/e2e-tests` into `main` directly — that branch also contains the obsolete `fix(delete)` polling workaround (no longer needed since Trello fixed the backend) and would re-introduce stale code in `js/attachments.js`.

**Alternative — re-scope the local token:**

- [ ] Generate a new GitHub PAT (https://github.com/settings/tokens) with `repo` + `workflow` scopes, replace `GITHUB_TOKEN` in `.env`, then `git checkout feature/e2e-tests -- .github/workflows/e2e.yml` on `main` → commit → push.

**Required GitHub Actions secrets (already noted in `tests/README.md`):**

- `TRELLO_API_KEY`
- `TRELLO_USER_TOKEN`
- `TRELLO_TEST_BOARD_ID`
- `TRELLO_STORAGE_STATE_B64` — base64 of local `storageState.json` (`base64 -i storageState.json | pbcopy`)

After landing, the workflow runs on every PR to `main` and nightly at 03:17 UTC.

### 5. Post-launch operations

- [ ] Add `https://trello-excel-preview.vercel.app/api/health` to UptimeRobot (or any free uptime monitor).
- [ ] Skim Vercel logs weekly for the first month: look for 5xx spikes.
- [ ] When ready to cut a release, tag git: `git tag -a v1.0.1 -m 'Release notes' && git push origin v1.0.1`, then move items from `[Unreleased]` to the new version section in `CHANGELOG.md`.

## 🔵 Known limitations to keep on the public roadmap

- Embedded image positioning may drift slightly from the original Excel layout (more visible on non-first sheets of multi-sheet workbooks; can also affect the first sheet on files with custom column widths or row heights).
- Old `.xls` (BIFF binary) format renders without embedded images.
- Preview is capped at 25 MB (file-size proxy guard).

## Contact

`onufrienko.alex@gmail.com`
