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
    <div class="settings-row">
      Simple Excel Viewer needs access to your Trello account to enable
      Rename and Delete actions on attachments. You can disconnect any
      time from the Power-Up Settings.
    </div>
    <div class="settings-actions">
      <button id="auth-btn" class="btn btn-primary">Authorize</button>
      <button id="cancel-btn" class="btn btn-secondary">Cancel</button>
    </div>
  </div>
  <script src="/js/auth.js"></script>
</body>
</html>`);
}
