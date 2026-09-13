import { fetchRecent } from '../_lib/lastfm.js';
import { send } from '../_lib/http.js';

// GET — what's playing and the last five songs, from Last.fm. The CDN keeps it 30s so
// visitors never reach Last.fm directly; an older copy is fine for a music card.
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { ok: false, error: 'method' }, { Allow: 'GET, HEAD' });
  // trimmed: a value pasted into Vercel with a stray space or newline is a different user
  const apiKey = (process.env.LASTFM_API_KEY || '').trim();
  const user = (process.env.LASTFM_USER || '').trim();
  if (!apiKey || !user) {
    return send(res, 503, { ok: false, error: 'not-configured' }, { 'Cache-Control': 'public, max-age=0, s-maxage=60' });
  }
  const started = performance.now();
  try {
    // LASTFM_API_BASE only exists to point local testing at a fixture server
    const data = await fetchRecent({ apiKey, user, base: process.env.LASTFM_API_BASE || undefined });
    return send(res, 200, { ok: true, ...data }, {
      'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=300',
      'Server-Timing': `lastfm;dur=${Math.round(performance.now() - started)}`
    });
  } catch (err) {
    console.error('music/recent', err.message);
    return send(res, 502, { ok: false, error: 'upstream' }, { 'Cache-Control': 'public, max-age=0, s-maxage=15' });
  }
}
