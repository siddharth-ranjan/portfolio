// Upstash Redis store. Keys:
//   chess:current            id of the game being played
//   chess:seq                game id sequence
//   chess:game:{id}          hash: fen pgn ply status result startedAt lastMoveAt endedAt lastMove
//   chess:game:{id}:movers   set of visitor ids who have moved in that game
//   chess:game:{id}:ips      hash: ip hash -> moves made in that game
//   chess:stats              hash: games whiteWins blackWins draws
//   chess:rollover:{id}      lock so only one request starts the next game
//   chess:rl:{ipHash}        per-minute move-attempt counter
const K = {
  current: 'chess:current',
  seq: 'chess:seq',
  stats: 'chess:stats',
  game: (id) => `chess:game:${id}`,
  movers: (id) => `chess:game:${id}:movers`,
  ips: (id) => `chess:game:${id}:ips`,
  lock: (id) => `chess:rollover:${id || 0}`,
  rl: (hash) => `chess:rl:${hash}`
};

const MONTH = 60 * 60 * 24 * 30;

// One round trip that checks and writes atomically: nobody else moved first,
// this visitor hasn't moved, their network isn't over its cap.
const COMMIT = `
local status = redis.call('HGET', KEYS[1], 'status')
if not status then return 'nogame' end
if status ~= 'active' then return 'over' end
if tonumber(redis.call('HGET', KEYS[1], 'ply')) ~= tonumber(ARGV[1]) then return 'stale' end
if redis.call('SISMEMBER', KEYS[2], ARGV[2]) == 1 then return 'moved' end
if tonumber(redis.call('HGET', KEYS[3], ARGV[3]) or '0') >= tonumber(ARGV[4]) then return 'ipcap' end
redis.call('HSET', KEYS[1],
  'fen', ARGV[5], 'pgn', ARGV[6], 'ply', tonumber(ARGV[1]) + 1, 'lastMoveAt', ARGV[7],
  'status', ARGV[8], 'result', ARGV[9], 'endedAt', ARGV[10], 'lastMove', ARGV[11])
redis.call('SADD', KEYS[2], ARGV[2])
redis.call('HINCRBY', KEYS[3], ARGV[3], 1)
if ARGV[8] ~= 'active' then
  redis.call('HINCRBY', KEYS[4], 'games', 1)
  if ARGV[9] == '1-0' then redis.call('HINCRBY', KEYS[4], 'whiteWins', 1)
  elseif ARGV[9] == '0-1' then redis.call('HINCRBY', KEYS[4], 'blackWins', 1)
  else redis.call('HINCRBY', KEYS[4], 'draws', 1) end
  redis.call('EXPIRE', KEYS[1], ${MONTH * 3})
  redis.call('EXPIRE', KEYS[2], ${MONTH})
  redis.call('EXPIRE', KEYS[3], ${MONTH})
end
return 'ok'
`;

// The client runs with automaticDeserialization off, which makes HGETALL come back as
// the raw Redis reply: a flat [field, value, field, value, …] array, or [] when the
// hash doesn't exist. Accept that and the object form.
function toObject(reply) {
  if (!reply) return {};
  if (!Array.isArray(reply)) return reply;
  const out = {};
  for (let i = 0; i + 1 < reply.length; i += 2) out[reply[i]] = reply[i + 1];
  return out;
}

const statsFrom = (s) => ({
  games: Number(s.games) || 0, whiteWins: Number(s.whiteWins) || 0,
  blackWins: Number(s.blackWins) || 0, draws: Number(s.draws) || 0
});

export function createRedisStore(redis) {
  const newGame = async (now, fen) => {
    const id = String(await redis.incr(K.seq));
    await redis.hset(K.game(id), {
      fen, pgn: '', ply: 0, status: 'active', result: '',
      startedAt: now, lastMoveAt: '', endedAt: '', lastMove: ''
    });
    await redis.set(K.current, id);
    return id;
  };

  const store = {
    async getCurrent() {
      const v = await redis.get(K.current);
      return v == null ? null : String(v);
    },
    async getGame(id) {
      const g = toObject(await redis.hgetall(K.game(id)));
      return Object.keys(g).length ? g : null;
    },
    async moverCount(id) { return Number(await redis.scard(K.movers(id))) || 0; },
    async hasMoved(id, sid) { return Number(await redis.sismember(K.movers(id), sid)) === 1; },
    async getStats() { return statsFrom(toObject(await redis.hgetall(K.stats))); },

    // Round trips matter: each is a request from the function to Upstash. The client
    // auto-pipelines commands started together into ONE HTTP call, so these fire in
    // parallel batches. getState costs 2 trips; a move costs 3 (context, commit).
    async snapshot() {
      const id = await store.getCurrent();
      if (!id) return { id: null, game: null, movers: 0, stats: statsFrom({}) };
      const [g, count, st] = await Promise.all([
        redis.hgetall(K.game(id)), redis.scard(K.movers(id)), redis.hgetall(K.stats)
      ]);
      const game = toObject(g);
      return { id, game: Object.keys(game).length ? game : null, movers: Number(count) || 0, stats: statsFrom(toObject(st)) };
    },
    async moveContext({ sid, ipHash, limit, windowSec }) {
      const rl = K.rl(ipHash);
      // batch 1: count the attempt (SET NX keeps the window's TTL, INCR counts) and find the game
      const [, attempts, rawId] = await Promise.all([
        redis.set(rl, 0, { nx: true, ex: windowSec }), redis.incr(rl), redis.get(K.current)
      ]);
      const allowed = Number(attempts) <= limit;
      const id = rawId == null ? null : String(rawId);
      if (!allowed || !id) return { allowed, id, game: null, movers: 0, stats: statsFrom({}), moved: false };
      // batch 2: the game, whether this visitor already moved, and the counters
      const [g, moved, count, st] = await Promise.all([
        redis.hgetall(K.game(id)), redis.sismember(K.movers(id), sid), redis.scard(K.movers(id)), redis.hgetall(K.stats)
      ]);
      const game = toObject(g);
      return {
        allowed, id, game: Object.keys(game).length ? game : null,
        moved: Number(moved) === 1, movers: Number(count) || 0, stats: statsFrom(toObject(st))
      };
    },
    async startGame(prevId, now, fen) {
      const acquired = await redis.set(K.lock(prevId), '1', { nx: true, ex: 30 });
      if (acquired !== 'OK') return store.getCurrent();
      return newGame(now, fen);
    },
    async forceNewGame(now, fen) { return newGame(now, fen); },
    async commit(id, m) {
      const out = await redis.eval(
        COMMIT,
        [K.game(id), K.movers(id), K.ips(id), K.stats],
        [String(m.ply), m.sid, m.ipHash, String(m.ipCap), m.fen, m.pgn, String(m.lastMoveAt),
          m.status, m.result, String(m.endedAt), m.lastMove]
      );
      return String(out);
    },
    async rateLimit(ipHash, limit, windowSec) {
      const key = K.rl(ipHash);
      await redis.set(key, 0, { nx: true, ex: windowSec }); // INCR keeps this TTL
      return Number(await redis.incr(key)) <= limit;
    }
  };
  return store;
}
