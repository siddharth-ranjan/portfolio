import { useEffect, useState } from 'react';
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

export default function ChessPage() {
  const [theme, setTheme] = useTheme();
  const { state, error, notice, moved, pending, canMove, submitMove } = useCrowdGame();
  const now = useClock(Boolean(state?.nextGameAt));
  const side = state?.turn === 'w' ? 'White' : 'Black';
  const history = state?.history || [];
  const lastIndex = history.length - 1;

  let you = null;
  if (state && !error && state.status === 'active') {
    if (moved) you = "You've made your move in this game. Watch it play out.";
    else if (pending) you = 'Sending your move…';
    else you = `Your turn: play one move for ${side}.`;
  }

  return (
    <>
      <a className="skip" href="#chess">Skip to content</a>
      <TopBar theme={theme} setTheme={setTheme} brandHidden={false} active="chess" base="/" />
      <main>
        <section id="chess" className="wrap block chess-page">
          <div className="block-head">
            <h1 className="chess-title">Crowd chess</h1>
            <span className="tag">One shared game · one move per visitor</span>
          </div>
          <p className="block-sub">
            Everyone who visits plays the same game, and each visitor gets exactly one move in it.
            Make yours for whichever side is to move, then come back and watch the game unfold.
          </p>

          <div className="chess-grid">
            <div className="panel chess-board-panel">
              <div className="panel-head">
                <span className="tag">{state ? `Game #${state.gameId}` : 'Game'}</span>
                <span className={`tag chess-live${state && !error ? ' is-live' : ''}`}>{error ? 'offline' : 'live'}</span>
              </div>
              <div className="chess-board-wrap">
                <Board
                  fen={state?.fen}
                  lastMove={state?.lastMove}
                  canMove={canMove}
                  onMove={submitMove}
                />
              </div>
              <p className="chess-status" role="status" aria-live="polite">{statusLine(state, error, now)}</p>
              {you && <p className={`chess-you${moved ? ' is-done' : ''}`}>{you}</p>}
              {notice && <p className={`chess-notice ${notice.tone}`}>{notice.text}</p>}
            </div>

            <aside className="panel chess-side" aria-label="Game details">
              <div className="panel-head">
                <span className="tag">Moves</span>
                <span className="tag">{state ? `${state.movers} ${state.movers === 1 ? 'visitor' : 'visitors'} played` : '—'}</span>
              </div>
              <ol className="chess-moves">
                {history.length === 0 && <li className="chess-moves-empty">No moves yet. The first one could be yours.</li>}
                {pairs(history).map(([n, white, black]) => (
                  <li key={n}>
                    <span className="n">{n}.</span>
                    <span className={2 * (n - 1) === lastIndex ? 'last' : undefined}>{white}</span>
                    <span className={2 * (n - 1) + 1 === lastIndex ? 'last' : undefined}>{black || ''}</span>
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
