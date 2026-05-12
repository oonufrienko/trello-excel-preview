const t = TrelloPowerUp.iframe({ appKey: window.TRELLO_APP_KEY || '' });

let currentWorkbook = null;

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

function switchSheet(sheetName) {
  const wb = currentWorkbook;
  const sheet = wb.Sheets[sheetName];

  const html = XLSX.utils.sheet_to_html(sheet, {
    id: 'excel-table',
    editable: false,
    header: ''
  });

  document.getElementById('sheet-content').innerHTML = html;

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
