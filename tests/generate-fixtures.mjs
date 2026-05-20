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
  await oversizedDim();         console.log('  oversized-dim.xlsx');
  await large5mb();             console.log('  large-5mb.xlsx');
  await csvFile();              console.log('  data.csv');
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
