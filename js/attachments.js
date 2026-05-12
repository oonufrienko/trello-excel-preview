const EXCEL_EXTS = new Set(['xls', 'xlsx', 'csv', 'xlsm', 'xlsb', 'ods', 'xlam', 'xltx', 'xltm']);

function isExcel(a) {
  return EXCEL_EXTS.has((a.name || '').split('.').pop().toLowerCase());
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

let _apiKey = null;

// appKey injected server-side into window.TRELLO_APP_KEY — enables t.getRestApi()
const t = TrelloPowerUp.iframe({ appKey: window.TRELLO_APP_KEY || '', appName: 'Excel Preview' });

async function getApiKey() {
  if (_apiKey) return _apiKey;
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error('Could not load config');
  const json = await res.json();
  _apiKey = json.apiKey;
  return _apiKey;
}

async function openPreview(attachment) {
  let userToken = null;
  try {
    const isAuth = await t.getRestApi().isAuthorized();
    if (!isAuth) {
      await t.getRestApi().authorize({ scope: 'read,write' });
    }
    userToken = await t.getRestApi().getToken();
  } catch (err) {
    console.warn('Could not get user token:', err);
  }

  await t.set('card', 'private', 'excel-preview-data', {
    url: attachment.url,
    name: attachment.name,
    token: userToken
  });
  t.modal({
    title: attachment.name,
    url: t.signUrl('/api/preview-html'),
    fullscreen: true,
    accentColor: '#217346'
  });
}

async function downloadAttachment(attachment) {
  const a = document.createElement('a');
  a.href = `/api/proxy?url=${encodeURIComponent(attachment.url)}&download=${encodeURIComponent(attachment.name)}`;
  a.download = attachment.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function deleteAttachment(attachment) {
  if (!window.confirm(`Delete "${attachment.name}"?`)) return;

  const btn = document.querySelector(`[data-delete-id="${attachment.id}"]`);
  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  try {
    const key = await getApiKey();
    const isAuth = await t.getRestApi().isAuthorized();
    if (!isAuth) {
      await t.getRestApi().authorize({ scope: 'read,write' });
    }
    const token = await t.getRestApi().getToken();
    const { card } = t.getContext();

    const res = await fetch(
      `https://api.trello.com/1/cards/${card}/attachments/${attachment.id}?key=${key}&token=${token}`,
      { method: 'DELETE' }
    );
    if (!res.ok) throw new Error(`Trello API error ${res.status}`);

    await renderList();
  } catch (err) {
    console.error('Delete failed:', err);
    alert('Failed to delete. Please try again.');
    if (btn) { btn.disabled = false; btn.textContent = 'Delete'; }
  }
}

function renderItem(attachment) {
  const div = document.createElement('div');
  div.className = 'attachment-item';
  div.innerHTML = `
    <div class="attachment-info">
      <img src="/images/excel-icon.svg" class="file-icon" alt="Excel">
      <span class="file-name" title="${esc(attachment.name)}">${esc(attachment.name)}</span>
    </div>
    <div class="attachment-actions">
      <button class="btn btn-primary">Preview</button>
      <button class="btn btn-secondary">Download</button>
      <button class="btn btn-danger" data-delete-id="${esc(attachment.id)}">Delete</button>
    </div>
  `;
  const [previewBtn, downloadBtn, deleteBtn] = div.querySelectorAll('.btn');
  previewBtn.onclick = () => openPreview(attachment);
  downloadBtn.onclick = () => downloadAttachment(attachment);
  deleteBtn.onclick = () => deleteAttachment(attachment);
  return div;
}

async function renderList() {
  const app = document.getElementById('app');
  try {
    const card = await t.card('attachments');
    const files = (card.attachments || []).filter(isExcel);
    app.innerHTML = '';
    if (!files.length) {
      app.innerHTML = '<div class="empty-state">No Excel files attached.</div>';
    } else {
      files.forEach(f => app.appendChild(renderItem(f)));
    }
  } catch (err) {
    app.innerHTML = '<div class="error-state">Failed to load attachments.</div>';
    console.error(err);
  }
  t.sizeTo('#app').catch(() => {});
}

t.render(renderList);
