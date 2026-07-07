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

const DATE_FMT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function formatDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : DATE_FMT.format(d);
}

// appKey injected server-side into window.TRELLO_APP_KEY — enables t.getRestApi()
const t = TrelloPowerUp.iframe({ appKey: window.TRELLO_APP_KEY || '', appName: 'Excel Viewer' });

async function ensureToken() {
  try {
    const isAuth = await t.getRestApi().isAuthorized();
    if (!isAuth) {
      await t.getRestApi().authorize({ scope: 'read,write' });
    }
    return await t.getRestApi().getToken();
  } catch (err) {
    console.warn('Could not get user token:', err);
    return null;
  }
}

async function openPreview(attachment) {
  const userToken = await ensureToken();

  await t.set('card', 'private', 'excel-preview-data', {
    url: attachment.url,
    name: attachment.name,
    token: userToken
  });
  t.modal({
    title: attachment.name,
    url: t.signUrl(window.location.origin + '/api/preview-html'),
    fullscreen: true,
    accentColor: '#217346',
    actions: [{
      icon: window.location.origin + '/images/print-icon.svg',
      alt: 'Print',
      position: 'left',
      // Runs here (in the opener iframe), not in the preview iframe —
      // relay the click over a same-origin channel.
      callback: () => {
        const ch = new BroadcastChannel('excel-viewer-print');
        ch.postMessage({ type: 'print', url: attachment.url });
        ch.close();
      }
    }]
  });
}

async function downloadAttachment(attachment) {
  const token = await ensureToken();
  const params = new URLSearchParams({
    url: attachment.url,
    download: attachment.name
  });
  if (token) params.set('token', token);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let res;
  try {
    res = await fetch(`/api/proxy?${params}`, { signal: controller.signal });
  } catch (e) {
    clearTimeout(timeoutId);
    alert(e.name === 'AbortError'
      ? 'Download timed out. Please try again or use the file directly from Trello.'
      : `Download failed: ${e.message}`);
    return;
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      detail = err.detail || err.error || detail;
    } catch {}
    alert(`Download failed (${res.status}): ${detail}`);
    return;
  }

  try {
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = attachment.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (err) {
    console.error('Download failed:', err);
    alert(`Failed to download: ${err.message}`);
  }
}

async function renameAttachment(attachment) {
  const newName = window.prompt('Rename file to:', attachment.name);
  if (newName === null) return;
  const trimmed = newName.trim();
  if (!trimmed || trimmed === attachment.name) return;

  try {
    const token = await ensureToken();
    if (!token) {
      alert('Authorization required to rename.');
      return;
    }

    const { card } = t.getContext();
    const url = new URL(`https://api.trello.com/1/cards/${card}/attachments/${attachment.id}`);
    url.searchParams.set('key', window.TRELLO_APP_KEY || '');
    url.searchParams.set('token', token);
    url.searchParams.set('name', trimmed);

    const res = await fetch(url.toString(), { method: 'PUT' });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${text ? ': ' + text.substring(0, 100) : ''}`);
    }

    await renderList();
  } catch (err) {
    console.error('Rename failed:', err);
    alert(`Failed to rename: ${err.message}`);
  }
}

async function deleteAttachment(attachment) {
  if (!window.confirm(`Delete "${attachment.name}"?`)) return;

  try {
    const token = await ensureToken();
    if (!token) {
      alert('Authorization required to delete.');
      return;
    }

    const { card } = t.getContext();
    const res = await fetch(
      `https://api.trello.com/1/cards/${card}/attachments/${attachment.id}?key=${window.TRELLO_APP_KEY || ''}&token=${token}`,
      { method: 'DELETE' }
    );
    if (!res.ok) throw new Error(`Trello API error ${res.status}`);

    await renderList();
  } catch (err) {
    console.error('Delete failed:', err);
    alert(`Failed to delete: ${err.message}`);
  }
}

function showActionsPopup(attachment, mouseEvent) {
  t.popup({
    title: 'File actions',
    mouseEvent: mouseEvent,
    items: [
      {
        text: 'Download',
        callback: (popupT) => {
          popupT.closePopup();
          downloadAttachment(attachment);
        }
      },
      {
        text: 'Rename',
        callback: (popupT) => {
          popupT.closePopup();
          renameAttachment(attachment);
        }
      },
      {
        text: 'Delete',
        callback: (popupT) => {
          popupT.closePopup();
          deleteAttachment(attachment);
        }
      }
    ]
  });
}

function renderItem(attachment) {
  const div = document.createElement('div');
  div.className = 'attachment-item';
  div.innerHTML = `
    <div class="attachment-info">
      <img src="/images/excel-icon.svg" class="file-icon" alt="Excel">
      <div class="file-meta">
        <span class="file-name" title="${esc(attachment.name)}">${esc(attachment.name)}</span>
        <span class="file-date">${esc(formatDate(attachment.date))}</span>
      </div>
    </div>
    <div class="attachment-actions">
      <button class="btn btn-primary btn-preview">Preview</button>
      <button class="btn btn-icon btn-more" aria-label="More actions" title="More actions">⋯</button>
    </div>
  `;
  div.querySelector('.btn-preview').onclick = () => openPreview(attachment);
  div.querySelector('.btn-more').onclick = (e) => showActionsPopup(attachment, e);
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
