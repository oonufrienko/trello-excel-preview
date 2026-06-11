#!/usr/bin/env node
// Generate synthetic xlsx fixtures into tests/fixtures/generated/.
// Run: npm run generate-fixtures
import ExcelJS from 'exceljs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'fixtures', 'generated');

// Minimal valid flat-color PNG so ExcelJS can embed it without external assets.
function flatColorPng(width, height, [r, g, b]) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = chunk('IHDR', (() => {
    const d = Buffer.alloc(13);
    d.writeUInt32BE(width, 0); d.writeUInt32BE(height, 4);
    d[8] = 8; d[9] = 6; return d;
  })());
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter type "None"
    for (let x = 0; x < width; x++) {
      const off = y * (1 + width * 4) + 1 + x * 4;
      raw[off] = r; raw[off + 1] = g; raw[off + 2] = b; raw[off + 3] = 255;
    }
  }
  const idat = chunk('IDAT', deflateSync(raw));
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crcBuf]);
}

const crcTable = (() => {
  const tbl = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tbl[n] = c >>> 0;
  }
  return tbl;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ─── fixtures ──────────────────────────────────────────────────────────────

async function simple2col() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Список');
  ws.columns = [
    { header: 'Найменування', key: 'name', width: 40 },
    { header: 'Кількість',    key: 'qty',  width: 12 }
  ];
  for (let i = 1; i <= 50; i++) ws.addRow({ name: `Інструмент №${i}`, qty: i * 3 });
  await wb.xlsx.writeFile(join(OUT_DIR, 'simple-2col.xlsx'));
}

async function multiSheet() {
  const wb = new ExcelJS.Workbook();
  for (const [i, name] of ['Аркуш A', 'Аркуш B', 'Аркуш C'].entries()) {
    const ws = wb.addWorksheet(name);
    ws.columns = [
      { header: 'Поле',     key: 'a', width: 20 },
      { header: 'Значення', key: 'b', width: 20 }
    ];
    for (let r = 1; r <= 10; r++) ws.addRow({ a: `${name} рядок ${r}`, b: r * (i + 1) });
  }
  await wb.xlsx.writeFile(join(OUT_DIR, 'multi-sheet.xlsx'));
}

// Three sheets, each with a colored square in a different cell.
// Used to verify image positioning on non-first sheets.
async function multiSheetWithImages() {
  const wb = new ExcelJS.Workbook();
  const colors = [[230, 81, 0], [0, 121, 107], [21, 101, 192]];
  for (let i = 0; i < 3; i++) {
    const ws = wb.addWorksheet(`Sheet${i + 1}`);
    ws.columns = [
      { header: 'Item',  key: 'a', width: 18 },
      { header: 'Price', key: 'b', width: 12 },
      { header: '',      key: 'c', width: 30 }
    ];
    for (let r = 1; r <= 8; r++) ws.addRow({ a: `S${i + 1}-item${r}`, b: r * 10 });
    const png = flatColorPng(32, 32, colors[i]);
    const imageId = wb.addImage({ buffer: png, extension: 'png' });
    // Anchor offset moves per sheet to make drift easy to spot visually.
    ws.addImage(imageId, {
      tl: { col: 2.1 + i * 0.3, row: 1.1 + i * 0.5 },
      ext: { width: 120, height: 120 }
    });
  }
  await wb.xlsx.writeFile(join(OUT_DIR, 'with-images-multi.xlsx'));
}

// A twoCellAnchor image (tl + br) over a region with merged cells, plus
// empty top rows above the data. This reproduces the real price-list bug
// where the old positionImages computed height from the to/from cell rect
// difference and got a negative value under merges → image dropped.
// Regression guard for the geometry-based sizing fix.
async function twoCellAnchorImage() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Anchored');
  ws.columns = [
    { header: '', key: 'a', width: 18 },
    { header: '', key: 'b', width: 18 },
    { header: '', key: 'c', width: 18 },
    { header: '', key: 'd', width: 18 }
  ];
  // Leave rows 1-3 empty (only the image lives up there) so trimSheetRange
  // cuts them — exercises the negative-from-index clamp path too.
  for (let r = 5; r <= 16; r++) ws.addRow({ a: `Item ${r}`, b: r * 10, c: r * 2, d: r });
  // A tall vertical merge in the image's `to` column that STARTS ABOVE the
  // image's `from` row. With the old code, the `to` cell rect (top of the
  // merge) lands above the `from` cell → negative height → image dropped.
  // The geometry-based fix sizes from monotonic edges and survives this.
  ws.mergeCells('C6:C15'); // tall merge spanning the anchor's `to` row
  ws.mergeCells('A5:B5');

  const png = flatColorPng(40, 40, [200, 30, 90]);
  const imageId = wb.addImage({ buffer: png, extension: 'png' });
  // tl + br → ExcelJS emits a twoCellAnchor. `to` col is the merged column C,
  // whose displayed cell top is row 6 — above the image's `from` row 9.
  ws.addImage(imageId, {
    tl: { col: 1.2, row: 8.3 },  // from: col B, row 9
    br: { col: 2.8, row: 12.7 }  // to:   col C (merged C6:C15), row 13
  });
  await wb.xlsx.writeFile(join(OUT_DIR, 'two-cell-anchor.xlsx'));
}

