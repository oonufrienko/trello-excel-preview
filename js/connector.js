const EXCEL_EXTS = new Set(['xls', 'xlsx', 'csv', 'xlsm', 'xlsb', 'ods', 'xlam', 'xltx', 'xltm']);

function isExcel(attachment) {
  const ext = (attachment.name || '').split('.').pop().toLowerCase();
  return EXCEL_EXTS.has(ext);
}

TrelloPowerUp.initialize({
  'attachment-sections': function (t, options) {
    const excel = (options.entries || []).filter(isExcel);
    if (!excel.length) return [];

    return [{
      id: 'excel-preview',
      claimed: excel,
      icon: t.signUrl('/images/excel-icon.svg'),
      title: 'Excel Files',
      content: {
        type: 'iframe',
        url: t.signUrl('/api/attachments-html'),
        height: excel.length * 56 + 24
      }
    }];
  }
});
