# TODO — exploratory follow-ups

Items here are non-blocking experiments. Each one is its own branch when picked up.

## Post-launch operations

### UptimeRobot monitoring on /api/health — DONE (2026-06-06)

External uptime monitoring is live: UptimeRobot pings
`https://trello-excel-preview.vercel.app/api/health` every 5 min and emails
`onufrienko.alex@gmail.com` if production goes down.

`/api/health` returns `{"status":"ok","version":...}` with HTTP 200. Note
`uptimeSeconds` resets to 0 on Vercel cold-starts — the monitor watches HTTP
status (+ optional `"status":"ok"` keyword), not the uptime value.

## Cell styles (bold / italic / colors / fills) — FIXED (2026-06-06)

Shipped working on `fix/cell-styles-v2` (merged into main `621ac60`, deployed to production, user-verified on real files hr_budget.xlsx / sales_report.xlsx).

**The real root cause was none of the originally-suspected OOXML issues** (xfId chain / theme / indexed colors). `parseStyles()` extracted styles correctly all along (proven in Node: 204 styled cells across 3 sheets). The bug was the **selector in `applyCellStyles()`** — it never matched the rendered cells:

1. First it queried `td[data-r]` — SheetJS `sheet_to_html` never emits `data-r`.
2. Then `td[id^="sjs-"]` — but `switchSheet` calls `sheet_to_html(sheet, { id: 'excel-table' })`, and that `id` option becomes the cell-id **prefix**, so cells are `id="excel-table-A1"`, not `sjs-A1`.
3. Final fix: read the address as the **suffix after the last `-`** (addresses like `A1`/`B12` never contain `-`) — prefix-agnostic, works regardless of the `sheet_to_html` id option.

Also fixed: boolean font props now honor `<b val="0"/>` / `<b val="false"/>` as false (LibreOffice emits explicit-false forms).

Regression coverage: real fixtures in `tests/fixtures/real/` (gitignored), `tests/e2e/cell-styles.spec.mjs`, and `npm run unseed-real` to clean private fixture cards off the shared test board.

**Still not resolved (real future limitation, not hit by our test files):** theme colors (`<color theme="N"/>`) and indexed colors (`<color indexed="N"/>`) are not resolved — only `rgb=` colors render. Files relying on theme/indexed palettes will show those cells uncolored. Fixing needs parsing `xl/theme/theme1.xml` (theme) and a hardcoded 64-color palette (indexed). Pick up only if a real file needs it.

## Embedded image positioning — robust geometry + header band — DONE (2026-06-10)

Shipped on branch `fix/images-positioning` (NOT yet merged — awaiting user OK to merge into main; preview-verified on the real price-list `КП Креп Тех…xlsx`, card "1234" on test board uPrZqiOc).

**Root cause:** `positionImages` sized `twoCellAnchor` images from the **DOM rect difference** of the to/from cells (`toCell.top − fromCell.top`). On files with merged cells and narrow anchor ranges, the `to` cell lands visually *above* the `from` cell → negative/sliver height → the `if (width<=0||height<=0) return` guard silently dropped the image. For `КП Креп Тех…xlsx` this dropped all 7 images (2 logos also died on the `fromR<0` guard, since `trimSheetRange` cut the empty top rows the logos sit in).

**Fix (general algorithm, not per-file tuning):**
1. `buildGridEdges()` builds **monotonic** `colEdges[]`/`rowEdges[]` (cumulative left/top pixel edges from the laid-out grid). twoCell size is now `colEdges[toC]−colEdges[fromC]` / `rowEdges[toR]−rowEdges[fromR]` (+ EMU offsets) — like Excel computes it. Monotonic ⇒ never negative.
2. Negative from-indices are **clamped to 0** instead of dropping the image.
3. Logos anchored entirely in the trimmed empty top rows (`to.row ≤ rangeStart.r`) get a reserved **header band** above the table via `wrapper.style.paddingTop`, so they sit in the header instead of overlapping the first data row.

`oneCellAnchor` images (use `ext.cx/cy`) are untouched → no regression (`with-images-multi.xlsx` e2e green). Regression coverage: new `two-cell-anchor.xlsx` fixture (twoCell over a tall vertical merge — red before fix, green after) + assertion in `tests/e2e/images.spec.mjs`. Verified in a local Chromium harness: card "1234" went **0 → 7 images, all sane size**.

## Other image files still misaligned on preview — INVESTIGATE (open)

After the fix above, the user checked OTHER image-bearing files **on the new preview (fix included)** and they still look wrong. Because the fix was already live on that preview, these are **distinct defects** with their own root causes — they will **not** all auto-fix when `fix/images-positioning` merges.

Likely-but-unconfirmed symptom classes to confirm (each would be fixed in the one shared positioning algorithm, never by hand-editing files): image shifted off position, wrong size (stretched/squashed), overlapping text / spilling outside the table, or still not visible at all.

**Cannot diagnose without the real files.** Next step when picked up:
1. Collect the specific problem files — seed them onto test board uPrZqiOc as cards (like "1234"), or drop into `tests/fixtures/real/` (gitignored).
2. Note the visible symptom per file.
3. Run the local instrumented harness (throwaway static server + stubbed `TrelloPowerUp`, the same one used to diagnose card "1234") to find each root cause **before** writing any fix.

Own branch off main when picked up. No per-file hardcoding. Relates to the older follow-ups: non-first-sheet image drift and overly-wide stretched rendering.

## Formula calculation — DONE (2026-05-26)

Shipped on branch `feature/formula-calc`: [xlsx-calc](https://github.com/fabiooshiro/xlsx-calc) (MIT) is lazy-loaded from cdn.jsdelivr.net only when the workbook contains formulas without cached values. Files saved by Excel/LibreOffice (vast majority) skip the load entirely.

Cells with formulas xlsx-calc cannot evaluate (rare functions, errored deps) fall back to showing the formula text — the previous `fillFormulaStubs` behavior, kept as a safety net.
