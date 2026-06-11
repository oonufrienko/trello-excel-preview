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
      // Old BIFF .xls files saved without a CODEPAGE record decode with the
      // cp1252 default, so Cyrillic text surfaces as dense U+00C0–U+00FF
      // mojibake ("Ïîñòà÷àëüíèê"). Detect that signature and re-read as
      // cp1251 (the Windows-Cyrillic codepage such files actually use).
      if (ext === 'xls' && looksLikeCp1251Mojibake(workbook)) {
        workbook = XLSX.read(buffer, { type: 'array', sheetStubs: true, codepage: 1251 });
      }
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
  // Apply an ECMA-376 tint to a RRGGBB hex color: shift the HSL luminance
  // (tint > 0 lightens toward white, tint < 0 darkens toward black). This
  // matches how Excel renders theme-palette colors.
  const applyTint = (hex, tint) => {
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    l = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint;
    let r2, g2, b2;
    if (s === 0) {
      r2 = g2 = b2 = l;
    } else {
      const hue = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r2 = hue(p, q, h + 1 / 3);
      g2 = hue(p, q, h);
      b2 = hue(p, q, h - 1 / 3);
    }
    const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, '0').toUpperCase();
    return toHex(r2) + toHex(g2) + toHex(b2);
  };

  // The `theme` attribute on <color>/<fgColor> indexes the theme's clrScheme
  // with the dk/lt pairs swapped (Excel convention): 0=lt1, 1=dk1, 2=lt2,
  // 3=dk2, 4..9=accent1..6, 10=hlink, 11=folHlink.
  const THEME_SLOTS = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2',
                       'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
  const parseThemeColors = (themeDoc) => {
    const scheme = themeDoc && themeDoc.getElementsByTagNameNS('*', 'clrScheme')[0];
    if (!scheme) return [];
    return THEME_SLOTS.map(name => {
      const slot = scheme.getElementsByTagNameNS('*', name)[0];
      if (!slot) return null;
      const srgb = slot.getElementsByTagNameNS('*', 'srgbClr')[0];
      if (srgb) return (srgb.getAttribute('val') || '').toUpperCase() || null;
      const sys = slot.getElementsByTagNameNS('*', 'sysClr')[0];
      return sys ? ((sys.getAttribute('lastClr') || '').toUpperCase() || null) : null;
    });
  };

  const stylesDoc = await parseXml('xl/styles.xml');
  if (!stylesDoc) return {};

  // Theme palette — Excel's default color picker writes theme+tint refs,
  // not rgb, so without this most "normally" colored files lose all fills.
  const themePath = zip.files['xl/theme/theme1.xml'] ? 'xl/theme/theme1.xml'
    : Object.keys(zip.files).find(p => /^xl\/theme\/theme\d+\.xml$/.test(p));
  const themeColors = parseThemeColors(themePath ? await parseXml(themePath) : null);

  const colorOf = (el) => {
    if (!el) return null;
    const rgb = el.getAttribute('rgb');
    // strip alpha byte if present (ARGB → RGB)
    if (rgb) return (rgb.length === 8 ? rgb.slice(2) : rgb).toUpperCase();
    const themeAttr = el.getAttribute('theme');
    if (themeAttr === null) return null;
    const idx = parseInt(themeAttr, 10);
    const tint = parseFloat(el.getAttribute('tint') || '0') || 0;
    // Untinted lt1/dk1 are the sheet's own background/text colors — return
    // null so the page CSS (including dark mode) keeps control of them.
    if (!tint && (idx === 0 || idx === 1)) return null;
    const base = themeColors[idx];
    if (!base) return null;
    return tint ? applyTint(base, tint) : base;
  };

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

    const attrInt = (el, name) => el ? (parseInt(el.getAttribute(name), 10) || 0) : 0;

    // Per-pic shape transform from xdr:pic/xdr:spPr/a:xfrm: rotation
    // (1/60000 deg → deg), flips, intrinsic size (EMU) and position (needed
    // only for pics inside groups, in the group's child coordinate space).
    const readXfrm = (picEl) => {
      const spPr = findDirect(picEl, 'spPr');
      const xfrm = spPr ? findDirect(spPr, 'xfrm') : null;
      const off = xfrm ? findDirect(xfrm, 'off') : null;
      const ext = xfrm ? findDirect(xfrm, 'ext') : null;
      return {
        rot: xfrm ? (parseInt(xfrm.getAttribute('rot'), 10) || 0) / 60000 : 0,
        flipH: !!xfrm && xfrm.getAttribute('flipH') === '1',
        flipV: !!xfrm && xfrm.getAttribute('flipV') === '1',
        cx: attrInt(ext, 'cx'), cy: attrInt(ext, 'cy'),
        offX: attrInt(off, 'x'), offY: attrInt(off, 'y')
      };
    };

    // Collect every pic under an anchor, descending into grpSp groups. A pic
    // inside a group gets `box` — the group's fraction of the anchor box plus
    // its child coordinate space (chOff/chExt) — so the pic's own xfrm can be
    // mapped to a fractional sub-box of the anchor later.
    const collectPics = (anchorEl) => {
      const pics = [];
      const walk = (el, box) => {
        for (const child of el.children) {
          if (child.localName === 'pic') {
            pics.push({ picEl: child, box });
          } else if (child.localName === 'grpSp') {
            const grpPr = findDirect(child, 'grpSpPr');
            const xfrm = grpPr ? findDirect(grpPr, 'xfrm') : null;
            if (!xfrm) continue;
            const chOff = findDirect(xfrm, 'chOff');
            const chExt = findDirect(xfrm, 'chExt');
            const sub = {
              x: 0, y: 0, w: 1, h: 1,
              cx0: attrInt(chOff, 'x'), cy0: attrInt(chOff, 'y'),
              cw: attrInt(chExt, 'cx') || 1, ch: attrInt(chExt, 'cy') || 1
            };
            if (box) { // nested group: its off/ext live in the parent's child space
              const off = findDirect(xfrm, 'off');
              const ext = findDirect(xfrm, 'ext');
              sub.x = box.x + (attrInt(off, 'x') - box.cx0) / box.cw * box.w;
              sub.y = box.y + (attrInt(off, 'y') - box.cy0) / box.ch * box.h;
              sub.w = attrInt(ext, 'cx') / box.cw * box.w;
              sub.h = attrInt(ext, 'cy') / box.ch * box.h;
            }
            walk(child, sub);
          }
        }
      };
      walk(anchorEl, null);
      return pics;
    };

    // One output entry per pic (an anchor with a group yields several).
    // Media that exists but the browser can't decode (e.g. WMF) becomes a
    // placeholder entry, so the user still sees the image's place and size.
    const buildEntries = (aEl, base) => collectPics(aEl).map(async ({ picEl, box }) => {
      const blipEl = findDeep(picEl, 'blip');
      if (!blipEl) return null;
      const imgRId = getREmbed(blipEl);
      if (!imgRId || !drawingRels[imgRId]) return null;
      const imgPath = resolvePath(drawingPath, drawingRels[imgRId]);
      const x = readXfrm(picEl);
      const entry = { ...base, rot: x.rot, flipH: x.flipH, flipV: x.flipV, cx: x.cx, cy: x.cy };
      if (box) {
        entry.rel = {
          x: box.x + (x.offX - box.cx0) / box.cw * box.w,
          y: box.y + (x.offY - box.cy0) / box.ch * box.h,
          w: x.cx / box.cw * box.w,
          h: x.cy / box.ch * box.h
        };
      }
      const blobUrl = await getBlobUrl(imgPath);
      if (blobUrl) return { ...entry, blobUrl };
      if (zip.files[imgPath]) return { ...entry, placeholder: imgPath.split('.').pop().toUpperCase() };
      return null;
    });

    // Build both anchor sets in parallel. Each blob extraction is a
    // JSZip decompression — serial awaits were the bottleneck for
    // workbooks with many images.
    const twoCellPromises = findDirects(root, 'twoCellAnchor').flatMap((aEl) => {
      const fromEl = findDirect(aEl, 'from');
      const toEl = findDirect(aEl, 'to');
      if (!fromEl || !toEl) return [];
      return buildEntries(aEl, {
        type: 'two',
        from: { col: intOf(fromEl, 'col'), row: intOf(fromEl, 'row'),
                colOff: intOf(fromEl, 'colOff'), rowOff: intOf(fromEl, 'rowOff') },
        to:   { col: intOf(toEl, 'col'),   row: intOf(toEl, 'row'),
                colOff: intOf(toEl, 'colOff'),   rowOff: intOf(toEl, 'rowOff') }
      });
    });

    const oneCellPromises = findDirects(root, 'oneCellAnchor').flatMap((aEl) => {
      const fromEl = findDirect(aEl, 'from');
      const extEl = findDirect(aEl, 'ext');
      if (!fromEl || !extEl) return [];
      return buildEntries(aEl, {
        type: 'one',
        from: { col: intOf(fromEl, 'col'), row: intOf(fromEl, 'row'),
                colOff: intOf(fromEl, 'colOff'), rowOff: intOf(fromEl, 'rowOff') },
        ext: { cx: parseInt(extEl.getAttribute('cx'), 10) || 0,
               cy: parseInt(extEl.getAttribute('cy'), 10) || 0 }
      });
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

// Build monotonic per-column-left and per-row-top pixel edges (relative to the
// wrapper) from the laid-out grid. colEdges[c] is the left edge of logical
// column c; colEdges[numCols] is the right edge of the last column. Same for
// rowEdges with tops/bottom. Because each edge accumulates real cell sizes
// column-by-column (row-by-row), the arrays are monotonically increasing —
// merged cells cannot make a later column/row land before an earlier one.
function buildGridEdges(grid, wrapperRect) {
  const numRows = grid.length;
  const numCols = grid.reduce((m, row) => Math.max(m, row ? row.length : 0), 0);

  // Column left-edges: scan the first row, reading each distinct cell's rect.
  // A merged cell spans multiple logical columns but reports one rect; we
  // distribute its width evenly so every logical column gets an edge.
  const colEdges = new Array(numCols + 1);
  colEdges[0] = 0;
  for (let c = 0; c < numCols; c++) {
    let span = 1, w = 0;
    for (let r = 0; r < numRows; r++) {
      const cell = grid[r] && grid[r][c];
      if (cell && (grid[r][c - 1] !== cell)) { // left edge of this cell in row r
        const rect = cell.getBoundingClientRect();
        let s = 1;
        while (grid[r][c + s] === cell) s++;
        span = s;
        w = rect.width / s;
        break;
      }
    }
    colEdges[c + 1] = colEdges[c] + (w || 0);
    // skip the columns covered by a horizontal merge — they share the edge step
    for (let k = 1; k < span && c + 1 < numCols; k++) {
      colEdges[c + 2] = colEdges[c + 1] + w;
      c++;
    }
  }

  const rowEdges = new Array(numRows + 1);
  rowEdges[0] = 0;
  for (let r = 0; r < numRows; r++) {
    let span = 1, h = 0;
    const row = grid[r] || [];
    for (let c = 0; c < numCols; c++) {
      const cell = row[c];
      if (cell && (!(grid[r - 1] && grid[r - 1][c] === cell))) { // top edge in col c
        const rect = cell.getBoundingClientRect();
        let s = 1;
        while (grid[r + s] && grid[r + s][c] === cell) s++;
        span = s;
        h = rect.height / s;
        break;
      }
    }
    rowEdges[r + 1] = rowEdges[r] + (h || 0);
    for (let k = 1; k < span && r + 1 < numRows; k++) {
      rowEdges[r + 2] = rowEdges[r + 1] + h;
      r++;
    }
  }

  return { colEdges, rowEdges, numRows, numCols };
}

function positionImages(wrapper, table, anchors, rangeStart) {
  const grid = buildCellGrid(table);
  const wrapperRect = wrapper.getBoundingClientRect();
  const { colEdges, rowEdges, numRows, numCols } = buildGridEdges(grid, wrapperRect);

  const clamp = (v, max) => v < 0 ? 0 : (v > max ? max : v);
  const colX = (c, off) => colEdges[clamp(c, numCols)] + (off || 0) / EMU_PER_PX;
  const rowY = (r, off) => rowEdges[clamp(r, numRows)] + (off || 0) / EMU_PER_PX;
  // Average cell sizes — used to size anchors whose row/col span lies entirely
  // in the empty top rows trimSheetRange removed.
  const avgRowH = numRows ? rowEdges[numRows] / numRows : 18;
  const avgColW = numCols ? colEdges[numCols] / numCols : 64;

  // Compute each anchor's geometry up front. Anchors whose whole row span sits
  // in the trimmed-away top rows (to.row <= rangeStart.r) belong ABOVE the
  // table — header logos. We reserve a band above the table for them so they
  // don't overlap the first visible row.
  const placed = anchors.map(a => {
    const fromC = a.from.col - rangeStart.c;
    const fromR = a.from.row - rangeStart.r;
    const toR = a.type === 'two' ? a.to.row - rangeStart.r : null;
    const toC = a.type === 'two' ? a.to.col - rangeStart.c : null;
    const aboveTable = a.type === 'two' && toR <= 0; // entire row span trimmed

    // The anchor box as laid out in OUR grid.
    const boxLeft = colX(fromC, a.from.colOff);
    const boxTop = rowY(fromR, a.from.rowOff);
    let boxW, boxH;
    if (a.type === 'two') {
      boxW = colX(toC, a.to.colOff) - boxLeft;
      boxH = rowY(toR, a.to.rowOff) - boxTop;
      if (toC <= 0) boxW = Math.max(boxW, (a.to.col - a.from.col) * avgColW);
      if (aboveTable) boxH = Math.max(0, (a.to.row - a.from.row) * avgRowH);
    } else {
      boxW = a.ext.cx / EMU_PER_PX;
      boxH = a.ext.cy / EMU_PER_PX;
    }

    let left = boxLeft, top = boxTop, width = boxW, height = boxH;
    if (a.rel) {
      // group child: fractional sub-box of the anchor box
      left = boxLeft + a.rel.x * boxW;
      top = boxTop + a.rel.y * boxH;
      width = a.rel.w * boxW;
      height = a.rel.h * boxH;
    } else if (a.type === 'two' && a.cx > 0 && a.cy > 0) {
      // Size from the pic's own xfrm: our grid's column widths differ from
      // Excel's, so stretching from→to distorts (and editAs="oneCell" anchors
      // must not scale with cells at all). The intrinsic EMU size is what
      // Excel actually shows.
      width = a.cx / EMU_PER_PX;
      height = a.cy / EMU_PER_PX;
      if (a.rot) {
        // rotated: the anchor box is the rotated bounding box — keep centers
        // aligned so the unrotated box + CSS rotation lands where Excel draws
        left = boxLeft + (boxW - width) / 2;
        top = boxTop + (boxH - height) / 2;
      } else if (!aboveTable && boxW > 0 && boxH > 0) {
        // Our text rows are shorter than Excel's, so the intrinsic size can
        // spill onto the rows below the anchor. Shrink (never grow) to the
        // anchor box, keeping proportions.
        const scale = Math.min(1, boxW / width, boxH / height);
        width *= scale;
        height *= scale;
      }
    }
    return { a, left, top, width, height, aboveTable };
  }).filter(p => p.width > 0 && p.height > 0);

  // Reserve a top band tall enough for the tallest header logo, and push the
  // table down by that much so logos sit in the header instead of over data.
  // Use padding-top on the wrapper (not margin-top on the table) so the gap
  // can't collapse out of the wrapper; absolute images are positioned from the
  // wrapper's border-box, so top:0 is the very top of the reserved band.
  const bandH = placed.reduce((m, p) => p.aboveTable ? Math.max(m, p.height) : m, 0);
  if (bandH > 0) wrapper.style.paddingTop = bandH + 'px';

  placed.forEach(({ a, left, top, width, height, aboveTable }) => {
    // Header logos: bottom-align inside the reserved band (so a logo anchored
    // near the table top stays just above the first row). In-table images: top
    // is the grid row edge, shifted down by the reserved band.
    const finalTop = aboveTable ? Math.max(0, bandH - height) : bandH + top;

    const el = document.createElement(a.placeholder ? 'div' : 'img');
    el.className = 'embedded-img';
    if (a.placeholder) {
      el.classList.add('embedded-img-missing');
      el.textContent = a.placeholder; // e.g. "WMF" — format we can't decode
    } else {
      el.src = a.blobUrl;
    }
    el.style.left = left + 'px';
    el.style.top = finalTop + 'px';
    el.style.width = width + 'px';
    el.style.height = height + 'px';
    const t = [];
    if (a.rot) t.push(`rotate(${a.rot}deg)`);
    if (a.flipH) t.push('scaleX(-1)');
    if (a.flipV) t.push('scaleY(-1)');
    if (t.length) el.style.transform = t.join(' ');
    wrapper.appendChild(el);
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

// Cp1251 text decoded as cp1252 lands almost entirely in U+00C0–U+00FF
// ("Ïîñòà÷àëüíèê"); real Western European text uses that range sparsely.
// A high density of such characters across the workbook's strings means the
// file needs a cp1251 re-read.
function looksLikeCp1251Mojibake(wb) {
  let high = 0, total = 0;
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    for (const key of Object.keys(sheet)) {
      if (key[0] === '!') continue;
      const v = sheet[key] && sheet[key].v;
      if (typeof v !== 'string') continue;
      for (let i = 0; i < v.length; i++) {
        const c = v.charCodeAt(i);
        if (c > 0x20) total++;
        if (c >= 0xC0 && c <= 0xFF) high++;
      }
      if (total > 4000) return total > 20 && high / total > 0.4;
    }
  }
  return total > 20 && high / total > 0.4;
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
// styles map built by parseStyles(). It tags each td with id="<prefix>-A1"
// where <prefix> is the `id` option we pass to sheet_to_html (here
// "excel-table", so cells are "excel-table-A1"). The cell address is the
// suffix after the last "-" (addresses like A1 / B12 never contain "-").
// We set individual style properties (not cssText) so the CSS rule for
// data-t="n" nowrap is preserved.
function applyCellStyles(table, sheetStyles) {
  if (!sheetStyles) return;
  for (const td of table.querySelectorAll('td[id]')) {
    const dash = td.id.lastIndexOf('-');
    if (dash < 0) continue;
    const s = sheetStyles[td.id.slice(dash + 1)];
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