// Bogus dimension that historically froze the browser by inflating
// the rendered range. Forced by writing a single far-down cell.
async function oversizedDim() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Bad');
  ws.columns = [
    { header: 'Name', key: 'a', width: 20 },
    { header: 'Val',  key: 'b', width: 10 }
  ];
  for (let r = 1; r <= 5; r++) ws.addRow({ a: `Row ${r}`, b: r });
  ws.getCell('A1048576').value = '';
  await wb.xlsx.writeFile(join(OUT_DIR, 'oversized-dim.xlsx'));
}

async function large5mb() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Large');
  ws.columns = [
    { header: 'A', key: 'a', width: 30 },
    { header: 'B', key: 'b', width: 30 },
    { header: 'C', key: 'c', width: 30 }
  ];
  const filler = 'lorem ipsum dolor sit amet '.repeat(8);
  for (let r = 1; r <= 8000; r++) ws.addRow({ a: filler, b: filler, c: r });
  await wb.xlsx.writeFile(join(OUT_DIR, 'large-5mb.xlsx'));
}

// Formulas without cached results — emulates files produced by tools that
// don't pre-compute values (e.g. openpyxl, ExcelJS without `result`).
// Without the fillFormulaStubs fix, these cells render as blank <td>s.
async function formulasNoCache() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Calc');
  ws.columns = [
    { header: 'A', key: 'a', width: 12 },
    { header: 'B', key: 'b', width: 12 },
    { header: 'Sum', key: 'c', width: 16 }
  ];
  for (let r = 1; r <= 5; r++) {
    ws.addRow({ a: r * 10, b: r * 3 });
    ws.getCell(`C${r + 1}`).value = { formula: `A${r + 1}+B${r + 1}` };
  }
  await wb.xlsx.writeFile(join(OUT_DIR, 'formulas-no-cache.xlsx'));
}

// Fills/fonts referencing theme-palette colors (theme= + tint= instead of
// rgb=) — Excel's default color picker writes these. Regression for the
// colorOf() theme resolution in preview.js. B2 keeps a direct ARGB fill so
// the rgb path is covered by the same fixture.
async function themeColorsFixture() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Styles');
  ws.getColumn(1).width = 24;
  ws.getColumn(2).width = 16;
  const solid = (fgColor) => ({ type: 'pattern', pattern: 'solid', fgColor });
  ws.getCell('A1').value = 'Заголовок';
  ws.getCell('A1').font = { bold: true, color: { theme: 1 } };
  ws.getCell('A1').fill = solid({ theme: 8, tint: 0.4 });   // accent5 40% lighter
  ws.getCell('B1').value = 'Сума';
  ws.getCell('B1').fill = solid({ theme: 8, tint: 0.4 });
  ws.getCell('A2').value = 'Сірий рядок';
  ws.getCell('A2').fill = solid({ theme: 0, tint: -0.15 }); // white 15% darker
  ws.getCell('B2').value = 123;
  ws.getCell('B2').fill = solid({ argb: 'FFFFC000' });
  ws.getCell('A3').value = 'Акцентний текст';
  ws.getCell('A3').font = { color: { theme: 5 } };          // accent2, no tint
  for (let r = 4; r <= 8; r++) {
    ws.getCell(`A${r}`).value = `Рядок ${r}`;
    ws.getCell(`B${r}`).value = r * 10;
  }
  await wb.xlsx.writeFile(join(OUT_DIR, 'theme-colors.xlsx'));
}

async function csvFile() {
  const lines = ['name,qty'];
  for (let i = 1; i <= 30; i++) lines.push(`Product ${i},${i * 5}`);
  await writeFile(join(OUT_DIR, 'data.csv'), lines.join('\n'), 'utf8');
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log('Generating fixtures into', OUT_DIR);
  await simple2col();           console.log('  simple-2col.xlsx');
  await multiSheet();           console.log('  multi-sheet.xlsx');
  await multiSheetWithImages(); console.log('  with-images-multi.xlsx');
  await twoCellAnchorImage();   console.log('  two-cell-anchor.xlsx');
  await formulasNoCache();      console.log('  formulas-no-cache.xlsx');
  await themeColorsFixture();   console.log('  theme-colors.xlsx');
  await oversizedDim();         console.log('  oversized-dim.xlsx');
  await large5mb();             console.log('  large-5mb.xlsx');
  await csvFile();              console.log('  data.csv');
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
