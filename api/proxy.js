const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

// Rate limit: 30 proxy requests per minute per client IP.
// In-memory map; per Vercel-instance cache. Good enough for Hobby — a single
// abusive client gets throttled, even if multiple instances run, each cap is
// the same. Switch to Upstash/Edge Config if we ever leave Hobby tier.
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 30;
const rateBuckets = new Map(); // ip -> { count, resetAt }

function rateLimitCheck(ip) {
  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateBuckets.set(ip, bucket);
  }
  bucket.count += 1;

  // Opportunistic cleanup so the Map doesn't grow unbounded across cold-starts.
  if (rateBuckets.size > 5000) {
    for (const [key, b] of rateBuckets) {
      if (b.resetAt < now) rateBuckets.delete(key);
    }
  }

  return {
    allowed: bucket.count <= RATE_LIMIT,
    remaining: Math.max(0, RATE_LIMIT - bucket.count),
    resetIn: Math.max(0, Math.ceil((bucket.resetAt - now) / 1000))
  };
}

function clientIp(req) {
  // Vercel forwards real client IP via x-forwarded-for (first hop).
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.socket && req.socket.remoteAddress || 'unknown';
}

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

  const ip = clientIp(req);
  const limit = rateLimitCheck(ip);
  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT));
  res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.resetIn));
    return res.status(429).json({
      error: 'Too many requests',
      detail: `Rate limit ${RATE_LIMIT}/min exceeded. Try again in ${limit.resetIn}s.`
    });
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
