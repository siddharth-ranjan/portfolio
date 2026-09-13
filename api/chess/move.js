import { applyMove } from '../_lib/game.js';
import { getStore, ipSalt } from '../_lib/store.js';
import { readSid, newSid, sidCookie, ipHash } from '../_lib/session.js';
import { send, readJson, isLocalHost } from '../_lib/http.js';

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
    const ip = ipHash(req, ipSalt());
    const body = await readJson(req);
    const { status, body: out } = await applyMove(store, { ...body, sid, ipHash: ip }, Date.now());
    headers['Server-Timing'] = `app;dur=${Math.round(performance.now() - started)}`;
    return send(res, status, out, headers);
  } catch (err) {
    if (err.status !== 503 && err.status !== 413) console.error('chess/move', err);
    return send(res, err.status || 500, {
      ok: false, error: 'unavailable',
      message: err.status === 503 ? err.message : "Couldn't make that move. Try again."
    }, headers);
  }
}
