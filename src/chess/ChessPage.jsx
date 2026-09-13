import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import TopBar from '../components/TopBar.jsx';
import Footer from '../components/Footer.jsx';
import { useTheme } from '../hooks/useTheme.js';
import Board from './Board.jsx';
import { useCrowdGame } from './useCrowdGame.js';

const ENDING = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  'insufficient-material': 'Draw by insufficient material',
  repetition: 'Draw by threefold repetition',
  'fifty-moves': 'Draw by the fifty-move rule'
};
const RESULT = { '1-0': 'White wins', '0-1': 'Black wins', '1/2-1/2': 'Draw' };
// ids must match REACTIONS in api/_lib/game.js
const REACTIONS = [
  ['fire', '🔥', 'Fire'],
  ['brain', '🧠', 'Big brain'],
  ['wow', '😮', 'Wow'],
  ['lol', '😂', 'Funny'],
  ['oops', '🤦', 'Oops']
];
const GLYPH = Object.fromEntries(REACTIONS.map(([id, glyph]) => [id, glyph]));

function useClock(running) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  return now;
}

function statusLine(state, error, now) {
  if (error) return error.message;
  if (!state) return 'Connecting to the game…';
  const side = state.turn === 'w' ? 'White' : 'Black';
  if (state.status === 'active') {
    const move = Math.floor(state.ply / 2) + 1;
    return `${side} to move · move ${move}${state.inCheck ? ' · check' : ''}`;
  }
  const secs = Math.max(0, Math.ceil((state.nextGameAt - now) / 1000));
  return `${ENDING[state.status] || 'Game over'} — ${RESULT[state.result] || 'finished'} · next game in ${secs}s`;
}

function pairs(history) {
  const out = [];
  for (let i = 0; i < history.length; i += 2) out.push([i / 2 + 1, history[i], history[i + 1]]);
  return out;
}

// the position after every move, for looking back through the game
function replay(history) {
  const game = new Chess();
  const frames = [{ fen: game.fen(), lastMove: null }];
  for (const san of history) {
    let move;
    try { move = game.move(san); } catch { break; }
    frames.push({ fen: game.fen(), lastMove: { from: move.from, to: move.to, san: move.san } });
  }
  return frames;
}

function topReaction(counts) {
  if (!counts) return null;
  let best = null;
  let total = 0;
  for (const [id, n] of Object.entries(counts)) {
    total += n;
    if (!best || n > counts[best]) best = id;
  }
  return total ? { glyph: GLYPH[best], total } : null;
}

