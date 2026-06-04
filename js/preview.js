const t = TrelloPowerUp.iframe({ appKey: window.TRELLO_APP_KEY || '', appName: 'Excel Viewer' });

let currentWorkbook = null;
let currentAnchors = {}; // { [sheetName]: [{ type, from, to?, ext?, blobUrl }] }
let currentStyles = {};  // { [sheetName]: { [addr]: { font, bgColor, alignment } } }
let blobUrls = [];

const MAX_PREVIEW_CELLS = 200000;
const EMU_PER_PX = 9525;

async function loadPreview() {
  try {
    const data = await t.get('card', 'private', 'excel-preview-data');
    if (!data || !data.url) {
      showError('No file data found. Please try again.');
      return;
    }

    const params = new URLSearchParams({ url: data.url });
    if (data.token) params.set('token', data.token);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    let res;
    try {
      res = await fetch(`/api/proxy?${params}`, { signal: controller.signal });
    } catch (e) {
      clearTimeout(timeoutId);
      throw new Error(
        e.name === 'AbortError'
          ? 'Request timed out. The file may be too large or the server is slow.'
          : `Network error: ${e.message}`
      );
    }
    clearTimeout(timeoutId);

    if (!res.ok) {
      let detail = res.statusText;
      try {
        const err = await res.json();
        detail = err.detail || err.error || detail;
      } catch {}
      throw new Error(`${res.status}: ${detail}`);
    }

    const buffer = await res.arrayBuffer();
    const ext = (data.name || '').split('.').pop().toLowerCase();

    blobUrls.forEach(u => URL.revokeObjectURL(u));
    blobUrls = [];
    currentAnchors = {};
    currentStyles = {};

    if (['xlsx', 'xlsm', 'xlsb'].includes(ext) && typeof JSZip !== 'undefined') {
      try {
        const zip = await JSZip.loadAsync(buffer);
        const [anchorsResult, stylesResult] = await Promise.all([
          parseAnchors(zip),
          parseStyles(zip).catch(e => { console.warn('Style parsing failed:', e); return {}; })
        ]);
        currentAnchors = anchorsResult.anchors;
        blobUrls = anchorsResult.urls;
        currentStyles = stylesResult;
      } catch (e) {
        console.warn('XLSX extras extraction failed:', e);
      }
    }

    let workbook;
    if (ext === 'csv') {
      const text = new TextDecoder().decode(buffer);
      workbook = XLSX.read(text, { type: 'string' });
    } else {
      // sheetStubs keeps formula-only cells (no cached <v>) so we can
      // attempt to compute them client-side. (Visual styles like bold/
      // italic/color come from parseStyles via JSZip — community
      // SheetJS doesn't expose them in cell.s.)
      workbook = XLSX.read(buffer, { type: 'array', sheetStubs: true });
      if (workbookHasUncomputedFormulas(workbook)) {
        try {
          await loadXlsxCalc();
          window.XLSX_CALC(workbook);
        } catch (e) {
          console.warn('Formula calculation failed:', e);
        }
      }
      fillFormulaStubs(workbook);
      applyFormulaCellFormats(workbook);
    }

    currentWorkbook = workbook;
    renderWorkbook(workbook);
  } catch (err) {
    showError(`Failed to load file: ${err.message}`);
    console.error(err);
  }
}

function renderWorkbook(wb) {
  hideLoading();

  const tabsEl = document.getElementById('sheet-tabs');
  const contentEl = document.getElementById('sheet-content');

  if (wb.SheetNames.length > 1) {
    tabsEl.hidden = false;
    tabsEl.innerHTML = '';
    wb.SheetNames.forEach((name, i) => {
      const btn = document.createElement('button');
      btn.className = 'sheet-tab' + (i === 0 ? ' active' : '');
      btn.textContent = name;
      btn.onclick = () => switchSheet(name);
      tabsEl.appendChild(btn);
    });
  }

  contentEl.hidden = false;
  switchSheet(wb.SheetNames[0]);
}

