# Simple Excel Viewer

A Trello Power-Up that previews spreadsheet attachments (Excel, CSV, ODS) directly inside a Trello card — no downloads, no extra apps.

Production: https://trello-excel-preview.vercel.app/
Marketplace: submitted, awaiting review.

## What it does

- In-browser preview of attached spreadsheet files.
- Multi-sheet support — switch between worksheet tabs from the toolbar.
- Embedded images rendered (XLSX, XLSM, XLSB).
- Excel column widths preserved.
- Formula values computed client-side when the source file has no cached values.
- File actions from the card: Preview, Download, Rename, Delete.
- One-time authorization for Rename/Delete, with a Settings panel to disconnect.
- Works on free Trello plans (up to 10 MB attachments) and paid plans (up to 25 MB through the preview proxy).

## Supported formats

`.xlsx`, `.xlsm`, `.xlsb`, `.xls`, `.csv`, `.ods`

## Known limitations

- **Embedded image positions may not match the original Excel layout exactly.** Images can drift, more visibly on non-first sheets of multi-sheet workbooks or on files with custom column widths or row heights.
- **Charts and graphs are not rendered** — only cell data. Files with embedded charts have not been tested; chart objects will not appear in the preview.
- **Cell styling** (bold, italic, font colors, background fills) is not rendered. Only numeric formats, alignment via defaults, and merged cells are honoured.
- **Old `.xls`** (BIFF binary) format renders without embedded images.
- **Preview is capped at 25 MB** (file-size proxy guard). Larger files must be downloaded.

Exploratory follow-ups for some of these are tracked in [TODO.md](TODO.md).

## Tech stack

- Vercel serverless (proxy, health endpoint, rate limit).
- [SheetJS](https://sheetjs.com/) (community) for parsing and HTML rendering.
- [JSZip](https://stuk.github.io/jszip/) for extracting embedded images and Excel drawing anchors.
- No analytics, no trackers, no cookies. See [Privacy Policy](https://trello-excel-preview.vercel.app/privacy.html).

## Project layout

- `js/` — client-side scripts: `connector.js` (capabilities), `attachments.js` (file list), `preview.js` (modal + rendering), `settings.js`, `auth.js`, `xlsx-calc.bundle.js` (bundled formula engine).
- `api/` — Vercel serverless: `proxy.js` (CORS-bypassing fetch + rate limit), `health.js`, `index-html.js` (connector frame), `attachments-html.js`, `preview-html.js`, `settings-html.js`, `auth-html.js`.
- `*.html` — static pages: `privacy.html`, `terms.html`, `welcome.html`.
- `css/styles.css` — Trello-themed styles.
- `tests/e2e/` — Playwright e2e suite.
- `marketing/` — Marketplace listing copy + icon.
- `CHANGELOG.md` — Keep a Changelog format.
- `RELEASE.md` — publisher handover checklist.

## Legal

- [Privacy Policy](https://trello-excel-preview.vercel.app/privacy.html)
- [Terms of Use](https://trello-excel-preview.vercel.app/terms.html)

## Contact

Bug reports, feature requests: **onufrienko.alex@gmail.com**

Implementation by AI. Product direction, ownership, and delivery by Oleksandr Onufrienko.
