const t = TrelloPowerUp.iframe({ appKey: window.TRELLO_APP_KEY || '', appName: 'Excel Preview' });

let currentWorkbook = null;
let imageUrls = [];

const MAX_PREVIEW_CELLS = 200000;

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

    imageUrls.forEach(u => URL.revokeObjectURL(u));
    imageUrls = [];
    if (['xlsx', 'xlsm', 'xlsb'].includes(ext)) {
      imageUrls = await extractImages(buffer);
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
  renderImages(imageUrls);
}

async function extractImages(buffer) {
  if (typeof JSZip === 'undefined') return [];
  try {
    const zip = await JSZip.loadAsync(buffer);
    const urls = [];
    for (const [name, file] of Object.entries(zip.files)) {
      if (!name.startsWith('xl/media/') || file.dir) continue;
      const fileExt = name.split('.').pop().toLowerCase();
      if (!['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(fileExt)) continue;
      const mime = { png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' }[fileExt] || 'image/jpeg';
      const data = await file.async('arraybuffer');
      urls.push(URL.createObjectURL(new Blob([data], { type: mime })));
    }
    return urls;
  } catch {
    return [];
  }
}

function renderImages(urls) {
  const existing = document.getElementById('image-gallery');
  if (existing) existing.remove();
  if (!urls.length) return;
  const gallery = document.createElement('div');
  gallery.id = 'image-gallery';
  gallery.className = 'image-gallery';
  urls.forEach(url => {
    const img = document.createElement('img');
    img.src = url;
    img.className = 'gallery-img';
    gallery.appendChild(img);
  });
  document.getElementById('sheet-content').after(gallery);
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
    contentEl.innerHTML = XLSX.utils.sheet_to_html(sheet, {
      id: 'excel-table',
      editable: false,
      header: ''
    });
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
