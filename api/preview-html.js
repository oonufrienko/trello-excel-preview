const KOFI_URL = process.env.KOFI_URL || 'https://ko-fi.com/river44';

export default function handler(req, res) {
  const key = process.env.TRELLO_API_KEY || '';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.sheetjs.com https://cdnjs.cloudflare.com https://p.trellocdn.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: https://*.trello.com https://*.amazonaws.com",
    "connect-src 'self' https://trello.com https://*.trello.com https://*.trellocdn.com",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors https://trello.com https://*.trello.com"
  ].join('; '));
  res.setHeader('Cache-Control', 'no-store');
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="dns-prefetch" href="https://cdnjs.cloudflare.com">
  <link rel="dns-prefetch" href="https://cdn.sheetjs.com">
  <link rel="dns-prefetch" href="https://p.trellocdn.com">
  <link rel="stylesheet" href="/css/styles.css">
  <script>window.TRELLO_APP_KEY = ${JSON.stringify(key)};</script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
  <script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
  <script src="https://p.trellocdn.com/power-up.min.js"></script>
</head>
<body class="preview-page">
  <div id="app" class="preview-container">
    <div id="preview-header" class="preview-header">
      <button id="print-btn" class="header-btn" type="button" title="Print" aria-label="Print">
        <img src="/images/print-icon.svg" alt="Print">
      </button>
      <a id="donate-btn" class="header-btn" href="${KOFI_URL}" target="_blank"
         rel="noopener noreferrer" title="Support the project ❤️" aria-label="Support the project ❤️">
        <img src="/images/donate-icon.svg" alt="Support the project ❤️">
      </a>
    </div>
    <div id="loading" class="loading">Loading file…</div>
    <div id="error" class="error-state" hidden></div>
    <div id="sheet-tabs" class="sheet-tabs" hidden></div>
    <div id="sheet-content" class="sheet-content" hidden></div>
  </div>
  <footer class="preview-footer">
    <span>Built with AI. Product direction by Oleksandr Onufrienko.</span>
    <a href="${KOFI_URL}" target="_blank" rel="noopener noreferrer" class="kofi-link">☕ Support on Ko-fi</a>
  </footer>
  <script src="/js/preview.js"></script>
</body>
</html>`);
}
