export default function handler(req, res) {
  const key = process.env.TRELLO_API_KEY || '';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script>window.TRELLO_APP_KEY = ${JSON.stringify(key)};</script>
  <script src="https://p.trellocdn.com/power-up.min.js"></script>
  <script src="/js/connector.js"></script>
</head>
<body></body>
</html>`);
}
