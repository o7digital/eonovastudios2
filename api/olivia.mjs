export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const json = (status, body) => res.status(status).setHeader('Cache-Control', 'no-store').json(body);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(405, { error: 'Method not allowed' });
  }
  const origins = new Set([
    'https://eonovastudios.com', 'https://www.eonovastudios.com',
    'https://eon2.vercel.app',
    ...[process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL].filter(Boolean).map(host => `https://${host}`),
  ]);
  if (!origins.has(req.headers.origin)) return json(403, { error: 'Origin not allowed' });
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return json(415, { error: 'JSON required' });
  try {
    if (Buffer.byteLength(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {})) > 16000) return json(413, { error: 'Request too large' });
    let body;
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
    catch { return json(400, { error: 'Invalid JSON' }); }
    if (!body || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 2000 || !['es', 'en', 'fr'].includes(body.language) || body.consent !== true || (body.conversation != null && (typeof body.conversation !== 'string' || body.conversation.length > 180))) return json(400, { error: 'Invalid message' });
    if (!process.env.OLIVIA_GATEWAY_KEY) return json(503, { error: 'Olivia unavailable' });
    const response = await fetch('https://olivia.o7digitalgroup.com/eon2/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OLIVIA_GATEWAY_KEY}`, 'X-Visitor-IP': req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown' },
      body: JSON.stringify({ message: body.message.trim(), language: body.language, conversation: body.conversation }),
      signal: AbortSignal.timeout(57000),
    });
    if (!response.ok) return json([403, 429].includes(response.status) ? response.status : 503, { error: 'Olivia unavailable' });
    const data = await response.json();
    if (typeof data.answer !== 'string' || typeof data.conversation !== 'string') return json(503, { error: 'Olivia unavailable' });
    return json(200, { answer: data.answer, conversation: data.conversation });
  } catch { return json(503, { error: 'Olivia unavailable' }); }
}