// ── XLSX cell-style parsing ───────────────────────────────────────────────
// SheetJS community surfaces only fill info via cell.s. Font / alignment
// require parsing xl/styles.xml directly. We index fonts[], fills[],
// cellXfs[] from styles.xml, then for each sheet pull the `s=` attribute
// off every <c> element to map address → effective style.
// Returns: { [sheetName]: { [addr]: { bold, italic, ... } } }
async function parseStyles(zip) {
  const parseXml = async (path) => {
    const f = zip.files[path];
    if (!f) return null;
    return new DOMParser().parseFromString(await f.async('text'), 'application/xml');
  };
  const childrenOfFirst = (doc, tag) => {
    const el = doc && doc.getElementsByTagName(tag)[0];
    return el ? Array.from(el.children) : [];
  };
  const firstChild = (parent, tag) =>
    parent && parent.getElementsByTagName(tag)[0] || null;
  // Boolean font props: <b/> and <b val="1"/> mean true; <b val="0"/>
  // and <b val="false"/> mean explicit false (LibreOffice writes these).
  const boolAttr = (el) => {
    if (!el) return false;
    const v = el.getAttribute('val');
    return v !== '0' && v !== 'false';
  };
  const colorOf = (el) => {
    if (!el) return null;
    const rgb = el.getAttribute('rgb');
    if (!rgb) return null;
    // strip alpha byte if present (ARGB → RGB)
    return (rgb.length === 8 ? rgb.slice(2) : rgb).toUpperCase();
  };

  const stylesDoc = await parseXml('xl/styles.xml');
  if (!stylesDoc) return {};

  const rawFonts = childrenOfFirst(stylesDoc, 'fonts').map(fontEl => ({
    bold: boolAttr(firstChild(fontEl, 'b')),
    italic: boolAttr(firstChild(fontEl, 'i')),
    underline: boolAttr(firstChild(fontEl, 'u')),
    strike: boolAttr(firstChild(fontEl, 'strike')),
    color: colorOf(firstChild(fontEl, 'color')),
    size: parseFloat(firstChild(fontEl, 'sz')?.getAttribute('val') || '0') || null,
  }));
  // fonts[0] is the workbook default. Treat per-font size as "no
  // opinion" when it matches the default — we don't want to force a
  // px font-size on every cell just because Excel writes sz=11 by
  // default. Same logic for color (default font is usually colorless).
  const defaultSize = rawFonts[0]?.size || null;
  const fonts = rawFonts.map((f, i) => i === 0 ? f : ({
    ...f,
    size: (f.size && f.size !== defaultSize) ? f.size : null,
  }));

  const fills = childrenOfFirst(stylesDoc, 'fills').map(fillEl => {
    const pf = firstChild(fillEl, 'patternFill');
    if (!pf) return null;
    return {
      patternType: pf.getAttribute('patternType') || 'none',
      fgColor: colorOf(firstChild(pf, 'fgColor')),
      bgColor: colorOf(firstChild(pf, 'bgColor')),
    };
  });

  const cellXfs = childrenOfFirst(stylesDoc, 'cellXfs').map(xfEl => {
    const alignEl = firstChild(xfEl, 'alignment');
    return {
      fontId: parseInt(xfEl.getAttribute('fontId') || '0', 10),
      fillId: parseInt(xfEl.getAttribute('fillId') || '0', 10),
      alignment: alignEl ? {
        horizontal: alignEl.getAttribute('horizontal') || null,
        vertical: alignEl.getAttribute('vertical') || null,
      } : null,
    };
  });

  // Map sheet name → worksheet XML path via workbook + rels.
  const wbDoc = await parseXml('xl/workbook.xml');
  if (!wbDoc) return {};
  const relsDoc = await parseXml('xl/_rels/workbook.xml.rels');
  const relsMap = {};
  if (relsDoc) {
    Array.from(relsDoc.getElementsByTagName('Relationship')).forEach(r => {
      relsMap[r.getAttribute('Id')] = r.getAttribute('Target');
    });
  }
  const RELS_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

  const result = {};
  for (const sheetEl of Array.from(wbDoc.getElementsByTagName('sheet'))) {
    const sheetName = sheetEl.getAttribute('name');
    const rId = sheetEl.getAttributeNS(RELS_NS, 'id') || sheetEl.getAttribute('r:id');
    if (!sheetName || !rId || !relsMap[rId]) continue;
    let path = relsMap[rId];
    if (!path.startsWith('xl/')) path = 'xl/' + path.replace(/^\//, '');
    const sheetDoc = await parseXml(path);
    if (!sheetDoc) continue;

    const sheetStyles = {};
    for (const cEl of Array.from(sheetDoc.getElementsByTagName('c'))) {
      const addr = cEl.getAttribute('r');
      const sAttr = cEl.getAttribute('s');
      if (!addr || !sAttr) continue;
      const xf = cellXfs[parseInt(sAttr, 10)];
      if (!xf) continue;
      // fontId 0 is the workbook default — let the base CSS handle it.
      // Only non-default font references can contribute an actionable font.
      const font = xf.fontId !== 0 ? fonts[xf.fontId] : null;
      const fill = fills[xf.fillId];
      const bgColor = (fill && fill.patternType === 'solid')
        ? (fill.fgColor || fill.bgColor) : null;
      const fontHasStyle = font && (font.bold || font.italic || font.underline ||
                                     font.strike || font.color || font.size);
      const hasStyle = fontHasStyle || bgColor
                      || (xf.alignment && (xf.alignment.horizontal || xf.alignment.vertical));
      if (!hasStyle) continue;
      sheetStyles[addr] = {
        font: fontHasStyle ? font : null,
        bgColor,
        alignment: xf.alignment,
      };
    }
    result[sheetName] = sheetStyles;
  }

  return result;
}

// ── XLSX drawing parsing ──────────────────────────────────────────────────
// Walks the rels chain: workbook → sheet → drawing → media, and returns
// per-sheet image anchors with EMU coords. Defensive: any missing piece
// just yields fewer images, never throws.
async function parseAnchors(zip) {
  const result = { anchors: {}, urls: [] };

  const readXml = async (path) => {
    const f = zip.files[path];
    if (!f) return null;
    const text = await f.async('text');
    return new DOMParser().parseFromString(text, 'application/xml');
  };

  const readRels = async (path) => {
    const doc = await readXml(path);
    if (!doc) return {};
    const map = {};
    Array.from(doc.getElementsByTagName('Relationship')).forEach(r => {
      map[r.getAttribute('Id')] = r.getAttribute('Target');
    });
    return map;
  };

  const resolvePath = (base, target) => {
    if (target.startsWith('/')) return target.slice(1);
    const parts = base.split('/');
    parts.pop();
    target.split('/').forEach(p => {
      if (p === '..') parts.pop();
      else if (p !== '.') parts.push(p);
    });
    return parts.join('/');
  };

  const findDirect = (parent, localName) => {
    if (!parent) return null;
    for (const child of parent.children) {
      if (child.localName === localName) return child;
    }
    return null;
  };
  const findDirects = (parent, localName) => {
    if (!parent) return [];
    const result = [];
    for (const child of parent.children) {
      if (child.localName === localName) result.push(child);
    }
    return result;
  };
  const findDeep = (parent, localName) =>
    parent && parent.getElementsByTagNameNS('*', localName)[0];
  const intOf = (parent, localName) => {
    const el = findDirect(parent, localName);
    return el ? (parseInt(el.textContent, 10) || 0) : 0;
  };
  const RELS_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const getRId = (el) =>
    el && (el.getAttributeNS(RELS_NS, 'id') || el.getAttribute('r:id'));
  const getREmbed = (el) =>
    el && (el.getAttributeNS(RELS_NS, 'embed') || el.getAttribute('r:embed'));

  // Cache stores the in-flight Promise (not the resolved URL), so concurrent
  // requests for the same media path share a single decompression — important
  // when we extract anchors in parallel (a single image referenced from
  // multiple anchors decompresses once, not N times).
  const blobCache = new Map();
  const getBlobUrl = (mediaPath) => {
    if (blobCache.has(mediaPath)) return blobCache.get(mediaPath);
    const promise = (async () => {
      const file = zip.files[mediaPath];
      if (!file) return null;
      const ext = mediaPath.split('.').pop().toLowerCase();
      if (!['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(ext)) return null;
      const mime = { png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' }[ext] || 'image/jpeg';
      const data = await file.async('arraybuffer');
      const url = URL.createObjectURL(new Blob([data], { type: mime }));
      result.urls.push(url);
      return url;
    })();
    blobCache.set(mediaPath, promise);
    return promise;
  };

  const wbDoc = await readXml('xl/workbook.xml');
  if (!wbDoc) return result;
  const wbRels = await readRels('xl/_rels/workbook.xml.rels');

  for (const sheetEl of Array.from(wbDoc.getElementsByTagName('sheet'))) {
    const sheetName = sheetEl.getAttribute('name');
    const rId = getRId(sheetEl);
    if (!sheetName || !rId || !wbRels[rId]) continue;

    const sheetPath = resolvePath('xl/workbook.xml', wbRels[rId]);
    const sheetDoc = await readXml(sheetPath);
    if (!sheetDoc) continue;

    const drawingEl = sheetDoc.getElementsByTagName('drawing')[0];
    if (!drawingEl) { result.anchors[sheetName] = []; continue; }
    const drawingRId = getRId(drawingEl);
    if (!drawingRId) continue;

    const sheetDir = sheetPath.split('/').slice(0, -1).join('/');
    const sheetFile = sheetPath.split('/').pop();
    const sheetRels = await readRels(`${sheetDir}/_rels/${sheetFile}.rels`);

    const drawingTarget = sheetRels[drawingRId];
    if (!drawingTarget) continue;

    const drawingPath = resolvePath(sheetPath, drawingTarget);
    const drawingDoc = await readXml(drawingPath);
    if (!drawingDoc) continue;

    const drawingDir = drawingPath.split('/').slice(0, -1).join('/');
    const drawingFile = drawingPath.split('/').pop();
    const drawingRels = await readRels(`${drawingDir}/_rels/${drawingFile}.rels`);

    const root = drawingDoc.documentElement;

    // Build both anchor sets in parallel. Each blob extraction is a
    // JSZip decompression — serial awaits were the bottleneck for
    // workbooks with many images.
    const twoCellPromises = findDirects(root, 'twoCellAnchor').map(async (aEl) => {
      const fromEl = findDirect(aEl, 'from');
      const toEl = findDirect(aEl, 'to');
      const blipEl = findDeep(aEl, 'blip');
      if (!fromEl || !toEl || !blipEl) return null;
      const imgRId = getREmbed(blipEl);
      if (!imgRId || !drawingRels[imgRId]) return null;
      const imgPath = resolvePath(drawingPath, drawingRels[imgRId]);
      const blobUrl = await getBlobUrl(imgPath);
      if (!blobUrl) return null;
      return {
        type: 'two',
        from: { col: intOf(fromEl, 'col'), row: intOf(fromEl, 'row'),
                colOff: intOf(fromEl, 'colOff'), rowOff: intOf(fromEl, 'rowOff') },
        to:   { col: intOf(toEl, 'col'),   row: intOf(toEl, 'row'),
                colOff: intOf(toEl, 'colOff'),   rowOff: intOf(toEl, 'rowOff') },
        blobUrl
      };
    });

    const oneCellPromises = findDirects(root, 'oneCellAnchor').map(async (aEl) => {
      const fromEl = findDirect(aEl, 'from');
      const extEl = findDirect(aEl, 'ext');
      const blipEl = findDeep(aEl, 'blip');
      if (!fromEl || !extEl || !blipEl) return null;
      const imgRId = getREmbed(blipEl);
      if (!imgRId || !drawingRels[imgRId]) return null;
      const imgPath = resolvePath(drawingPath, drawingRels[imgRId]);
      const blobUrl = await getBlobUrl(imgPath);
      if (!blobUrl) return null;
      return {
        type: 'one',
        from: { col: intOf(fromEl, 'col'), row: intOf(fromEl, 'row'),
                colOff: intOf(fromEl, 'colOff'), rowOff: intOf(fromEl, 'rowOff') },
        ext: { cx: parseInt(extEl.getAttribute('cx'), 10) || 0,
               cy: parseInt(extEl.getAttribute('cy'), 10) || 0 },
        blobUrl
      };
    });

    const anchors = (await Promise.all([...twoCellPromises, ...oneCellPromises]))
      .filter(a => a);
    result.anchors[sheetName] = anchors;
  }

  return result;
}

// Build a logical (row, col) → <td> grid that accounts for colspan/rowspan,
// because SheetJS collapses merges into a single cell with spans.
function buildCellGrid(table) {
  const grid = [];
  Array.from(table.querySelectorAll('tr')).forEach((tr, rowIdx) => {
    if (!grid[rowIdx]) grid[rowIdx] = [];
    let colIdx = 0;
    Array.from(tr.children).forEach(td => {
      while (grid[rowIdx][colIdx]) colIdx++;
      const colspan = parseInt(td.getAttribute('colspan') || '1', 10);
      const rowspan = parseInt(td.getAttribute('rowspan') || '1', 10);
      for (let r = 0; r < rowspan; r++) {
        for (let c = 0; c < colspan; c++) {
          if (!grid[rowIdx + r]) grid[rowIdx + r] = [];
          grid[rowIdx + r][colIdx + c] = td;
        }
      }
      colIdx += colspan;
    });
  });
  return grid;
}

function positionImages(wrapper, table, anchors, rangeStart) {
  const grid = buildCellGrid(table);
  const wrapperRect = wrapper.getBoundingClientRect();

  anchors.forEach(a => {
    const fromR = a.from.row - rangeStart.r;
    const fromC = a.from.col - rangeStart.c;
    if (fromR < 0 || fromC < 0) return;

    const fromCell = grid[fromR] && grid[fromR][fromC];
    if (!fromCell) return;

    const fromRect = fromCell.getBoundingClientRect();
    const left = fromRect.left - wrapperRect.left + (a.from.colOff || 0) / EMU_PER_PX;
    const top  = fromRect.top  - wrapperRect.top  + (a.from.rowOff || 0) / EMU_PER_PX;

    let width, height;
    if (a.type === 'two') {
      const toR = a.to.row - rangeStart.r;
      const toC = a.to.col - rangeStart.c;
      const toCell = grid[toR] && grid[toR][toC];
      if (toCell) {
        const toRect = toCell.getBoundingClientRect();
        width  = (toRect.left - wrapperRect.left + (a.to.colOff || 0) / EMU_PER_PX) - left;
        height = (toRect.top  - wrapperRect.top  + (a.to.rowOff || 0) / EMU_PER_PX) - top;
      } else {
        width  = fromRect.width * 3;
        height = fromRect.height * 3;
      }
    } else {
      width  = a.ext.cx / EMU_PER_PX;
      height = a.ext.cy / EMU_PER_PX;
    }
    if (width <= 0 || height <= 0) return;

    const img = document.createElement('img');
    img.src = a.blobUrl;
    img.className = 'embedded-img';
    img.style.left = left + 'px';
    img.style.top = top + 'px';
    img.style.width = width + 'px';
    img.style.height = height + 'px';
    wrapper.appendChild(img);
  });
}

// Build a <colgroup> from sheet['!cols'] so Excel column widths survive into
// HTML. Without this, SheetJS lets the browser auto-size columns by content,
// which either leaves narrow files visually adrift or lets a single long-text
// cell stretch a whole column. Returns '' if widths are not available.
function buildColgroup(sheet) {
  const cols = sheet['!cols'];
  const ref = sheet['!ref'];
  if (!ref) return '';
  const range = XLSX.utils.decode_range(ref);
  const numCols = range.e.c - range.s.c + 1;
  if (numCols <= 0) return '';

  // sheet['!cols'] is indexed by absolute column (0=A); slice the trimmed range.
  // Fallback: if no !cols at all, skip — let browser auto-size.
  if (!Array.isArray(cols) || !cols.length) return '';

  const parts = [];
  let anyWidth = false;
  for (let c = range.s.c; c <= range.e.c; c++) {
    const col = cols[c];
    let px = null;
    if (col) {
      if (typeof col.wpx === 'number') px = col.wpx;
      else if (typeof col.wch === 'number') px = Math.round(col.wch * 7);
    }
    if (px && px > 0) {
      anyWidth = true;
      parts.push(`<col style="width:${px}px">`);
    } else {
      parts.push('<col>');
    }
  }
  if (!anyWidth) return '';
  return `<colgroup>${parts.join('')}</colgroup>`;
}

// Lazy-load xlsx-calc (MIT) on demand. Only files generated by tools that
// don't pre-compute formula values pay this network cost; Excel/LibreOffice
// files have cached values and skip this path entirely.
let xlsxCalcLoading = null;
function loadXlsxCalc() {
  if (window.XLSX_CALC) return Promise.resolve();
  if (xlsxCalcLoading) return xlsxCalcLoading;
  xlsxCalcLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/js/xlsx-calc.bundle.js';
    s.onload = () => resolve();
    s.onerror = () => {
      xlsxCalcLoading = null;
      reject(new Error('Failed to load xlsx-calc'));
    };
    document.head.appendChild(s);
  });
  return xlsxCalcLoading;
}

function workbookHasUncomputedFormulas(wb) {
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    for (const key of Object.keys(sheet)) {
      if (key[0] === '!') continue;
      const cell = sheet[key];
      if (!cell || !cell.f) continue;
      const hasValue = cell.w || (cell.v !== undefined && cell.v !== null && cell.v !== '' && cell.t !== 'z');
      if (!hasValue) return true;
    }
  }
  return false;
}

// Apply a sensible default number format to formula cells whose source
// workbook didn't set one (common with openpyxl / ExcelJS exports).
// xlsx-calc sets .v but not .w; without .z, sheet_to_html shows raw
// JS numbers like `622110.3`. Default '#,##0.00' = thousands-comma +
// 2 decimals. If the cell has its own .z (percent, date), respect it.
function applyFormulaCellFormats(wb) {
  if (!window.XLSX || !XLSX.SSF || !XLSX.SSF.format) return;
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    for (const key of Object.keys(sheet)) {
      if (key[0] === '!') continue;
      const cell = sheet[key];
      if (!cell || !cell.f) continue;
      if (typeof cell.v !== 'number' || !Number.isFinite(cell.v)) continue;
      const fmt = (cell.z && cell.z !== 'General') ? cell.z : '#,##0.00';
      try {
        cell.w = XLSX.SSF.format(fmt, cell.v);
        cell.t = 'n';
      } catch {
        // Bad format string — leave the cell unformatted.
      }
    }
  }
}

