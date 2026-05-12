export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  res.json({ apiKey: process.env.TRELLO_API_KEY || '' });
}
