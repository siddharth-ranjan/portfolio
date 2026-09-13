import { getState } from '../_lib/game.js';
import { getStore } from '../_lib/store.js';
import { send } from '../_lib/http.js';

// Shared by every visitor, so the CDN can absorb polling: at most one database
// read a second per edge region, however many people are watching.
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { ok: false, error: 'method' }, { Allow: 'GET, HEAD' });
  try {
    const started = performance.now();
    const state = await getState(getStore(), Date.now());
    return send(res, 200, state, {
      'Cache-Control': 'public, max-age=0, s-maxage=1, stale-while-revalidate=2',
      'Server-Timing': `app;dur=${Math.round(performance.now() - started)}`
    });
  } catch (err) {
    if (err.status !== 503) console.error('chess/state', err);
    return send(res, err.status === 503 ? 503 : 500, {
      ok: false, error: 'unavailable',
      message: err.status === 503 ? err.message : 'Crowd chess is unavailable right now.'
    }, { 'Cache-Control': 'no-store' });
  }
}
