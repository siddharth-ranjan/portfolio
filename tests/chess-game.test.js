import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStore } from '../api/_lib/memoryStore.js';
import { getState, applyMove, applyReaction, ROLLOVER_MS, START_FEN } from '../api/_lib/game.js';

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

test('a visitor cannot make two moves in a row', async () => {
  const store = createMemoryStore();
  let s = await getState(store, T0);
  s = (await play(store, s, visitor(1), 'e2', 'e4')).body.state;
  const again = await play(store, s, visitor(1), 'e7', 'e5');
  assert.equal(again.status, 403);
  assert.equal(again.body.error, 'consecutive');
  assert.equal((await getState(store, T0)).ply, 1);
});

test('once someone else replies, the same visitor can move again', async () => {
  const store = createMemoryStore();
  let s = await getState(store, T0);
  s = (await play(store, s, visitor(1), 'e2', 'e4')).body.state;
  s = (await play(store, s, visitor(2), 'e7', 'e5')).body.state;
  const r = await play(store, s, visitor(1), 'g1', 'f3');
  assert.equal(r.status, 200);
  assert.equal(r.body.state.movers, 2, 'a returning visitor is not counted twice');
  assert.deepEqual(r.body.state, await getState(store, T0));
});

test('a move made from an old position loses to the one that landed first', async () => {
  const store = createMemoryStore();
  const s = await getState(store, T0);
  assert.equal((await play(store, s, visitor(1), 'e2', 'e4')).status, 200);
  const late = await play(store, s, visitor(2), 'd2', 'd4');
  assert.equal(late.status, 409);
  assert.equal(late.body.error, 'stale');
});

test('people on the same network can play each other', async () => {
  const store = createMemoryStore();
  let s = await getState(store, T0);
  const moves = [['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6']];
  for (let i = 0; i < moves.length; i++) {
    const r = await play(store, s, { sid: `n${i % 2}`.padStart(32, '0'), ipHash: 'shared-office' }, ...moves[i]);
    assert.equal(r.status, 200);
    s = r.body.state;
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

test('the version watchers poll changes with every move and every new game', async () => {
  const store = createMemoryStore();
  let s = await getState(store, T0);
  assert.equal(await store.getVersion(), '1:0:0');
  s = (await play(store, s, visitor(1), 'e2', 'e4')).body.state;
  assert.equal(await store.getVersion(), '1:1:0');
  await play(store, s, visitor(1), 'e7', 'e5'); // rejected: no change
  assert.equal(await store.getVersion(), '1:1:0');
  await store.forceNewGame(T0, START_FEN);
  assert.equal(await store.getVersion(), '2:0:0');
});

const reactTo = (store, state, who, ply, emoji) => applyReaction(store, { gameId: state.gameId, ply, emoji, ...who });

test('a reaction counts once per visitor per move, bumps the version, and shows in the state', async () => {
  const store = createMemoryStore();
  const s = (await play(store, await getState(store, T0), visitor(1), 'e2', 'e4')).body.state;

  const first = await reactTo(store, s, visitor(2), 1, 'fire');
  assert.equal(first.status, 200);
  assert.equal(first.body.added, true);
  assert.deepEqual(first.body.reactions, { 1: { fire: 1 } });

  const again = await reactTo(store, s, visitor(2), 1, 'fire');
  assert.equal(again.body.added, false);
  assert.deepEqual(again.body.reactions, { 1: { fire: 1 } });

  await reactTo(store, s, visitor(3), 1, 'fire');
  await reactTo(store, s, visitor(3), 1, 'wow');
  assert.equal(await store.getVersion(), '1:1:3');

  const fresh = await getState(store, T0);
  assert.deepEqual(fresh.reactions, { 1: { fire: 2, wow: 1 } });
  assert.equal(fresh.rseq, 3);
});

test('reactions only go to moves that exist in the current game, with a known emoji', async () => {
  const store = createMemoryStore();
  const s = (await play(store, await getState(store, T0), visitor(1), 'e2', 'e4')).body.state;
  assert.equal((await reactTo(store, s, visitor(2), 2, 'fire')).status, 400);
  assert.equal((await reactTo(store, s, visitor(2), 0, 'fire')).status, 400);
  assert.equal((await reactTo(store, s, visitor(2), 1, 'poop')).status, 400);
  assert.equal((await reactTo(store, { gameId: '99' }, visitor(2), 1, 'fire')).status, 409);
  assert.equal((await reactTo(store, { gameId: '../x' }, visitor(2), 1, 'fire')).status, 400);
});

test('a move after reactions keeps them, and its state matches a fresh read', async () => {
  const store = createMemoryStore();
  let s = (await play(store, await getState(store, T0), visitor(1), 'e2', 'e4')).body.state;
  await reactTo(store, s, visitor(2), 1, 'brain');
  const r = await play(store, await getState(store, T0), visitor(2), 'e7', 'e5');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.state.reactions, { 1: { brain: 1 } });
  assert.deepEqual(r.body.state, await getState(store, T0));
  assert.equal(await store.getVersion(), '1:2:1');
});

test('a network tapping reactions too fast gets 429', async () => {
  const store = createMemoryStore();
  const s = (await play(store, await getState(store, T0), visitor(1), 'e2', 'e4')).body.state;
  let last;
  for (let i = 0; i < 61; i++) last = await applyReaction(store, { gameId: s.gameId, ply: 1, emoji: 'fire', sid: `r${i}`, ipHash: 'busy' });
  assert.equal(last.status, 429);
});

test('a visitor can take their own reaction back, once, and nobody else can', async () => {
  const store = createMemoryStore();
  const s = (await play(store, await getState(store, T0), visitor(1), 'e2', 'e4')).body.state;
  const takeBack = (who) => applyReaction(store, { gameId: s.gameId, ply: 1, emoji: 'fire', on: false, ...who });
  await reactTo(store, s, visitor(2), 1, 'fire');
  await reactTo(store, s, visitor(3), 1, 'fire');

  const back = await takeBack(visitor(2));
  assert.equal(back.status, 200);
  assert.equal(back.body.on, false);
  assert.equal(back.body.changed, true);
  assert.deepEqual(back.body.reactions, { 1: { fire: 1 } });

  const again = await takeBack(visitor(2));
  assert.equal(again.body.changed, false);
  assert.deepEqual(again.body.reactions, { 1: { fire: 1 } });

  const stranger = await takeBack(visitor(4));
  assert.equal(stranger.body.changed, false, 'cannot remove a reaction you never made');
  assert.deepEqual(stranger.body.reactions, { 1: { fire: 1 } });

  const last = await takeBack(visitor(3));
  assert.deepEqual(last.body.reactions, {}, 'the last one gone leaves the move with no reactions');
  assert.equal(await store.getVersion(), '1:1:4', 'two adds and two removals; no-ops do not move the version');
  const fresh = await getState(store, T0);
  assert.deepEqual(fresh.reactions, {});
  assert.equal(fresh.rseq, 4);

  const readd = await reactTo(store, s, visitor(2), 1, 'fire');
  assert.equal(readd.body.changed, true);
  assert.deepEqual(readd.body.reactions, { 1: { fire: 1 } });
});
