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
      const g = await redis.hgetall(K.game(id));
      return g && Object.keys(g).length ? g : null;
    },
    async moverCount(id) { return Number(await redis.scard(K.movers(id))) || 0; },
    async hasMoved(id, sid) { return Number(await redis.sismember(K.movers(id), sid)) === 1; },
    async getStats() {
      const s = (await redis.hgetall(K.stats)) || {};
      return {
        games: Number(s.games) || 0, whiteWins: Number(s.whiteWins) || 0,
        blackWins: Number(s.blackWins) || 0, draws: Number(s.draws) || 0
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
