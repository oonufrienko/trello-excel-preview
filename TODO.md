# TODO — exploratory follow-ups

Items here are non-blocking experiments. Each one is its own branch when picked up.

## Post-launch operations

### UptimeRobot monitoring on /api/health — TODO

Set up free external uptime monitoring so production downtime triggers an email alert.

1. Sign up / log in at https://uptimerobot.com (free tier: 50 monitors, 5-min interval).
2. **+ Add New Monitor**:
   - Monitor Type: **HTTP(s)**
   - Friendly Name: `Excel Viewer — health`
   - URL: `https://trello-excel-preview.vercel.app/api/health`
   - Monitoring Interval: **5 minutes**
3. (Recommended) Advanced → **Keyword monitoring**: type **exists**, keyword `"status":"ok"` — alerts on broken body, not just 5xx.
4. **Alert Contacts**: enable email `onufrienko.alex@gmail.com`.
5. Create Monitor.

`/api/health` returns `{"status":"ok","version":...}` with HTTP 200 (verified 2026-05-29). Note `uptimeSeconds` resets to 0 on Vercel cold-starts — monitor on HTTP status + the `status:ok` keyword, not on uptime value.

## Cell styles (bold / italic / colors / fills) — FIXED (2026-06-06)

Shipped working on `fix/cell-styles-v2` (merged into main `621ac60`, deployed to production, user-verified on real files hr_budget.xlsx / sales_report.xlsx).

**The real root cause was none of the originally-suspected OOXML issues** (xfId chain / theme / indexed colors). `parseStyles()` extracted styles correctly all along (proven in Node: 204 styled cells across 3 sheets). The bug was the **selector in `applyCellStyles()`** — it never matched the rendered cells:

1. First it queried `td[data-r]` — SheetJS `sheet_to_html` never emits `data-r`.
2. Then `td[id^="sjs-"]` — but `switchSheet` calls `sheet_to_html(sheet, { id: 'excel-table' })`, and that `id` option becomes the cell-id **prefix**, so cells are `id="excel-table-A1"`, not `sjs-A1`.
3. Final fix: read the address as the **suffix after the last `-`** (addresses like `A1`/`B12` never contain `-`) — prefix-agnostic, works regardless of the `sheet_to_html` id option.

Also fixed: boolean font props now honor `<b val="0"/>` / `<b val="false"/>` as false (LibreOffice emits explicit-false forms).

Regression coverage: real fixtures in `tests/fixtures/real/` (gitignored), `tests/e2e/cell-styles.spec.mjs`, and `npm run unseed-real` to clean private fixture cards off the shared test board.

**Still not resolved (real future limitation, not hit by our test files):** theme colors (`<color theme="N"/>`) and indexed colors (`<color indexed="N"/>`) are not resolved — only `rgb=` colors render. Files relying on theme/indexed palettes will show those cells uncolored. Fixing needs parsing `xl/theme/theme1.xml` (theme) and a hardcoded 64-color palette (indexed). Pick up only if a real file needs it.

## Formula calculation — DONE (2026-05-26)

Shipped on branch `feature/formula-calc`: [xlsx-calc](https://github.com/fabiooshiro/xlsx-calc) (MIT) is lazy-loaded from cdn.jsdelivr.net only when the workbook contains formulas without cached values. Files saved by Excel/LibreOffice (vast majority) skip the load entirely.

Cells with formulas xlsx-calc cannot evaluate (rare functions, errored deps) fall back to showing the formula text — the previous `fillFormulaStubs` behavior, kept as a safety net.