export default function ChessPage() {
  const [theme, setTheme] = useTheme();
  const { state, error, notice, waiting, pending, canMove, submitMove, react, myReactions } = useCrowdGame();
  const now = useClock(Boolean(state?.nextGameAt));
  const side = state?.turn === 'w' ? 'White' : 'Black';
  const history = state?.history || [];
  const len = history.length;
  const frames = useMemo(() => replay(history), [history]);

  // null = live; a number = looking at the board after that many moves
  const [view, setView] = useState(null);
  useEffect(() => { setView(null); }, [state?.gameId]);
  const viewing = view != null && view < len && view < frames.length ? view : null;
  const go = (ply) => setView(ply >= len ? null : Math.max(0, ply));
  const step = (by) => setView((v) => {
    const next = Math.min(len, Math.max(0, (v ?? len) + by));
    return next >= len ? null : next;
  });

  // ← → step through the game (not while typing a move)
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select') || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const moveLabel = (ply) => (ply === 0 ? 'the start' : `${Math.ceil(ply / 2)}${ply % 2 ? '.' : '…'} ${history[ply - 1]}`);
  const target = viewing ?? state?.ply ?? 0; // the move reactions go to

  let you = null;
  if (state && !error && state.status === 'active') {
    if (viewing != null) you = 'Looking back — go live to play.';
    else if (waiting) you = 'You made the last move. Once someone else replies, you can move again.';
    else if (pending) you = 'Sending your move…';
    else you = `Your turn: play a move for ${side}.`;
  }

  const cell = (ply, san) => {
    const top = topReaction(state?.reactions?.[ply]);
    const cls = `chess-move${viewing == null && ply === len ? ' last' : ''}${viewing === ply ? ' viewing' : ''}`;
    return (
      <button type="button" className={cls} onClick={() => go(ply)} aria-current={viewing === ply ? 'step' : undefined}
        title={ply === len ? 'Back to the live board' : `Show the board after ${moveLabel(ply)}`}>
        {san}
        {top && <span className="chess-move-react" aria-label={`${top.total} reactions`}>{top.glyph}{top.total > 1 ? top.total : ''}</span>}
      </button>
    );
  };

  return (
    <>
      <a className="skip" href="#chess">Skip to content</a>
      <TopBar theme={theme} setTheme={setTheme} brandHidden={false} active="chess" base="/" />
      <main>
        <section id="chess" className="wrap block chess-page">
          <div className="block-head">
            <h1 className="chess-title">Crowd chess</h1>
            <span className="tag">One shared game · no two moves in a row</span>
          </div>
          <p className="block-sub">
            Everyone who visits plays the same game. Make a move for whichever side is to play —
            then someone else has to reply before you can move again.
          </p>

          <div className="chess-grid">
            <div className="panel chess-board-panel">
              <div className="panel-head">
                <span className="tag">{state ? `Game #${state.gameId}` : 'Game'}</span>
                <span className={`tag chess-live${state && !error && viewing == null ? ' is-live' : ''}`}>
                  {error ? 'offline' : viewing == null ? 'live' : 'replay'}
                </span>
              </div>
              <div className="chess-board-wrap">
                <Board
                  fen={state?.fen}
                  previewFen={viewing != null ? frames[viewing].fen : null}
                  lastMove={viewing != null ? frames[viewing].lastMove : state?.lastMove}
                  history={viewing != null ? history.slice(0, viewing) : history}
                  canMove={canMove && viewing == null}
                  onMove={submitMove}
                />
              </div>

              {len > 0 && (
                <div className="chess-replay">
                  <span className="chess-replay-label">
                    {viewing == null ? 'Live · pick a move to look back' : `After ${moveLabel(viewing)} · ${viewing} of ${len}`}
                  </span>
                  <button type="button" className="flow-btn" onClick={() => go(0)} disabled={viewing === 0} aria-label="Start position">⏮</button>
                  <button type="button" className="flow-btn" onClick={() => step(-1)} disabled={viewing === 0} aria-label="Previous move">◀</button>
                  <button type="button" className="flow-btn" onClick={() => step(1)} disabled={viewing == null} aria-label="Next move">▶</button>
                  <button type="button" className="flow-btn" onClick={() => setView(null)} disabled={viewing == null}>Live</button>
                </div>
              )}

              {state && target > 0 && (
                <div className="chess-react" role="group" aria-label={`React to ${moveLabel(target)}`}>
                  <span className="tag">React to {moveLabel(target)}</span>
                  <span className="chess-react-set">
                    {REACTIONS.map(([id, glyph, name]) => {
                      const n = state.reactions?.[target]?.[id] || 0;
                      const mine = myReactions.has(`${target}:${id}`);
                      return (
                        <button key={id} type="button" className={`chess-react-btn${mine ? ' is-mine' : ''}`}
                          onClick={() => react(target, id)} disabled={mine || Boolean(error)}
                          aria-pressed={mine} aria-label={`${name}${n ? `, ${n}` : ''}`} title={name}>
                          <span aria-hidden="true">{glyph}</span>
                          {n > 0 && <span className="n">{n}</span>}
                        </button>
                      );
                    })}
                  </span>
                </div>
              )}

              <p className="chess-status" role="status" aria-live="polite">{statusLine(state, error, now)}</p>
              {you && <p className={`chess-you${waiting || viewing != null ? ' is-done' : ''}`}>{you}</p>}
              {notice && <p className={`chess-notice ${notice.tone}`}>{notice.text}</p>}
            </div>

            <aside className="panel chess-side" aria-label="Game details">
              <div className="panel-head">
                <span className="tag">Moves</span>
                <span className="tag">{state ? `${state.movers} ${state.movers === 1 ? 'visitor' : 'visitors'} played` : '—'}</span>
              </div>
              <ol className="chess-moves">
                {len === 0 && <li className="chess-moves-empty">No moves yet. The first one could be yours.</li>}
                {pairs(history).map(([n, white, black]) => (
                  <li key={n}>
                    <span className="n">{n}.</span>
                    {cell(2 * n - 1, white)}
                    {black ? cell(2 * n, black) : <span />}
                  </li>
                ))}
              </ol>
              <dl className="spec spec-flush chess-stats">
                <div><dt>Games finished</dt><dd>{state?.stats.games ?? '—'}</dd></div>
                <div><dt>White wins</dt><dd>{state?.stats.whiteWins ?? '—'}</dd></div>
                <div><dt>Black wins</dt><dd>{state?.stats.blackWins ?? '—'}</dd></div>
                <div><dt>Draws</dt><dd>{state?.stats.draws ?? '—'}</dd></div>
              </dl>
            </aside>
          </div>
        </section>
      </main>
      <Footer base="/" />
    </>
  );
}