// Files generated programmatically often store formulas without a cached
// value. xlsx-calc covers most common cases; anything it can't evaluate
// (unsupported functions, errored cells) falls back here to formula text
// so the cell is not blank.
function fillFormulaStubs(wb) {
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    for (const key of Object.keys(sheet)) {
      if (key[0] === '!') continue;
      const cell = sheet[key];
      if (!cell || !cell.f) continue;
      const hasValue = cell.w || (cell.v !== undefined && cell.v !== null && cell.v !== '' && cell.t !== 'z');
      if (hasValue) continue;
      const text = '=' + cell.f;
      cell.t = 's';
      cell.v = text;
      cell.w = text;
    }
  }
}

// Recompute !ref from real cell keys to defend against files that declare
// a bogus full-sheet dimension (e.g. A1:N1048576) — those make sheet_to_html
// generate millions of empty <td>s and freeze the browser.
function trimSheetRange(sheet) {
  let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;

  for (const key of Object.keys(sheet)) {
    if (key[0] === '!') continue;
    const addr = XLSX.utils.decode_cell(key);
    if (addr.r < minR) minR = addr.r;
    if (addr.c < minC) minC = addr.c;
    if (addr.r > maxR) maxR = addr.r;
    if (addr.c > maxC) maxC = addr.c;
  }

  if (minR === Infinity) {
    delete sheet['!ref'];
    return { rows: 0, cols: 0, empty: true };
  }

  sheet['!ref'] = XLSX.utils.encode_range({
    s: { c: minC, r: minR },
    e: { c: maxC, r: maxR }
  });

  if (Array.isArray(sheet['!merges'])) {
    sheet['!merges'] = sheet['!merges'].filter(m =>
      m && m.s &&
      m.s.r >= minR && m.s.r <= maxR &&
      m.s.c >= minC && m.s.c <= maxC
    );
  }

  return { rows: maxR - minR + 1, cols: maxC - minC + 1, empty: false };
}

