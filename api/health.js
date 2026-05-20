// Lightweight uptime/health probe. Cheap, no auth, safe to expose publicly.
// Hook this up in UptimeRobot/Pingdom to be alerted if the deployment is down.
const STARTED_AT = Date.now();
const VERSION = '1.0.0';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    status: 'ok',
    version: VERSION,
    uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
    timestamp: new Date().toISOString()
  });
}
