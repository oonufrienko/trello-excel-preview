const t = TrelloPowerUp.iframe({ appKey: window.TRELLO_APP_KEY || '', appName: 'Excel Viewer' });
const statusEl = document.getElementById('status');
const actionsEl = document.getElementById('actions');

function renderConnected() {
  statusEl.textContent = 'Authorized — Rename and Delete actions are enabled.';
  statusEl.className = 'settings-row settings-status connected';
  actionsEl.innerHTML = '';
  const btn = document.createElement('button');
  btn.className = 'btn btn-secondary';
  btn.textContent = 'Disconnect';
  btn.onclick = onDisconnect;
  actionsEl.appendChild(btn);
  actionsEl.hidden = false;
}

function renderDisconnected() {
  statusEl.textContent = 'Not authorized. Rename and Delete actions are unavailable until you authorize.';
  statusEl.className = 'settings-row settings-status disconnected';
  actionsEl.innerHTML = '';
  const btn = document.createElement('button');
  btn.className = 'btn btn-primary';
  btn.textContent = 'Authorize';
  btn.onclick = onAuthorize;
  actionsEl.appendChild(btn);
  actionsEl.hidden = false;
}

async function onAuthorize() {
  try {
    await t.getRestApi().authorize({ scope: 'read,write' });
    await refresh();
  } catch (err) {
    console.warn('Authorize cancelled or failed', err);
  }
}

async function onDisconnect() {
  try {
    await t.getRestApi().clearToken();
    await refresh();
  } catch (err) {
    console.error('Disconnect failed', err);
  }
}

async function refresh() {
  try {
    const authorized = await t.getRestApi().isAuthorized();
    if (authorized) renderConnected(); else renderDisconnected();
  } catch (err) {
    statusEl.textContent = 'Could not determine authorization status.';
    console.error(err);
  }
  t.sizeTo('#app').catch(() => {});
}

t.render(refresh);
