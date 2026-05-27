# TODO — exploratory follow-ups

Items here are non-blocking experiments. Each one is its own branch when picked up.

## Cell styles (bold / italic / colors / fills)

SheetJS community `sheet_to_html()` strips all formatting. To render styles:

1. Parse with `XLSX.read(buffer, { cellStyles: true })` — populates `cell.s` with `{ font: { bold, italic, color }, fill: { fgColor }, alignment }`.
2. After `sheet_to_html()`, walk the generated `<td>` cells and inject inline `style` from the corresponding `sheet[A1].s`.

Estimated effort: ~100–150 lines in `js/preview.js`. Main risk is variance between Excel / LibreOffice / Google Sheets exports — each writes the style block slightly differently. Needs fixture coverage in `tests/e2e/`.

## Formula calculation — DONE (2026-05-26)

Shipped on branch `feature/formula-calc`: [xlsx-calc](https://github.com/fabiooshiro/xlsx-calc) (MIT) is lazy-loaded from cdn.jsdelivr.net only when the workbook contains formulas without cached values. Files saved by Excel/LibreOffice (vast majority) skip the load entirely.

Cells with formulas xlsx-calc cannot evaluate (rare functions, errored deps) fall back to showing the formula text — the previous `fillFormulaStubs` behavior, kept as a safety net.
