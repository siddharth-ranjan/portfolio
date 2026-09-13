// Upstash Redis store. Keys:
//   chess:current              id of the game being played
//   chess:ver                  "{id}:{ply}:{rseq}" — changes on every move, reaction and new game; watchers poll it
//   chess:seq                  game id sequence
//   chess:game:{id}            hash: fen pgn ply status result startedAt lastMoveAt endedAt lastMove lastSid rseq
//   chess:game:{id}:movers     set of visitor ids who have moved in that game (for the count)
//   chess:game:{id}:reactions  hash: "{ply}:{emoji}" -> count
//   chess:game:{id}:reacted    set of "{sid}:{ply}:{emoji}", so each visitor counts once
//   chess:stats                hash: games whiteWins blackWins draws
//   chess:rollover:{id}        lock so only one request starts the next game
//   chess:rl:{ipHash}          per-minute move-attempt counter
//   chess:rlr:{ipHash}         per-minute reaction counter
const K = {
  current: 'chess:current',
  ver: 'chess:ver',
  seq: 'chess:seq',
  stats: 'chess:stats',
  game: (id) => `chess:game:${id}`,
  movers: (id) => `chess:game:${id}:movers`,
  reactions: (id) => `chess:game:${id}:reactions`,
  reacted: (id) => `chess:game:${id}:reacted`,
  lock: (id) => `chess:rollover:${id || 0}`,
  rl: (hash) => `chess:rl:${hash}`,
  rlr: (hash) => `chess:rlr:${hash}`
};

const MONTH = 60 * 60 * 24 * 30;

// One round trip that checks and writes atomically: nobody else moved first and
// this visitor didn't make the previous move.
const COMMIT = `
local status = redis.call('HGET', KEYS[1], 'status')
if not status then return 'nogame' end
if status ~= 'active' then return 'over' end
if tonumber(redis.call('HGET', KEYS[1], 'ply')) ~= tonumber(ARGV[1]) then return 'stale' end
if redis.call('HGET', KEYS[1], 'lastSid') == ARGV[2] then return 'consecutive' end
redis.call('HSET', KEYS[1],
  'fen', ARGV[3], 'pgn', ARGV[4], 'ply', tonumber(ARGV[1]) + 1, 'lastMoveAt', ARGV[5],
  'status', ARGV[6], 'result', ARGV[7], 'endedAt', ARGV[8], 'lastMove', ARGV[9], 'lastSid', ARGV[2])
redis.call('SADD', KEYS[2], ARGV[2])
redis.call('SET', KEYS[4], ARGV[10] .. ':' .. (tonumber(ARGV[1]) + 1) .. ':' .. (redis.call('HGET', KEYS[1], 'rseq') or '0'))
if ARGV[6] ~= 'active' then
  redis.call('HINCRBY', KEYS[3], 'games', 1)
  if ARGV[7] == '1-0' then redis.call('HINCRBY', KEYS[3], 'whiteWins', 1)
  elseif ARGV[7] == '0-1' then redis.call('HINCRBY', KEYS[3], 'blackWins', 1)
  else redis.call('HINCRBY', KEYS[3], 'draws', 1) end
  redis.call('EXPIRE', KEYS[1], ${MONTH * 3})
  redis.call('EXPIRE', KEYS[2], ${MONTH})
end
return 'ok'
`;

// A reaction in one round trip: count the tap against the network, check it's the
// current game and a move that exists, add it once per visitor, bump the version.
// Returns { verdict, rseq, reactions (flat) }.
const REACT = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
if n > tonumber(ARGV[1]) then return {'limited'} end
if redis.call('GET', KEYS[2]) ~= ARGV[3] then return {'nogame'} end
local ply = tonumber(redis.call('HGET', KEYS[3], 'ply') or '-1')
local target = tonumber(ARGV[4])
if target < 1 or target > ply then return {'noply'} end
local verdict = 'dup'
if redis.call('SADD', KEYS[5], ARGV[6] .. ':' .. ARGV[4] .. ':' .. ARGV[5]) == 1 then
  redis.call('HINCRBY', KEYS[4], ARGV[4] .. ':' .. ARGV[5], 1)
  local r = redis.call('HINCRBY', KEYS[3], 'rseq', 1)
  redis.call('SET', KEYS[6], ARGV[3] .. ':' .. ply .. ':' .. r)
  redis.call('EXPIRE', KEYS[4], ARGV[7])
  redis.call('EXPIRE', KEYS[5], ARGV[7])
  verdict = 'ok'
