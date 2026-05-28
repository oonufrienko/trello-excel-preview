const EXCEL_EXTS = new Set(['xls', 'xlsx', 'csv', 'xlsm', 'xlsb', 'ods', 'xlam', 'xltx', 'xltm']);

function isExcel(attachment) {
  const ext = (attachment.name || '').split('.').pop().toLowerCase();
  return EXCEL_EXTS.has(ext);
}

const APP_KEY = window.TRELLO_APP_KEY || '';

TrelloPowerUp.initialize({
  'attachment-sections': function (t, options) {
    const excel = (options.entries || []).filter(isExcel);
    if (!excel.length) return [];

    const base = window.location.origin;
    return [{
      id: 'excel-preview',
      claimed: excel,
      icon: base + '/images/excel-icon.svg',
      title: 'Excel Files',
      content: {
        type: 'iframe',
        url: t.signUrl(base + '/api/attachments-html'),
        height: excel.length * 56 + 24
      }
    }];
  },

  'authorization-status': function (t) {
    return t.getRestApi().isAuthorized().then(authorized => ({ authorized }));
  },

  'show-authorization': function (t) {
    return t.getRestApi().authorize({ scope: 'read,write' });
  },

  'show-settings': function (t) {
    return t.popup({
      title: 'Simple Excel Viewer — Settings',
      url: t.signUrl(window.location.origin + '/api/settings-html'),
      height: 220
    });
  },

  'on-enable': function (t) {
    return t.modal({
      url: t.signUrl(window.location.origin + '/welcome.html'),
      title: 'Welcome to Simple Excel Viewer',
      accentColor: '#217346'
    });
  }
}, {
  appKey: APP_KEY,
  appName: 'Excel Viewer'
});
