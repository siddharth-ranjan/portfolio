import test from 'node:test';
import assert from 'node:assert/strict';
import { createRedisStore } from '../api/_lib/redisStore.js';
import { getState } from '../api/_lib/game.js';

const T0 = 1_700_000_000_000;

// Mimics @upstash/redis with automaticDeserialization: false — replies are raw,
// so HGETALL is a flat [field, value, …] array ([] for a missing hash).
function rawUpstash() {
  const kv = new Map();
  const hashes = new Map();
  const sets = new Map();
  return {
    async get(k) { return kv.has(k) ? kv.get(k) : null; },
    async set(k, v, opts = {}) {
      if (opts.nx && kv.has(k)) return null;
      kv.set(k, String(v));
      return 'OK';
    },
    async incr(k) {
      const n = Number(kv.get(k) || 0) + 1;
      kv.set(k, String(n));
      return n;
    },
    async hset(k, fields) {
      const h = hashes.get(k) || new Map();
      for (const [f, v] of Object.entries(fields)) h.set(f, String(v));
      hashes.set(k, h);
      return Object.keys(fields).length;
    },
    async hget(k, f) { return hashes.get(k)?.get(f) ?? null; },
    async hgetall(k) { return [...(hashes.get(k) || new Map()).entries()].flat(); },
    async scard(k) { return sets.get(k)?.size || 0; },
    async sismember(k, m) { return sets.get(k)?.has(m) ? 1 : 0; }
  };
}

test('the Upstash store reads hashes that come back as flat arrays', async () => {
  const store = createRedisStore(rawUpstash());
  const s = await getState(store, T0);
  assert.equal(s.gameId, '1');
  assert.equal(s.status, 'active');
  assert.equal(s.ply, 0);
  assert.equal(s.turn, 'w');
  assert.equal(s.nextGameAt, null);
  assert.deepEqual(s.stats, { games: 0, whiteWins: 0, blackWins: 0, draws: 0 });
});

test('polling an active game never starts a new one', async () => {
  const store = createRedisStore(rawUpstash());
  const first = await getState(store, T0);
  for (let i = 1; i <= 5; i++) {
    const again = await getState(store, T0 + i * 4000);
    assert.equal(again.gameId, first.gameId);
    assert.equal(again.status, 'active');
  }
});

test('a move context reads the game as an object and counts the attempt', async () => {
  const store = createRedisStore(rawUpstash());
  await getState(store, T0);
  const ctx = await store.moveContext({ sid: 'a'.repeat(32), ipHash: 'ip', limit: 20, windowSec: 60 });
  assert.equal(ctx.allowed, true);
  assert.equal(ctx.id, '1');
  assert.equal(ctx.game.status, 'active');
  assert.equal(ctx.lastMover, false);
  assert.equal(ctx.playedBefore, false);
  assert.equal(ctx.movers, 0);
  assert.deepEqual(ctx.stats, { games: 0, whiteWins: 0, blackWins: 0, draws: 0 });
});

test('starting a game sets the version watchers poll', async () => {
  const store = createRedisStore(rawUpstash());
  assert.equal(await store.getVersion(), null);
  await getState(store, T0);
  assert.equal(await store.getVersion(), '1:0:0');
});