// ── Cell styling: bold/italic/color/fill/alignment ───────────────────────
// SheetJS sheet_to_html strips formatting — we re-apply it from the
// styles map built by parseStyles(). It tags each td with id="sjs-A1"
// (cell address after the "sjs-" prefix), which we use to look up the
// source cell. We set individual style properties (not cssText) so the
// CSS rule for data-t="n" nowrap is preserved.
function applyCellStyles(table, sheetStyles) {
  if (!sheetStyles) return;
  for (const td of table.querySelectorAll('td[id^="sjs-"]')) {
    const s = sheetStyles[td.id.slice(4)];
    if (!s) continue;

    if (s.font) {
      if (s.font.bold) td.style.fontWeight = '700';
      if (s.font.italic) td.style.fontStyle = 'italic';
      const decor = [];
      if (s.font.underline) decor.push('underline');
      if (s.font.strike) decor.push('line-through');
      if (decor.length) td.style.textDecoration = decor.join(' ');
      if (s.font.color) td.style.color = '#' + s.font.color;
      if (s.font.size) {
        // Excel font size is in points; CSS uses px. 1pt ≈ 1.333px.
        td.style.fontSize = Math.round(s.font.size * 4 / 3) + 'px';
      }
    }

    if (s.bgColor) td.style.backgroundColor = '#' + s.bgColor;

    if (s.alignment) {
      if (s.alignment.horizontal) td.style.textAlign = s.alignment.horizontal;
      if (s.alignment.vertical) {
        td.style.verticalAlign = s.alignment.vertical === 'center'
          ? 'middle' : s.alignment.vertical;
      }
    }
  }
}

