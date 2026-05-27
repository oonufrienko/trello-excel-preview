export default function handler(req, res) {
  const key = process.env.TRELLO_API_KEY || '';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://p.trellocdn.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https://*.trello.com https://*.amazonaws.com",
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
<body>
  <div id="app" class="attachment-list">
    <div class="loading">Loading…</div>
  </div>
  <script src="/js/attachments.js"></script>
</body>
</html>`);
}
