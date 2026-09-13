import { getStore } from '../_lib/store.js';
import { readSid } from '../_lib/session.js';
import { send } from '../_lib/http.js';

// Per-visitor and never cached: has this browser already moved in the current game?
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { ok: false, error: 'method' }, { Allow: 'GET, HEAD' });
  try {
    const store = getStore();
    const sid = readSid(req);
    const gameId = await store.getCurrent();
    const moved = Boolean(sid && gameId && (await store.hasMoved(gameId, sid)));
    return send(res, 200, { gameId, moved }, { 'Cache-Control': 'private, no-store' });
  } catch (err) {
    return send(res, err.status === 503 ? 503 : 500, { ok: false, error: 'unavailable' }, { 'Cache-Control': 'no-store' });
  }
}
