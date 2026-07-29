# Changelog

All notable changes to **Simple Excel Viewer** (Trello Power-Up) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Deploy on green**: merging to `main` builds it once, runs the full e2e suite against that exact build, and promotes it to production only if the suite passes (`.github/workflows/deploy.yml`). A red suite ships nothing — production keeps serving what it served before. When a step *after* the promote fails, the run summary opens with "Production shipped, post-promote steps failed", so a red run is never ambiguous about whether the merge reached users.
- **Pull requests are tested against their own build**: an e2e run stages the PR's build and points the suite at it via `PREVIEW_HOST`. Previously the suite exercised whatever the dev alias happened to serve, so a green check said nothing about the change under review.
- **The dev alias follows the PR**: a green PR run points `trello-excel-preview-dev.vercel.app` at that build, so the change can be opened on the Trello test board without deploying by hand. `reset-dev` puts `main` back when a PR is closed without merging, or on demand.
- `npm run clean-orphans` — sweeps `renamed-*.csv` attachments left on the test board by interrupted rename runs.
- **Formula calculation**: cells with formulas but no cached value are now computed client-side via [xlsx-calc](https://github.com/fabiooshiro/xlsx-calc) (MIT), lazy-loaded only when such cells exist. Computed numbers get `#,##0.00` formatting; unsupported formulas fall back to showing the formula text.
- **Authorization capabilities** (Marketplace guideline #9): `authorization-status`, `show-authorization` (opens an Authorize popup), and `show-settings` (Connect/Disconnect panel at `/api/settings-html`).
- **On-enable welcome modal** (`welcome.html`) shown the first time the Power-Up is enabled on a board.
- **Terms of Use** page (`terms.html`, EN + UA) linked from the Privacy Policy.
- **Ko-fi support links** in the preview footer and welcome modal, plus `.github/FUNDING.yml`.
- `/api/health` endpoint for uptime monitoring (returns `{ status, version, uptimeSeconds, timestamp }`).
- Rate limiting on `/api/proxy` (30 requests/min per IP, returns `429` with `Retry-After`).
- Playwright e2e test infrastructure with safety guard against running on non-test boards.
- GitHub Actions workflow that runs e2e tests on pull requests to `main` and nightly at 03:17 UTC.
- Marketplace assets (privacy policy, listing copy, 1024×1024 icon, demo gif).
- `prune-deployments` workflow (daily): deletes Vercel deployments older than 5 days, keeping the 5 newest and anything that still has an alias. Vercel keeps deployments forever by default and every PR push stages one. `npm run prune-deployments` shows what would go without deleting.

### Changed
- e2e runs now serialize on a `trello-test-board` concurrency group (`queue: max`). Every run seeds and mutates the same Trello board, and a run cancelled mid-suite left it dirty.
- Product name: **Simple Excel Preview → Simple Excel Viewer** across all user-facing artifacts.
- Attribution wording: **"Claude (Anthropic)" → "AI"** in privacy, terms, listing, README, and the preview footer.
- Root connector frame served via `api/index-html.js` (replacing static `index.html`) so the Trello app key is injected server-side, enabling `t.getRestApi()`.
- CHANGELOG migrated from per-branch notes to Keep a Changelog format.

### Fixed
- **Renaming an attachment showed the old name** until the card was reloaded. `renderList()` rebuilt the list from `t.card('attachments')` — the Power-Up SDK's cached card model — which lags a REST write by tens of seconds; the rename now renders the value it just persisted. Trello's behaviour changed around 2026-07-25, which also turned the nightly e2e run red for three nights.
- `rename.spec` restored the fixture's name through the UI, so a slow sync left `renamed-<timestamp>.csv` on the test board — and `seed-board`, which matches attachments by name in CI, then uploaded a duplicate `data.csv` every night. Cleanup now goes through the REST API in `afterEach`.
- The `PREVIEW_HOST` rewrite in the e2e setup matched only the production host, while the Power-Up on the test board is registered against the dev alias — so it never fired.
- **Theme-palette colors now render.** Excel's default color picker writes `theme=` + `tint=` refs (not `rgb=`); fills and font colors are now resolved against `xl/theme/theme1.xml` with the ECMA tint formula. Untinted theme-0/1 (sheet default text/background) stay unresolved so dark mode keeps control. (Indexed legacy colors remain unresolved.)
- **Cyrillic in old `.xls` files.** BIFF files saved without a CODEPAGE record decoded as cp1252 and showed mojibake; the dense U+00C0–U+00FF signature is now detected and the file is re-read as cp1251.
- **Embedded images no longer vanish or stretch over text.** `twoCellAnchor` images are sized from the laid-out grid via monotonic column/row edges (merged cells can't produce negative sizes), then refined to the picture's own size from `a:xfrm/a:ext` and shrunk (never grown) to the anchor box so they can't spill onto text rows. Logos anchored in trimmed empty top rows render in a reserved header band above the table.
- **Rotation and mirroring**: `a:xfrm rot`/`flipH`/`flipV` are applied as CSS transforms (rotated pictures are centered on their anchor box).
- **Grouped pictures** (`grpSp`): every picture in a group renders in its own sub-box (previously only the first one appeared).
- **WMF images** (legacy Windows Metafile vector clip-art, undecodable by browsers) render as a same-size labelled placeholder instead of silently disappearing. In-browser WMF→canvas conversion was evaluated on 46 real files and rejected (half blank, half unusable).

## [1.0.0] — 2026-05-13

First public-ready release. Combines all work from the pre-launch milestones below.

> Implementation by AI. Product direction, ownership, and delivery by Oleksandr Onufrienko.

### Added
- **Attachment section** that lists Excel/CSV files attached to a Trello card with **Preview** and **⋯** (Download / Rename / Delete) actions.
- **Preview modal** that parses XLSX, XLS, CSV, XLSM, XLSB, ODS, XLAM, XLTX, XLTM client-side via SheetJS.
- **Sheet tabs** for multi-sheet workbooks.
- **Embedded image rendering**: positions images from `xl/drawings/*.xml` (twoCellAnchor + oneCellAnchor) absolutely over the matching table cells.
- **Hardening**: 25 MB file-size cap in proxy, 12 s preview timeout, 30 s download timeout, JSON error parsing in the UI.
- **Excel column widths preserved** via injected `<colgroup>` so narrow sheets are centered and wide sheets don't get distorted by long-text cells.
- **Soft grey backdrop** (`#dfe1e6`) around the table in the preview modal.

### Fixed
- Bogus `!ref` dimension (e.g. `A1:N1048576`) no longer freezes the browser — the range is trimmed to actual data before `sheet_to_html`.
- Trello attachment URLs that require authentication now go through the proxy with the user's OAuth token.

### Security
- All secrets (`TRELLO_TOKEN`, `VERCEL_TOKEN`, `GITHUB_TOKEN`) kept out of the bundle and out of git.
- SSRF allowlist in proxy (Trello + AWS S3 hosts only, HTTPS only).
- CSP `frame-ancestors https://trello.com https://*.trello.com` on every HTML endpoint.
- `Content-Disposition` filenames sanitized.
- Attachment names HTML-escaped via `esc()` before DOM insertion.

[Unreleased]: https://github.com/oonufrienko/trello-excel-preview/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/oonufrienko/trello-excel-preview/releases/tag/v1.0.0