end
return {verdict, tostring(redis.call('HGET', KEYS[3], 'rseq') or '0'), redis.call('HGETALL', KEYS[4])}
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
      startedAt: now, lastMoveAt: '', endedAt: '', lastMove: '', lastSid: '', rseq: 0
    });
    await Promise.all([redis.set(K.current, id), redis.set(K.ver, `${id}:0:0`)]);
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
    async isLastMover(id, sid) { return Boolean(sid) && String(await redis.hget(K.game(id), 'lastSid')) === sid; },
    // one command: what watchers poll to learn something happened
    async getVersion() {
      const v = await redis.get(K.ver);
      return v == null ? null : String(v);
    },
    async getStats() { return statsFrom(toObject(await redis.hgetall(K.stats))); },

    // Round trips matter: each is a request from the function to Upstash. The client
    // auto-pipelines commands started together into ONE HTTP call, so these fire in
    // parallel batches. getState costs 2 trips; a move costs 3 (context, commit); a reaction 1.
    async snapshot() {
      const id = await store.getCurrent();
      if (!id) return { id: null, game: null, movers: 0, stats: statsFrom({}), reactions: {} };
      const [g, count, st, rx] = await Promise.all([
        redis.hgetall(K.game(id)), redis.scard(K.movers(id)), redis.hgetall(K.stats), redis.hgetall(K.reactions(id))
      ]);
      const game = toObject(g);
      return {
        id, game: Object.keys(game).length ? game : null, movers: Number(count) || 0,
        stats: statsFrom(toObject(st)), reactions: toObject(rx)
      };
    },
    async moveContext({ sid, ipHash, limit, windowSec }) {
      const rl = K.rl(ipHash);
      // batch 1: count the attempt (SET NX keeps the window's TTL, INCR counts) and find the game
      const [, attempts, rawId] = await Promise.all([
        redis.set(rl, 0, { nx: true, ex: windowSec }), redis.incr(rl), redis.get(K.current)
      ]);
      const allowed = Number(attempts) <= limit;
      const id = rawId == null ? null : String(rawId);
      if (!allowed || !id) {
        return { allowed, id, game: null, movers: 0, stats: statsFrom({}), reactions: {}, lastMover: false, playedBefore: false };
      }
      // batch 2: the game (its lastSid says who moved last), whether this visitor has played before, and the counters
      const [g, played, count, st, rx] = await Promise.all([
        redis.hgetall(K.game(id)), redis.sismember(K.movers(id), sid), redis.scard(K.movers(id)),
        redis.hgetall(K.stats), redis.hgetall(K.reactions(id))
      ]);
      const game = toObject(g);
      return {
        allowed, id, game: Object.keys(game).length ? game : null,
        lastMover: game.lastSid === sid, playedBefore: Number(played) === 1,
        movers: Number(count) || 0, stats: statsFrom(toObject(st)), reactions: toObject(rx)
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
        [K.game(id), K.movers(id), K.stats, K.ver],
        [String(m.ply), m.sid, m.fen, m.pgn, String(m.lastMoveAt),
          m.status, m.result, String(m.endedAt), m.lastMove, String(id)]
      );
      return String(out);
    },
    async react({ id, ply, emoji, sid, ipHash, limit, windowSec }) {
      const out = await redis.eval(
        REACT,
        [K.rlr(ipHash), K.current, K.game(id), K.reactions(id), K.reacted(id), K.ver],
        [String(limit), String(windowSec), String(id), String(ply), emoji, sid, String(MONTH * 3)]
      );
      const [verdict, rseq, flat] = Array.isArray(out) ? out : [out];
      return { verdict: String(verdict), rseq: Number(rseq) || 0, reactions: toObject(flat) };
    },
    async rateLimit(ipHash, limit, windowSec) {
      const key = K.rl(ipHash);
      await redis.set(key, 0, { nx: true, ex: windowSec }); // INCR keeps this TTL
      return Number(await redis.incr(key)) <= limit;
    }
  };
  return store;
}
