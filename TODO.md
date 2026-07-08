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

**Theme colors — RESOLVED (2026-06-11, branch `fix/xls-encoding-theme-colors`):** a real file demanded it (card "1", «Олбрізсервіс…xlsx» — zero `rgb=` colors, everything `theme=`+`tint=`). `colorOf()` now resolves against `xl/theme/theme1.xml` (lt/dk slot swap, ECMA tint via HSL luminance); untinted theme-0/1 stay unresolved so dark mode keeps control. Regression: `theme-colors.xlsx` fixture + `cell-styles.spec.mjs` assertions. Same branch also fixed cp1251 mojibake in old `.xls` files without a CODEPAGE record (card "00", «Видаткова.xls»; fixture `vydatkova-cp1251.xls` + `xls-encoding.spec.mjs`).

**Still not resolved:** indexed colors (`<color indexed="N"/>`, legacy 64-color palette) — not hit by any real file yet. Pick up only if one needs it.

## Embedded image positioning — robust geometry + header band — DONE (2026-06-10)

Shipped on branch `fix/images-positioning` (merged into main 2026-06-11; verified on SEV DEV against the real price-list `КП Креп Тех…xlsx`, card "1234"/"2 - картинки" on test board uPrZqiOc).

**Root cause:** `positionImages` sized `twoCellAnchor` images from the **DOM rect difference** of the to/from cells (`toCell.top − fromCell.top`). On files with merged cells and narrow anchor ranges, the `to` cell lands visually *above* the `from` cell → negative/sliver height → the `if (width<=0||height<=0) return` guard silently dropped the image. For `КП Креп Тех…xlsx` this dropped all 7 images (2 logos also died on the `fromR<0` guard, since `trimSheetRange` cut the empty top rows the logos sit in).

**Fix (general algorithm, not per-file tuning):**
1. `buildGridEdges()` builds **monotonic** `colEdges[]`/`rowEdges[]` (cumulative left/top pixel edges from the laid-out grid). twoCell size is now `colEdges[toC]−colEdges[fromC]` / `rowEdges[toR]−rowEdges[fromR]` (+ EMU offsets) — like Excel computes it. Monotonic ⇒ never negative.
2. Negative from-indices are **clamped to 0** instead of dropping the image.
3. Logos anchored entirely in the trimmed empty top rows (`to.row ≤ rangeStart.r`) get a reserved **header band** above the table via `wrapper.style.paddingTop`, so they sit in the header instead of overlapping the first data row.

`oneCellAnchor` images (use `ext.cx/cy`) are untouched → no regression (`with-images-multi.xlsx` e2e green). Regression coverage: new `two-cell-anchor.xlsx` fixture (twoCell over a tall vertical merge — red before fix, green after) + assertion in `tests/e2e/images.spec.mjs`. Verified in a local Chromium harness: card "1234" went **0 → 7 images, all sane size**.

## Other image files still misaligned on preview — DONE (2026-06-11, "Images v2")

Diagnosed on the real files from the test board («Прайс Спец Хомут, Інструмент КТ» 3.3 MB, «Прайс КТ Оптова» 9 MB, «КП Креп Тех (2)»). Four distinct root causes, all fixed in the shared algorithm on `fix/images-positioning` (commits `3a97f79` + `2b4aad0`), user-verified on SEV DEV:

1. **Wrong size / overlapping text** — one root: twoCell anchors were stretched across OUR grid, whose column widths differ from Excel's (and most real anchors are `editAs="oneCell"` = "don't scale with cells"). Now the size comes from the pic's own `a:xfrm/a:ext` (EMU), then is shrunk (never grown) to the anchor box so it can't spill onto text rows. Text-overlap cell hits on «Прайс Спец Хомут»: 27 → 8.
2. **Rotation/mirroring** — `a:xfrm rot` (1/60000°) + `flipH/flipV` were never parsed; now applied as CSS transforms, rotated pics centered on the anchor box (43 rotated + 6 flipped images in «Прайс КТ Оптова»).
3. **Groups (`grpSp`)** — only the first blip per anchor was taken; now every pic in a group renders in its own sub-box (mapped via the group's `chOff/chExt` child space).
4. **WMF main blips** (49+1 across the two price-lists) were silently dropped by the `getBlobUrl` whitelist. Browsers can't decode WMF; in-browser conversion (js-wmf) was tested on all 46 real WMFs and rejected — 23 blank, 23 unusable black silhouettes. Decision: render a same-size labelled placeholder. (`.wdp` files are only a14 HD-photo duplicates of PNG blips — safely ignored.)

Regression coverage: hand-built `images-v2.xlsx` fixture (rotated 45° pic, 2-pic group, real WMF; in gitignored `tests/fixtures/real/`, card seeded) + assertions in `tests/e2e/images.spec.mjs`.

**Known remaining limits (deliberate):**
- `oneCellAnchor` images have no "to" box, so when our rows/columns are narrower than Excel's they can still partially cover a neighbouring cell (8 residual single-cell hits on «Прайс Спец Хомут»). Fully solvable only by replicating Excel's exact column widths — relates to the stretched-rendering follow-up.
- **Charts (`graphicFrame`)** — DONE for bar/column, line and pie (2026-07-08, branch `feat/chart-rendering`): SVG drawn from cached series data (`numCache`/`strCache`), no range evaluation; unsupported types (scatter, area, combo, % stacked) show a labelled placeholder. Fixture `with-charts.xlsx` + `tests/e2e/charts.spec.mjs`. Remaining: real-world validation on sales_chart.xlsx / sales_dashboard.xlsx, more types on demand.

## Formula calculation — DONE (2026-05-26)

Shipped on branch `feature/formula-calc`: [xlsx-calc](https://github.com/fabiooshiro/xlsx-calc) (MIT) is lazy-loaded from cdn.jsdelivr.net only when the workbook contains formulas without cached values. Files saved by Excel/LibreOffice (vast majority) skip the load entirely.

Cells with formulas xlsx-calc cannot evaluate (rare functions, errored deps) fall back to showing the formula text — the previous `fillFormulaStubs` behavior, kept as a safety net.
