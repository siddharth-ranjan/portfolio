import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStore } from '../api/_lib/memoryStore.js';
import { getState, applyMove, ROLLOVER_MS, IP_CAP } from '../api/_lib/game.js';

const T0 = 1_700_000_000_000;
const visitor = (n) => ({ sid: String(n).padStart(32, '0'), ipHash: `ip-${n}` });
const play = (store, state, who, from, to, extra = {}, now = T0) =>
  applyMove(store, { gameId: state.gameId, ply: state.ply, from, to, ...who, ...extra }, now);

test('the first read starts a game from the initial position', async () => {
  const s = await getState(createMemoryStore(), T0);
  assert.equal(s.gameId, '1');
  assert.equal(s.ply, 0);
  assert.equal(s.turn, 'w');
  assert.equal(s.status, 'active');
  assert.deepEqual(s.history, []);
  assert.equal(s.movers, 0);
});

test('a legal move is applied and the new state comes back with it', async () => {
  const store = createMemoryStore();
  const r = await play(store, await getState(store, T0), visitor(1), 'e2', 'e4');
  assert.equal(r.status, 200);
  assert.equal(r.body.move.san, 'e4');
  assert.equal(r.body.state.ply, 1);
  assert.equal(r.body.state.turn, 'b');
  assert.equal(r.body.state.movers, 1);
  assert.deepEqual(r.body.state.lastMove, { from: 'e2', to: 'e4', san: 'e4' });
});

test('illegal moves and off-board squares are rejected without changing the game', async () => {
  const store = createMemoryStore();
  const s = await getState(store, T0);
  assert.equal((await play(store, s, visitor(1), 'e2', 'e5')).status, 400);
  assert.equal((await play(store, s, visitor(1), 'z9', 'e4')).status, 400);
  assert.equal((await play(store, s, visitor(1), 'e7', 'e5')).status, 400); // black piece on white's turn
  assert.equal((await getState(store, T0)).ply, 0);
});

test('one move per visitor per game', async () => {
  const store = createMemoryStore();
  let s = await getState(store, T0);
  s = (await play(store, s, visitor(1), 'e2', 'e4')).body.state;
  s = (await play(store, s, visitor(2), 'e7', 'e5')).body.state;
  const again = await play(store, s, visitor(1), 'g1', 'f3');
  assert.equal(again.status, 403);
  assert.equal(again.body.error, 'already-moved');
});

test('a move made from an old position loses to the one that landed first', async () => {
  const store = createMemoryStore();
  const s = await getState(store, T0);
  assert.equal((await play(store, s, visitor(1), 'e2', 'e4')).status, 200);
  const late = await play(store, s, visitor(2), 'd2', 'd4');
  assert.equal(late.status, 409);
  assert.equal(late.body.error, 'stale');
});

test(`at most ${IP_CAP} moves per network per game`, async () => {
  const store = createMemoryStore();
  let s = await getState(store, T0);
  const moves = [['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6']];
  for (let i = 0; i < moves.length; i++) {
    const r = await play(store, s, { sid: `n${i}`.padStart(32, '0'), ipHash: 'shared-office' }, ...moves[i]);
    if (i < IP_CAP) {
      assert.equal(r.status, 200);
      s = r.body.state;
    } else {
      assert.equal(r.status, 403);
      assert.equal(r.body.error, 'network-limit');
    }
  }
});

test('a pawn reaching the last rank promotes: queen by default, or the piece asked for', async () => {
  const lone = '8/P7/8/8/8/8/8/k6K w - - 0 1';
  const a = createMemoryStore();
  a._seed(1, { fen: lone });
  const queen = await play(a, await getState(a, T0), visitor(1), 'a7', 'a8');
  assert.equal(queen.status, 200);
  assert.equal(queen.body.move.san, 'a8=Q+');

  const b = createMemoryStore();
  b._seed(1, { fen: lone });
  const knight = await play(b, await getState(b, T0), visitor(1), 'a7', 'a8', { promotion: 'n' });
  assert.equal(knight.body.move.san, 'a8=N');
  // history survives a reload from the stored PGN of a game that began from a set-up position
  assert.deepEqual((await getState(b, T0)).history, ['a8=N']);
});

test('checkmate ends the game, counts the result, and the next game starts after the grace period', async () => {
  const store = createMemoryStore();
  let s = await getState(store, T0);
  const foolsMate = [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']];
  for (let i = 0; i < foolsMate.length; i++) {
    const r = await play(store, s, visitor(i + 1), ...foolsMate[i]);
    assert.equal(r.status, 200);
    s = r.body.state;
  }
  assert.equal(s.status, 'checkmate');
  assert.equal(s.result, '0-1');
  assert.equal(s.nextGameAt, T0 + ROLLOVER_MS);
  assert.deepEqual(s.stats, { games: 1, whiteWins: 0, blackWins: 1, draws: 0 });

  const late = await play(store, s, visitor(9), 'a2', 'a3');
  assert.equal(late.status, 409);
  assert.equal(late.body.error, 'game-over');

  assert.equal((await getState(store, T0 + ROLLOVER_MS - 1)).gameId, s.gameId);
  const next = await getState(store, T0 + ROLLOVER_MS + 1);
  assert.notEqual(next.gameId, s.gameId);
  assert.equal(next.status, 'active');
  assert.equal(next.ply, 0);
  assert.equal((await getState(store, T0 + ROLLOVER_MS + 5)).gameId, next.gameId, 'only one new game');

  // everyone gets a fresh move in the new game
  const fresh = await play(store, next, visitor(1), 'e2', 'e4', {}, T0 + ROLLOVER_MS + 10);
  assert.equal(fresh.status, 200);
});

test('the per-minute attempt limit resets after its window', async () => {
  const store = createMemoryStore();
  for (let i = 0; i < 20; i++) assert.equal(await store.rateLimit('ip', 20, 60, T0), true);
  assert.equal(await store.rateLimit('ip', 20, 60, T0), false);
  assert.equal(await store.rateLimit('ip', 20, 60, T0 + 60_001), true);
});

test('the state sent back with a move matches a fresh read', async () => {
  const store = createMemoryStore();
  const r = await play(store, await getState(store, T0), visitor(1), 'e2', 'e4');
  assert.deepEqual(r.body.state, await getState(store, T0));
});

test('the state sent back with a game-ending move matches a fresh read, stats included', async () => {
  const store = createMemoryStore();
  let s = await getState(store, T0);
  let r;
  for (const [i, [from, to]] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']].entries()) {
    r = await play(store, s, visitor(i + 1), from, to);
    s = r.body.state;
  }
  assert.equal(r.body.state.status, 'checkmate');
  assert.deepEqual(r.body.state, await getState(store, T0));
});

test('a network making too many move attempts gets 429', async () => {
  const store = createMemoryStore();
  const s = await getState(store, T0);
  let last;
  for (let i = 0; i < 21; i++) {
    last = await applyMove(store, { gameId: s.gameId, ply: 999, from: 'e2', to: 'e4', sid: String(i).padStart(32, '0'), ipHash: 'busy' }, T0);
  }
  assert.equal(last.status, 429);
  assert.equal(last.body.error, 'rate-limited');
});