function switchSheet(sheetName) {
  const wb = currentWorkbook;
  const sheet = wb.Sheets[sheetName];
  const contentEl = document.getElementById('sheet-content');

  const { rows, cols, empty } = trimSheetRange(sheet);

  if (empty) {
    contentEl.innerHTML = '<div class="empty-state">This sheet is empty.</div>';
  } else if (rows * cols > MAX_PREVIEW_CELLS) {
    contentEl.innerHTML =
      '<div class="empty-state">This sheet is too large to preview. ' +
      'Please use Download to view the file.</div>';
  } else {
    let tableHtml = XLSX.utils.sheet_to_html(sheet, {
      id: 'excel-table',
      editable: false,
      header: ''
    });
    const colgroup = buildColgroup(sheet);
    if (colgroup) {
      // Inject right after the opening <table ...> tag
      tableHtml = tableHtml.replace(/(<table[^>]*>)/, `$1${colgroup}`);
    }
    contentEl.innerHTML = `<div class="sheet-wrapper">${tableHtml}</div>`;

    const tableEl = contentEl.querySelector('table');
    if (tableEl) applyCellStyles(tableEl, currentStyles[sheetName]);

    const anchors = currentAnchors[sheetName];
    if (anchors && anchors.length) {
      const wrapper = contentEl.querySelector('.sheet-wrapper');
      const table = wrapper && wrapper.querySelector('table');
      if (table) {
        const range = XLSX.utils.decode_range(sheet['!ref']);
        // Defer to next frame so the browser computes table layout first
        // (getBoundingClientRect needs final cell sizes).
        requestAnimationFrame(() => positionImages(wrapper, table, anchors, range.s));
      }
    }
  }

  document.querySelectorAll('.sheet-tab').forEach(btn => {
    btn.classList.toggle('active', btn.textContent === sheetName);
  });
}

function showError(msg) {
  hideLoading();
  const el = document.getElementById('error');
  el.textContent = msg;
  el.hidden = false;
}

function hideLoading() {
  document.getElementById('loading').hidden = true;
}

t.render(loadPreview);
