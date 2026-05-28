export default function handler(req, res) {
  const key = process.env.TRELLO_API_KEY || '';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://p.trellocdn.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https://*.trello.com",
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
  <link rel="stylesheet" href="/css/styles.css">
  <script>window.TRELLO_APP_KEY = ${JSON.stringify(key)};</script>
  <script src="https://p.trellocdn.com/power-up.min.js"></script>
</head>
<body class="settings-page">
  <div id="app" class="settings-container">
    <div id="status" class="settings-row settings-status">Checking authorization…</div>
    <div id="actions" class="settings-actions" hidden></div>
    <div class="settings-links">
      <a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a>
      <span class="dot">·</span>
      <a href="/terms.html" target="_blank" rel="noopener">Terms of Use</a>
    </div>
  </div>
  <script src="/js/settings.js"></script>
</body>
</html>`);
}
