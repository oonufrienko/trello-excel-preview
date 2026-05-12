const ALLOWED_HOSTNAMES = [
  'trello-attachments.s3.amazonaws.com',
  'attachments.trello.com',
  'trello.com',
  'cdn.trello.com',
  'trello-members.s3.amazonaws.com'
];

function isAllowedUrl(urlStr) {
  try {
    const { protocol, hostname } = new URL(urlStr);
    if (protocol !== 'https:') return false;
    return ALLOWED_HOSTNAMES.some(
      h => hostname === h || hostname.endsWith('.' + h)
    );
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, download } = req.query;

  if (!url || !isAllowedUrl(url)) {
    return res.status(400).json({ error: 'Invalid or disallowed URL' });
  }

  try {
    const upstream = await fetch(url);

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'Upstream error' });
    }

    const contentType =
      upstream.headers.get('content-type') || 'application/octet-stream';
    const buffer = await upstream.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');

    if (download) {
      const safe = String(download).replace(/[^\w.\-() ]/g, '_');
      res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
    }

    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Proxy error' });
  }
}
