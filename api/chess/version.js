import { getStore } from '../_lib/store.js';
import { send } from '../_lib/http.js';

// What watching browsers poll every second: "{game}:{ply}", one Redis GET. The page
// asks with ?s={epoch second}, so everyone polling in the same second shares one
// CDN copy and the next second is always a fresh read.
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { ok: false, error: 'method' }, { Allow: 'GET, HEAD' });
  try {
    const started = performance.now();
    const v = await getStore().getVersion();
    const keyed = /[?&]s=/.test(req.url || '');
    return send(res, 200, { v }, {
      'Cache-Control': keyed ? 'public, max-age=0, s-maxage=60' : 'no-store',
      'Server-Timing': `app;dur=${Math.round(performance.now() - started)}`
    });
  } catch (err) {
    if (err.status !== 503) console.error('chess/version', err);
    return send(res, err.status === 503 ? 503 : 500, { ok: false, error: 'unavailable' }, { 'Cache-Control': 'no-store' });
  }
}
