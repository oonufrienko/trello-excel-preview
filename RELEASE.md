# Release / Marketplace Submission Checklist

This document is the **handover** for shipping Simple Excel Viewer to the Atlassian Marketplace. It lists what is automated/ready and what the publisher (Oleksandr) must do manually in browser UIs we can't drive from CI.

> **Status (2026-06-03): submitted to Atlassian Marketplace, awaiting review.** All manual steps below are done; this file is kept as the record + future-release runbook.

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

### 1. Production screenshots (1280×720) — ✅ DONE

5 screenshots captured into `marketing/screenshots/` (gitignored — submitted directly to Marketplace), plus a demo gif at `marketing/power-up-gif-screenshot.gif`.

### 2. Trello Power-Up admin (https://trello.com/power-ups/admin)

- [ ] Confirm **Iframe Connector URL** = `https://trello-excel-preview.vercel.app/`
- [ ] Confirm **Name** = `Simple Excel Viewer`
- [ ] Confirm **Author** = `Oleksandr Onufrienko`
- [ ] Confirm **Support contact** email = `onufrienko.alex@gmail.com`
- [ ] Confirm **Privacy Policy URL** = `https://trello-excel-preview.vercel.app/privacy.html`
- [ ] Upload **Icon** = `marketing/icon-1024.png`
- [ ] Set **Capabilities** = all five declared in `js/connector.js`: `attachment-sections`, `authorization-status`, `show-authorization`, `show-settings`, `on-enable` (the last four are required by guideline #9 for a Power-Up that authorizes the user for Rename/Delete)
- [ ] Add **Allowed Origins** for the production host (and any Vercel preview hosts used for testing) so `show-authorization` returns succeed

### 3. Atlassian Marketplace listing form

- [ ] Paste **Tagline** from `marketing/listing.md` (≤ 120 chars).
- [ ] Paste **Long description** from `marketing/listing.md` (≤ 1500 chars).
- [ ] Set **Privacy Policy URL** = `https://trello-excel-preview.vercel.app/privacy.html`
- [ ] Set **Terms of Use URL** = `https://trello-excel-preview.vercel.app/terms.html`
- [ ] Pick **Category** = `File Management`.
- [ ] Upload screenshots from step 1.
- [ ] Hit Submit. Average review time: 2–4 weeks. Atlassian may come back with revision requests.

### 4. CI workflow — ✅ DONE

`.github/workflows/e2e.yml` lives on `main` (runs on every PR to `main` and nightly at 03:17 UTC). The local git token was re-scoped with `workflow` permission, so workflow files can now be pushed from the CLI.

**GitHub Actions secrets configured** (repository secrets at Settings → Secrets and variables → Actions):

- `TRELLO_API_KEY`
- `TRELLO_USER_TOKEN`
- `TRELLO_TEST_BOARD_ID`
- `TRELLO_STORAGE_STATE_B64` — base64 of local `storageState.json` (`base64 -i storageState.json | pbcopy`). Regenerate when Trello cookies expire (~30 days) — re-run `npm run auth`, then update this secret.

### 5. Post-launch operations

- [ ] Add `https://trello-excel-preview.vercel.app/api/health` to UptimeRobot (or any free uptime monitor).
- [ ] Skim Vercel logs weekly for the first month: look for 5xx spikes.
- [ ] When ready to cut a release, tag git: `git tag -a v1.0.1 -m 'Release notes' && git push origin v1.0.1`, then move items from `[Unreleased]` to the new version section in `CHANGELOG.md`.

## 🔵 Known limitations to keep on the public roadmap

- Embedded image positions may not match the original Excel layout exactly (drift, more visible on non-first sheets or on files with custom column widths/row heights).
- Charts: bar/column, line and pie render from cached series data; other types (scatter, area, combo, …) show a labelled placeholder.
- Cell styling (bold, italic, font colors, background fills) is not rendered.
- Old `.xls` (BIFF binary) format renders without embedded images.
- Preview is capped at 25 MB (file-size proxy guard).

Exploratory follow-ups for some of these are tracked in `TODO.md`.

## Contact

`onufrienko.alex@gmail.com`
