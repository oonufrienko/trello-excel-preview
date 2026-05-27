# Changelog

All notable changes to **Simple Excel Viewer** (Trello Power-Up) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `/api/health` endpoint for uptime monitoring (returns `{ status, version, uptimeSeconds, timestamp }`).
- Rate limiting on `/api/proxy` (30 requests/min per IP, returns `429` with `Retry-After`).
- Playwright e2e test infrastructure with safety guard against running on non-test boards.
- GitHub Actions workflow that runs e2e tests on pull requests to `main`.
- Marketplace assets (privacy policy, listing copy, 1024×1024 icon).

### Changed
- CHANGELOG migrated from per-branch notes to Keep a Changelog format.

## [1.0.0] — 2026-05-13

First public-ready release. Combines all work from the pre-launch milestones below.

> Implementation by Claude (Anthropic). Product direction, ownership, and operations by Oleksandr Onufrienko.

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
