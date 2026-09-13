import { getState } from '../_lib/game.js';
import { getStore } from '../_lib/store.js';
import { send } from '../_lib/http.js';

// Shared by every visitor, so the CDN absorbs repeat reads. The page always asks with a
// key — ?v={game}:{ply} once it knows a move happened, or ?s={epoch second} — so a
// cached copy is never older than the thing it was asked for. No stale-while-revalidate:
// that is what used to show watchers an old board.
const keyed = (req) => /[?&](v|s)=/.test(req.url || '');

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { ok: false, error: 'method' }, { Allow: 'GET, HEAD' });
  try {
    const started = performance.now();
    const state = await getState(getStore(), Date.now());
    return send(res, 200, state, {
      'Cache-Control': keyed(req) ? 'public, max-age=0, s-maxage=60' : 'public, max-age=0, s-maxage=1',
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
