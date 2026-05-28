const t = TrelloPowerUp.iframe({ appKey: window.TRELLO_APP_KEY || '', appName: 'Excel Viewer' });

document.getElementById('auth-btn').onclick = async () => {
  try {
    await t.getRestApi().authorize({ scope: 'read,write' });
  } catch (err) {
    console.warn('Authorize cancelled or failed', err);
  }
  t.closePopup();
};

document.getElementById('cancel-btn').onclick = () => t.closePopup();

t.render(() => t.sizeTo('#app').catch(() => {}));
