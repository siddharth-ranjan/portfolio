export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

// Vercel parses JSON bodies into req.body; the dev middleware hands over a raw stream.
export async function readJson(req, limit = 4096) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > limit) throw Object.assign(new Error('request body too large'), { status: 413 });
  }
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export const isLocalHost = (req) => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '');
