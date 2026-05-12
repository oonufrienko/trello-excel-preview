const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_HOSTNAMES = [
  'trello-attachments.s3.amazonaws.com',
  'attachments.trello.com',
  'trello.com',
  'api.trello.com',
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

function buildTrelloFetch(urlStr, token) {
  const apiKey = process.env.TRELLO_API_KEY || '';
  try {
    const u = new URL(urlStr);
    const isTrelloApi = (u.hostname === 'trello.com' || u.hostname === 'api.trello.com')
      && u.pathname.startsWith('/1/');

    if (!isTrelloApi || !apiKey || !token) {
      return { url: urlStr, options: {} };
    }

    // Use api.trello.com (REST API host) with both query params + Authorization header
    u.hostname = 'api.trello.com';
    u.searchParams.set('key', apiKey);
    u.searchParams.set('token', token);

    return {
      url: u.toString(),
      options: {
        headers: {
          'Authorization': `OAuth oauth_consumer_key="${apiKey}", oauth_token="${token}"`
        }
      }
    };
  } catch {
    return { url: urlStr, options: {} };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, download, token } = req.query;

  if (!url || !isAllowedUrl(url)) {
    return res.status(400).json({ error: 'Invalid or disallowed URL' });
  }

  const { url: fetchUrl, options: fetchOptions } = buildTrelloFetch(url, token);

  try {
    const upstream = await fetch(fetchUrl, fetchOptions);

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      console.error(`Proxy ${upstream.status} from: ${fetchUrl.replace(/token=[^&]+/, 'token=***')}`);
      return res.status(upstream.status).json({
        error: 'Upstream error',
        status: upstream.status,
        detail: detail.substring(0, 300)
      });
    }

    const contentLength = parseInt(upstream.headers.get('content-length') || '0', 10);
    if (contentLength && contentLength > MAX_FILE_BYTES) {
      return res.status(413).json({
        error: 'File too large',
        detail: `File is ${(contentLength / 1024 / 1024).toFixed(1)} MB; preview limit is 25 MB.`
      });
    }

    const contentType =
      upstream.headers.get('content-type') || 'application/octet-stream';
    const buffer = await upstream.arrayBuffer();

    if (buffer.byteLength > MAX_FILE_BYTES) {
      return res.status(413).json({
        error: 'File too large',
        detail: 'File exceeded 25 MB during download.'
      });
    }

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
    res.status(500).json({ error: 'Proxy error', detail: err.message });
  }
}
