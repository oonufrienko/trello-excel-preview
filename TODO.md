# TODO — exploratory follow-ups

Items here are non-blocking experiments. Each one is its own branch when picked up.

## Cell styles (bold / italic / colors / fills)

SheetJS community `sheet_to_html()` strips all formatting. To render styles:

1. Parse with `XLSX.read(buffer, { cellStyles: true })` — populates `cell.s` with `{ font: { bold, italic, color }, fill: { fgColor }, alignment }`.
2. After `sheet_to_html()`, walk the generated `<td>` cells and inject inline `style` from the corresponding `sheet[A1].s`.

Estimated effort: ~100–150 lines in `js/preview.js`. Main risk is variance between Excel / LibreOffice / Google Sheets exports — each writes the style block slightly differently. Needs fixture coverage in `tests/e2e/`.

## Formula calculation

`fix/formula-empty-cells` (shipped 2026-05-26) shows the formula text (`=A1+B1`) when a cell has no cached value. The next step is to **evaluate** the formula in the browser so users see the actual result, regardless of how the file was generated. Options, roughly in order of pragmatism:

- **[HyperFormula](https://hyperformula.handsontable.com/)** — Apache-2.0, ~300 KB minified. Most realistic; covers 380+ functions, dependency graph, array formulas. Cost: bundle size and license footprint.
- **[formula-parser](https://github.com/handsontable/formula-parser)** — MIT, smaller, but feature-incomplete (no array formulas, fewer functions).
- **Custom mini-parser** for the top ~20 functions (`SUM`, `AVERAGE`, `IF`, `VLOOKUP`, `COUNTIF`, …). Only worth it if we cap the bundle aggressively and accept gaps; likely more code to maintain than the libraries above.

Decision criteria: how often files come in *without* cached values (rare in practice — most spreadsheet apps cache; the offenders are server-side exports). If usage is occasional, ship HyperFormula behind a lazy `import()` so the first preview without a formula doesn't pay the bundle cost.
