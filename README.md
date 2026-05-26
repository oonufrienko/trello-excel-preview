# Simple Excel Preview

A Trello Power-Up that previews spreadsheet attachments (Excel, CSV, ODS) directly inside a Trello card — no downloads, no extra apps.

Production: https://trello-excel-preview.vercel.app/
Marketplace: pending submission.

## What it does

- In-browser preview of attached spreadsheet files.
- Multi-sheet support — switch between worksheet tabs from the toolbar.
- Embedded images rendered (XLSX, XLSM, XLSB).
- Excel column widths preserved.
- File actions from the card: Preview, Download, Rename, Delete.
- Works on free Trello plans (up to 10 MB attachments) and paid plans (up to 25 MB through the preview proxy).

## Supported formats

`.xlsx`, `.xlsm`, `.xlsb`, `.xls`, `.csv`, `.ods`

## Known limitations

- **Embedded images may drift** from their original Excel position. More visible on non-first sheets of multi-sheet workbooks; can also affect the first sheet on files with custom column widths or row heights.
- **Formulas without cached values** are computed client-side via [xlsx-calc](https://github.com/fabiooshiro/xlsx-calc) (lazy-loaded only when needed). Most common functions are supported (arithmetic, `SUM`, `IF`, `VLOOKUP`, etc.). Cells with unsupported functions fall back to showing the formula text (`=GETPIVOTDATA(...)`) instead of the computed result.
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

- `js/` — client-side preview, attachments list, modal logic.
- `api/` — Vercel serverless: `proxy.js` (CORS-bypassing fetch + rate limit), `health.js`, `preview-html.js`.
- `css/styles.css` — Trello-themed styles.
- `tests/e2e/` — Playwright e2e suite.
- `marketing/` — Marketplace listing copy + icon.
- `CHANGELOG.md` — Keep a Changelog format.
- `RELEASE.md` — publisher handover checklist.

## Contact

Bug reports, feature requests: **onufrienko.alex@gmail.com**

Implementation by Claude (Anthropic). Product direction, ownership, and operations by Oleksandr Onufrienko.
