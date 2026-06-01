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

## Cell styles (bold / italic / colors / fills) — SHIPPED BROKEN (2026-05-27)

A first cut shipped on `feature/cell-styles` (merged into main 2026-05-27). It works on ExcelJS-generated workbooks (Node sanity test passed) but **not on real Excel/LibreOffice files** — visual check on user's quarterly report showed neither bold headers nor yellow fills. The broken parser is *inert* (returns empty styles map → applyCellStyles no-op → same rendering as before the feature), so no rollback was done.

Bugs in `parseStyles()` to fix in follow-up branch (`feature/cell-styles-v2`):

1. **Missing `xfId` chain traversal.** OOXML has two xf arrays: `cellStyleXfs` (named master styles) and `cellXfs` (per-cell). Real Excel often writes named-style cells where `cellXfs[N]` only carries an `xfId` pointer into `cellStyleXfs`. Need to resolve the chain and honor `applyFont` / `applyFill` / `applyAlignment` override flags.

2. **Boolean parsing.** `<b/>` and `<b val="1"/>` mean true; `<b val="0"/>` means false. Current code treats all three as true. Same for `<i>`, `<u>`, `<strike>`. Fix: `el && el.getAttribute('val') !== '0'`.

3. **Theme colors.** `<color theme="N"/>` is common. Resolving needs to parse `xl/theme/theme1.xml` and map theme index → hex. ~30 lines of optional work.

4. **Indexed colors.** `<color indexed="N"/>` — legacy 64-color palette. Hardcode the first 16 colors as a lookup.

Estimate: 150–250 lines. Add a real-Excel fixture (or a redacted copy of the user's quarterly report) for regression coverage.

## Formula calculation — DONE (2026-05-26)

Shipped on branch `feature/formula-calc`: [xlsx-calc](https://github.com/fabiooshiro/xlsx-calc) (MIT) is lazy-loaded from cdn.jsdelivr.net only when the workbook contains formulas without cached values. Files saved by Excel/LibreOffice (vast majority) skip the load entirely.

Cells with formulas xlsx-calc cannot evaluate (rare functions, errored deps) fall back to showing the formula text — the previous `fillFormulaStubs` behavior, kept as a safety net.
