import { Chess } from 'chess.js';

export const START_FEN = new Chess().fen();
export const IP_CAP = 3;           // moves per network per game (shared offices, campuses)
export const ROLLOVER_MS = 60_000; // a finished game stays on screen this long

const SQUARE = /^[a-h][1-8]$/;
const PROMOTION = /^[qrbn]$/;
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

// The current game, starting a new one if there is none or the last has been over long enough.
export async function ensureGame(store, now) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = await store.getCurrent();
    if (id) {
      const g = await store.getGame(id);
      if (g && (g.status === 'active' || now - Number(g.endedAt || 0) < ROLLOVER_MS)) return String(id);
    }
    const next = await store.startGame(id, now, START_FEN);
    if (next) return String(next);
    await sleep(120); // another request is creating the very first game
  }
  throw Object.assign(new Error('Could not start a game.'), { status: 503 });
}

export async function getState(store, now = Date.now()) {
  const id = await ensureGame(store, now);
  const [game, movers, stats] = await Promise.all([store.getGame(id), store.moverCount(id), store.getStats()]);
  const chess = loadGame(game);
  const status = game.status;
  return {
    gameId: id,
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

const reply = (status, error, message) => ({ status, body: { ok: false, error, message } });
const REJECTED = {
  stale: [409, 'stale', 'Someone moved first. Board refreshed.'],
  over: [409, 'game-over', 'This game has ended. A new one starts shortly.'],
  nogame: [409, 'new-game', 'A new game has started. Board refreshed.'],
  moved: [403, 'already-moved', "You've already moved in this game. One move per visitor — watch it play out."],
  ipcap: [403, 'network-limit', 'Your network has used its moves for this game. Catch the next one.']
};

export async function applyMove(store, input, now = Date.now()) {
  const from = String(input.from || '');
  const to = String(input.to || '');
  if (!SQUARE.test(from) || !SQUARE.test(to)) return reply(400, 'bad-request', "That move isn't on the board.");
  if (!input.sid) return reply(400, 'bad-request', 'Missing visitor id.');

  const id = await store.getCurrent();
  if (!id || String(id) !== String(input.gameId)) return reply(...REJECTED.nogame);
  const game = await store.getGame(id);
  if (!game) return reply(...REJECTED.nogame);
  if (game.status !== 'active') return reply(...REJECTED.over);
  if (Number(game.ply) !== Number(input.ply)) return reply(...REJECTED.stale);
  if (await store.hasMoved(id, input.sid)) return reply(...REJECTED.moved);

  const chess = loadGame(game);
  const candidates = chess.moves({ square: from, verbose: true }).filter((m) => m.to === to);
  if (!candidates.length) return reply(400, 'illegal', "That move isn't legal here.");
  const promotes = candidates.some((m) => m.promotion);
  const promotion = promotes ? (PROMOTION.test(input.promotion || '') ? input.promotion : 'q') : undefined;
  const move = chess.move({ from, to, promotion });
  const { status, result } = outcome(chess);

  // the store re-checks ply, visitor and network atomically before writing
  const verdict = await store.commit(id, {
    ply: Number(input.ply), sid: input.sid, ipHash: input.ipHash, ipCap: IP_CAP,
    fen: chess.fen(), pgn: chess.pgn(), lastMoveAt: now, status, result,
    endedAt: status === 'active' ? '' : now,
    lastMove: JSON.stringify({ from: move.from, to: move.to, san: move.san })
  });
  if (verdict !== 'ok') return reply(...(REJECTED[verdict] || [500, 'error', 'Something went wrong.']));

  return {
    status: 200,
    body: { ok: true, move: { from: move.from, to: move.to, san: move.san }, state: await getState(store, now) }
  };
}
