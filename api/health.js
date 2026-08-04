// Lightweight uptime/health probe. Cheap, no auth, safe to expose publicly.
// Hook this up in UptimeRobot/Pingdom to be alerted if the deployment is down.
const STARTED_AT = Date.now();
const VERSION = '1.0.0';

// Which commit is actually serving. Vercel fills VERCEL_GIT_COMMIT_SHA from the
// git metadata attached to the deployment, so `curl .../api/health` and
// `git rev-parse --short origin/main` can be compared at a glance — otherwise
// the only way to tell what production is running is to dig through the
// dashboard. VERCEL_TARGET_ENV separates production from a staged build.
const COMMIT = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || 'unknown';
const ENV = process.env.VERCEL_TARGET_ENV || process.env.VERCEL_ENV || 'unknown';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    status: 'ok',
    version: VERSION,
    commit: COMMIT,
    env: ENV,
    uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
    timestamp: new Date().toISOString()
  });
}
