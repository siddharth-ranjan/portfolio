import { Chess } from 'chess.js';

export const START_FEN = new Chess().fen();
export const ROLLOVER_MS = 60_000;                    // a finished game stays on screen this long
export const RATE_LIMIT = { limit: 20, windowSec: 60 }; // move attempts per network

const SQUARE = /^[a-h][1-8]$/;
const PROMOTION = /^[qrbn]$/;
const STAT_FOR = { '1-0': 'whiteWins', '0-1': 'blackWins' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// PGN is the source of truth, so threefold repetition sees the whole game.
export function loadGame(game) {
  const chess = new Chess();
  if (game.pgn) chess.loadPgn(game.pgn);
  else if (game.fen && game.fen !== START_FEN) chess.load(game.fen);
  return chess;
}

export function outcome(chess) {
  if (!chess.isGameOver()) return { status: 'active', result: '' };
  if (chess.isCheckmate()) return { status: 'checkmate', result: chess.turn() === 'w' ? '0-1' : '1-0' };
  if (chess.isStalemate()) return { status: 'stalemate', result: '1/2-1/2' };
  if (chess.isInsufficientMaterial()) return { status: 'insufficient-material', result: '1/2-1/2' };
  if (chess.isThreefoldRepetition()) return { status: 'repetition', result: '1/2-1/2' };
  return { status: 'fifty-moves', result: '1/2-1/2' };
}

export function buildState(id, game, movers, stats, chess = loadGame(game)) {
  const status = game.status;
  return {
    gameId: String(id),
    fen: chess.fen(),
    ply: Number(game.ply) || 0,
    turn: chess.turn(),
    inCheck: chess.inCheck(),
    status,
    result: game.result || null,
    history: chess.history(),
    lastMove: game.lastMove ? JSON.parse(game.lastMove) : null,
    movers,
    startedAt: Number(game.startedAt) || null,
    lastMoveAt: Number(game.lastMoveAt) || null,
    nextGameAt: status === 'active' ? null : Number(game.endedAt) + ROLLOVER_MS,
    stats
  };
}

const onScreen = (game, now) =>
  Boolean(game) && (game.status === 'active' || now - Number(game.endedAt || 0) < ROLLOVER_MS);

// The current game, starting a new one if there is none or the last has been over long enough.
export async function getState(store, now = Date.now()) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const snap = await store.snapshot();
    if (snap.id && onScreen(snap.game, now)) return buildState(snap.id, snap.game, snap.movers, snap.stats);
    const next = await store.startGame(snap.id, now, START_FEN);
    // another request holds the rollover lock: show the finished game, the next poll gets the new one
    if (next && snap.game && String(next) === String(snap.id)) {
      return buildState(snap.id, snap.game, snap.movers, snap.stats);
    }
    if (!next) await sleep(120); // another request is creating the very first game
  }
  throw Object.assign(new Error('Could not start a game.'), { status: 503 });
}

const reply = (status, error, message) => ({ status, body: { ok: false, error, message } });
const REJECTED = {
  stale: [409, 'stale', 'Someone moved first. Board refreshed.'],
  over: [409, 'game-over', 'This game has ended. A new one starts shortly.'],
  nogame: [409, 'new-game', 'A new game has started. Board refreshed.'],
  consecutive: [403, 'consecutive', 'You made the last move. Someone else has to reply before you move again.']
};

export async function applyMove(store, input, now = Date.now()) {
  const from = String(input.from || '');
  const to = String(input.to || '');
  if (!SQUARE.test(from) || !SQUARE.test(to)) return reply(400, 'bad-request', "That move isn't on the board.");
  if (!input.sid) return reply(400, 'bad-request', 'Missing visitor id.');

  const ctx = await store.moveContext({ sid: input.sid, ipHash: input.ipHash, ...RATE_LIMIT }, now);
  if (!ctx.allowed) return reply(429, 'rate-limited', 'Too many attempts. Give it a minute.');
  if (!ctx.id || !ctx.game || String(ctx.id) !== String(input.gameId)) return reply(...REJECTED.nogame);
  if (ctx.game.status !== 'active') return reply(...REJECTED.over);
  if (Number(ctx.game.ply) !== Number(input.ply)) return reply(...REJECTED.stale);
  if (ctx.lastMover) return reply(...REJECTED.consecutive);

  const chess = loadGame(ctx.game);
  const candidates = chess.moves({ square: from, verbose: true }).filter((m) => m.to === to);
  if (!candidates.length) return reply(400, 'illegal', "That move isn't legal here.");
  const promotes = candidates.some((m) => m.promotion);
  const promotion = promotes ? (PROMOTION.test(input.promotion || '') ? input.promotion : 'q') : undefined;
  const move = chess.move({ from, to, promotion });
  const { status, result } = outcome(chess);

  const ply = Number(input.ply);
  const lastMove = JSON.stringify({ from: move.from, to: move.to, san: move.san });
  const endedAt = status === 'active' ? '' : now;

  // the store re-checks game, ply and last mover atomically before writing
  const verdict = await store.commit(ctx.id, {
    ply, sid: input.sid,
    fen: chess.fen(), pgn: chess.pgn(), lastMoveAt: now, status, result, endedAt, lastMove
  });
  if (verdict !== 'ok') return reply(...(REJECTED[verdict] || [500, 'error', 'Something went wrong.']));

  // The commit succeeded, so we know exactly what's stored: build the new state from
  // it instead of reading everything back (saves a round trip on every move).
  const game = {
    ...ctx.game, fen: chess.fen(), pgn: chess.pgn(), ply: String(ply + 1),
    lastMoveAt: String(now), status, result, endedAt: String(endedAt), lastMove, lastSid: input.sid
  };
  const stat = STAT_FOR[result] || 'draws';
  const stats = status === 'active'
    ? ctx.stats
    : { ...ctx.stats, games: ctx.stats.games + 1, [stat]: ctx.stats[stat] + 1 };

  return {
    status: 200,
    body: {
      ok: true,
      move: { from: move.from, to: move.to, san: move.san },
      state: buildState(ctx.id, game, ctx.movers + (ctx.playedBefore ? 0 : 1), stats, chess)
    }
  };
}
