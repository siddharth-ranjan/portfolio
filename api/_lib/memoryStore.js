// In-process store with the same contract as redisStore. Used by the tests and by
// `npm run dev` when no Upstash credentials are present. Not for production.
const emptyStats = () => ({ games: 0, whiteWins: 0, blackWins: 0, draws: 0 });

export function createMemoryStore() {
  let current = null;
  let seq = 0;
  const games = new Map();
  const movers = new Map();
  const locks = new Set();
  const limits = new Map();
  const stats = emptyStats();

  const newGame = (now, fen) => {
    seq += 1;
    current = String(seq);
    games.set(current, {
      fen, pgn: '', ply: '0', status: 'active', result: '',
      startedAt: String(now), lastMoveAt: '', endedAt: '', lastMove: '', lastSid: ''
    });
    return current;
  };

  const store = {
    async getCurrent() { return current; },
    async getGame(id) {
      const g = games.get(String(id));
      return g ? { ...g } : null;
    },
    async moverCount(id) { return movers.get(String(id))?.size || 0; },
    async isLastMover(id, sid) { return Boolean(sid) && games.get(String(id))?.lastSid === sid; },
    async getStats() { return { ...stats }; },

    // everything getState needs
    async snapshot() {
      const id = current;
      const g = id ? games.get(id) : null;
      return { id, game: g ? { ...g } : null, movers: movers.get(id)?.size || 0, stats: { ...stats } };
    },
    // everything a move needs, with the attempt counted against the network's limit
    async moveContext({ sid, ipHash, limit, windowSec }, now = Date.now()) {
      const allowed = await store.rateLimit(ipHash, limit, windowSec, now);
      const snap = await store.snapshot();
      return {
        allowed, ...snap,
        lastMover: Boolean(snap.game) && snap.game.lastSid === sid,
        playedBefore: Boolean(snap.id && movers.get(snap.id)?.has(sid))
      };
    },

    async startGame(prevId, now, fen) {
      const lock = String(prevId || 0);
      if (locks.has(lock)) return current;
      locks.add(lock);
      return newGame(now, fen);
    },
    async forceNewGame(now, fen) { return newGame(now, fen); },

    async commit(id, m) {
      const key = String(id);
      const g = games.get(key);
      if (!g) return 'nogame';
      if (g.status !== 'active') return 'over';
      if (Number(g.ply) !== Number(m.ply)) return 'stale';
      if (g.lastSid === m.sid) return 'consecutive';

      Object.assign(g, {
        fen: m.fen, pgn: m.pgn, ply: String(Number(m.ply) + 1), lastMoveAt: String(m.lastMoveAt),
        status: m.status, result: m.result, endedAt: String(m.endedAt), lastMove: m.lastMove, lastSid: m.sid
      });
      const set = movers.get(key) || new Set();
      set.add(m.sid);
      movers.set(key, set);
      if (m.status !== 'active') {
        stats.games += 1;
        if (m.result === '1-0') stats.whiteWins += 1;
        else if (m.result === '0-1') stats.blackWins += 1;
        else stats.draws += 1;
      }
      return 'ok';
    },

    async rateLimit(ipHash, limit, windowSec, now = Date.now()) {
      const entry = limits.get(ipHash);
      if (!entry || now >= entry.reset) {
        limits.set(ipHash, { n: 1, reset: now + windowSec * 1000 });
        return true;
      }
      entry.n += 1;
      return entry.n <= limit;
    },

    // tests only: put a game in a specific position
    _seed(id, fields) {
      current = String(id);
      seq = Math.max(seq, Number(id));
      games.set(String(id), {
        fen: '', pgn: '', ply: '0', status: 'active', result: '',
        startedAt: '0', lastMoveAt: '', endedAt: '', lastMove: '', lastSid: '', ...fields
      });
    }
  };
  return store;
}
