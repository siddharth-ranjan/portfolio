import { applyReaction } from '../_lib/game.js';
import { getStore, ipSalt } from '../_lib/store.js';
import { readSid, newSid, sidCookie, ipHash } from '../_lib/session.js';
import { send, readJson, isLocalHost } from '../_lib/http.js';

// POST { gameId, ply, emoji } — react to one move of the current game.
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method' }, { Allow: 'POST' });
  const headers = { 'Cache-Control': 'no-store' };
  const started = performance.now();
  try {
    const store = getStore();
    let sid = readSid(req);
    if (!sid) {
      sid = newSid();
      headers['Set-Cookie'] = sidCookie(sid, !isLocalHost(req));
    }
    const body = await readJson(req);
    const { status, body: out } = await applyReaction(store, { ...body, sid, ipHash: ipHash(req, ipSalt()) });
    headers['Server-Timing'] = `app;dur=${Math.round(performance.now() - started)}`;
    return send(res, status, out, headers);
  } catch (err) {
    if (err.status !== 503 && err.status !== 413) console.error('chess/react', err);
    return send(res, err.status || 500, {
      ok: false, error: 'unavailable',
      message: err.status === 503 ? err.message : "Couldn't send that reaction."
    }, headers);
  }
}
