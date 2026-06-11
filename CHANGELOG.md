# Changelog

All notable changes to **Simple Excel Viewer** (Trello Power-Up) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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

### Changed
- Product name: **Simple Excel Preview → Simple Excel Viewer** across all user-facing artifacts.
- Attribution wording: **"Claude (Anthropic)" → "AI"** in privacy, terms, listing, README, and the preview footer.
- Root connector frame served via `api/index-html.js` (replacing static `index.html`) so the Trello app key is injected server-side, enabling `t.getRestApi()`.
- CHANGELOG migrated from per-branch notes to Keep a Changelog format.

### Fixed
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
