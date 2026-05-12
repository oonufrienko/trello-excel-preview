export default function handler(req, res) {
  const key = process.env.TRELLO_API_KEY || '';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', 'frame-ancestors https://trello.com https://*.trello.com');
  res.setHeader('Cache-Control', 'no-store');
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/css/styles.css">
  <script>window.TRELLO_APP_KEY = "${key}";</script>
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
