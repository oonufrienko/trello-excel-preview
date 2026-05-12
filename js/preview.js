const t = TrelloPowerUp.iframe({ appKey: window.TRELLO_APP_KEY || '', appName: 'Excel Preview' });

let currentWorkbook = null;
let currentAnchors = {}; // { [sheetName]: [{ type, from, to?, ext?, blobUrl }] }
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

    if (['xlsx', 'xlsm', 'xlsb'].includes(ext) && typeof JSZip !== 'undefined') {
      try {
        const zip = await JSZip.loadAsync(buffer);
        const parsed = await parseAnchors(zip);
        currentAnchors = parsed.anchors;
        blobUrls = parsed.urls;
      } catch (e) {
        console.warn('Image extraction failed:', e);
      }
    }

    let workbook;
    if (ext === 'csv') {
      const text = new TextDecoder().decode(buffer);
      workbook = XLSX.read(text, { type: 'string' });
    } else {
      workbook = XLSX.read(buffer, { type: 'array' });
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

  const blobCache = new Map();
  const getBlobUrl = async (mediaPath) => {
    if (blobCache.has(mediaPath)) return blobCache.get(mediaPath);
    const file = zip.files[mediaPath];
    if (!file) return null;
    const ext = mediaPath.split('.').pop().toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(ext)) return null;
    const mime = { png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' }[ext] || 'image/jpeg';
    const data = await file.async('arraybuffer');
    const url = URL.createObjectURL(new Blob([data], { type: mime }));
    blobCache.set(mediaPath, url);
    result.urls.push(url);
    return url;
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

    const anchors = [];
    const root = drawingDoc.documentElement;

    for (const aEl of findDirects(root, 'twoCellAnchor')) {
      const fromEl = findDirect(aEl, 'from');
      const toEl = findDirect(aEl, 'to');
      const blipEl = findDeep(aEl, 'blip');
      if (!fromEl || !toEl || !blipEl) continue;
      const imgRId = getREmbed(blipEl);
      if (!imgRId || !drawingRels[imgRId]) continue;
      const imgPath = resolvePath(drawingPath, drawingRels[imgRId]);
      const blobUrl = await getBlobUrl(imgPath);
      if (!blobUrl) continue;
      anchors.push({
        type: 'two',
        from: { col: intOf(fromEl, 'col'), row: intOf(fromEl, 'row'),
                colOff: intOf(fromEl, 'colOff'), rowOff: intOf(fromEl, 'rowOff') },
        to:   { col: intOf(toEl, 'col'),   row: intOf(toEl, 'row'),
                colOff: intOf(toEl, 'colOff'),   rowOff: intOf(toEl, 'rowOff') },
        blobUrl
      });
    }

    for (const aEl of findDirects(root, 'oneCellAnchor')) {
      const fromEl = findDirect(aEl, 'from');
      const extEl = findDirect(aEl, 'ext');
      const blipEl = findDeep(aEl, 'blip');
      if (!fromEl || !extEl || !blipEl) continue;
      const imgRId = getREmbed(blipEl);
      if (!imgRId || !drawingRels[imgRId]) continue;
      const imgPath = resolvePath(drawingPath, drawingRels[imgRId]);
      const blobUrl = await getBlobUrl(imgPath);
      if (!blobUrl) continue;
      anchors.push({
        type: 'one',
        from: { col: intOf(fromEl, 'col'), row: intOf(fromEl, 'row'),
                colOff: intOf(fromEl, 'colOff'), rowOff: intOf(fromEl, 'rowOff') },
        ext: { cx: parseInt(extEl.getAttribute('cx'), 10) || 0,
               cy: parseInt(extEl.getAttribute('cy'), 10) || 0 },
        blobUrl
      });
    }

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
    const tableHtml = XLSX.utils.sheet_to_html(sheet, {
      id: 'excel-table',
      editable: false,
      header: ''
    });
    contentEl.innerHTML = `<div class="sheet-wrapper">${tableHtml}</div>`;

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
