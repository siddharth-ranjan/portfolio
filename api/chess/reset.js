import { timingSafeEqual } from 'node:crypto';
import { START_FEN } from '../_lib/game.js';
import { getStore } from '../_lib/store.js';
import { send } from '../_lib/http.js';

// Start a fresh game. Only exists when CHESS_ADMIN_TOKEN is set in the environment.
export default async function handler(req, res) {
  const token = process.env.CHESS_ADMIN_TOKEN;
  if (!token) return send(res, 404, { ok: false, error: 'not-found' });
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method' }, { Allow: 'POST' });
  const given = Buffer.from(String(req.headers.authorization || ''));
  const expected = Buffer.from(`Bearer ${token}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return send(res, 401, { ok: false, error: 'unauthorized' });
  }
  try {
    const gameId = await getStore().forceNewGame(Date.now(), START_FEN);
    return send(res, 200, { ok: true, gameId }, { 'Cache-Control': 'no-store' });
  } catch (err) {
    return send(res, err.status === 503 ? 503 : 500, { ok: false, error: 'unavailable' });
  }
}
