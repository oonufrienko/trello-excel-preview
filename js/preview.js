const t = TrelloPowerUp.iframe({ appKey: window.TRELLO_APP_KEY || '', appName: 'Excel Preview' });

let currentWorkbook = null;

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
    const res = await fetch(`/api/proxy?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

    const buffer = await res.arrayBuffer();
    const ext = (data.name || '').split('.').pop().toLowerCase();

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
