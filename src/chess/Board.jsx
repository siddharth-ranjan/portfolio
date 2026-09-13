import { useEffect, useMemo, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

const START = new Chess().fen();
const PIECE_NAME = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' };
const UCI = /^([a-h][1-8])-?([a-h][1-8])([qrbn])?$/i;
const GLYPH = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' };
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };

// pieces each side has taken, replayed from the move list (most valuable first)
function captures(history) {
  const game = new Chess();
  const taken = { w: [], b: [] };
  for (const san of history || []) {
    let move;
    try { move = game.move(san); } catch { break; }
    if (move.captured) taken[move.color].push(move.captured);
  }
  for (const side of ['w', 'b']) taken[side].sort((a, b) => VALUE[b] - VALUE[a]);
  return taken;
}

const worth = (pieces) => pieces.reduce((sum, p) => sum + VALUE[p], 0);

function Dock({ side, taken }) {
  const pieces = taken[side];
  const lead = worth(pieces) - worth(taken[side === 'w' ? 'b' : 'w']);
  const name = side === 'w' ? 'White' : 'Black';
  return (
    <div className="chess-dock" aria-label={`Captured by ${name}: ${pieces.length || 'none'}`}>
      {pieces.map((p, i) => (
        <span key={i} className={`chess-dock-piece ${side === 'w' ? 'is-black' : 'is-white'}`} aria-hidden="true">{GLYPH[p]}</span>
      ))}
      {lead > 0 && <span className="chess-dock-lead">+{lead}</span>}
      {!pieces.length && <span className="chess-dock-empty">{name} · no captures</span>}
    </div>
  );
}

/**
 * The shared board. The server is the authority: a move is shown immediately
 * (optimistically) and rolled back if the server turns it down.
 */
// White and black pieces as filled glyphs, told apart by colour (see .chess-static)
const STATIC_GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

// A plain board drawn from a FEN, used where react-chessboard can't run: in the prerendered
// page and on the browser's first render, so hydration matches the server's markup.
function StaticBoard({ fen, orientation }) {
  const cells = [];
  fen.split(' ')[0].split('/').forEach((row, r) => {
    let c = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < Number(ch); i++, c++) cells.push({ r, c, piece: null });
      } else {
        cells.push({ r, c, piece: ch });
        c++;
      }
    }
  });
  if (orientation === 'black') cells.reverse();
  return (
    <div className="chess-static" role="img" aria-label="Chess board">
      {cells.map(({ r, c, piece }) => (
        <span key={`${r}${c}`} className={`chess-static-sq${(r + c) % 2 ? ' is-dark' : ''}`}>
          {piece && (
            <span className={piece === piece.toUpperCase() ? 'is-white' : 'is-black'} aria-hidden="true">
              {STATIC_GLYPH[piece.toLowerCase()]}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

export default function Board({ fen, previewFen, lastMove, history, canMove, onMove }) {
  const serverFen = fen || START;
  const [optimistic, setOptimistic] = useState(null);
  const [selected, setSelected] = useState(null);
  const [promotion, setPromotion] = useState(null); // { from, to } waiting for a piece choice
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState('');
  // react-chessboard is browser-only: until mounted, show the static board in its place
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // a new position from the server replaces anything local
  useEffect(() => {
    setOptimistic(null);
    setSelected(null);
    setPromotion(null);
  }, [serverFen]);

  // looking back through the game shows that position; orientation stays with the live one
  const position = previewFen || optimistic || serverFen;
  const game = useMemo(() => new Chess(position), [position]);
  const turn = game.turn();
  const targets = useMemo(
    () => (selected ? game.moves({ square: selected, verbose: true }) : []),
    [game, selected]
  );

  const send = (from, to, piece) => {
    const next = new Chess(position);
    try {
      next.move({ from, to, promotion: piece });
    } catch {
      return false;
    }
    setOptimistic(next.fen());
    setSelected(null);
    setPromotion(null);
    Promise.resolve(onMove({ from, to, promotion: piece })).then((ok) => {
      if (!ok) setOptimistic(null);
    });
    return true;
  };

  // legal? promotion needs a choice first; otherwise send it
  const attempt = (from, to) => {
    const legal = game.moves({ square: from, verbose: true }).filter((m) => m.to === to);
    if (!legal.length) return false;
    if (legal.some((m) => m.promotion)) {
      setPromotion({ from, to });
      return false;
    }
    return send(from, to);
  };

  const mine = (piece) => Boolean(piece && piece.pieceType && piece.pieceType[0] === turn);

  // the side to move sits at the bottom; follows the server's position so the board
  // turns once a move lands, not while a piece is still sliding into place
  const orientation = serverFen.split(' ')[1] === 'b' ? 'black' : 'white';
  const bottom = orientation[0]; // 'w' or 'b'
  const taken = useMemo(() => captures(history), [history]);

  // the checked king's square, if any
  const checkSquare = useMemo(() => {
    if (!game.inCheck()) return null;
    for (const row of game.board()) {
      for (const p of row) if (p && p.type === 'k' && p.color === turn) return p.square;
    }
    return null;
  }, [game, turn]);

  const options = {
    id: 'crowd-board',
    position,
    boardOrientation: orientation,
    allowDragging: canMove,
    showAnimations: true,
    animationDurationInMs: 180,
    boardStyle: { borderRadius: 0, boxShadow: 'none', border: '1px solid var(--line)' },
    lightSquareStyle: { backgroundColor: 'var(--chess-light)' },
    darkSquareStyle: { backgroundColor: 'var(--chess-dark)' },
    alphaNotationStyle: { fontFamily: 'var(--mono)', fontSize: '10px' },
    numericNotationStyle: { fontFamily: 'var(--mono)', fontSize: '10px' },
    dropSquareStyle: { boxShadow: 'inset 0 0 0 3px var(--chess-target)' },
    canDragPiece: ({ piece }) => canMove && mine(piece),
    onPieceDrop: ({ sourceSquare, targetSquare }) => {
      if (!canMove || !targetSquare || sourceSquare === targetSquare) return false;
      return attempt(sourceSquare, targetSquare);
    },
    onSquareClick: ({ square, piece }) => {
      if (!canMove) return;
      if (selected && square === selected) { setSelected(null); return; }
      if (selected && targets.some((m) => m.to === square)) { attempt(selected, square); return; }
      setSelected(mine(piece) ? square : null);
    },
    squareStyles: (() => {
      const s = {};
      if (lastMove) {
        s[lastMove.from] = { backgroundColor: 'var(--chess-last)' };
        s[lastMove.to] = { backgroundColor: 'var(--chess-last)' };
      }
      if (checkSquare) {
        s[checkSquare] = {
          backgroundColor: 'var(--chess-check)',
          backgroundImage: 'radial-gradient(circle, var(--chess-check-glow) 0%, transparent 72%)'
        };
      }
      if (selected) s[selected] = { ...s[selected], backgroundColor: 'var(--chess-selected)' };
      for (const m of targets) {
        s[m.to] = {
          ...s[m.to],
          ...(m.captured
            ? { boxShadow: 'inset 0 0 0 3px var(--chess-target)' }
            : { backgroundImage: 'radial-gradient(circle, var(--chess-target) 20%, transparent 22%)' })
        };
      }
      return s;
    })()
  };

  // keyboard route: "e2e4", "e7e8q" or standard notation like "Nf3"
  const submitTyped = (e) => {
    e.preventDefault();
    setTypedError('');
    const text = typed.trim();
    if (!text) return;
    const uci = UCI.exec(text);
    let move = null;
    try {
      move = new Chess(position).move(
        uci ? { from: uci[1].toLowerCase(), to: uci[2].toLowerCase(), promotion: uci[3]?.toLowerCase() } : text
      );
    } catch {
      move = null;
    }
    if (!move) {
      setTypedError(`"${text}" isn't a legal move here.`);
      return;
    }
    if (move.promotion && !(uci ? uci[3] : /=[QRBN]/i.test(text))) {
      setPromotion({ from: move.from, to: move.to });
      setTyped('');
      return;
    }
    if (send(move.from, move.to, move.promotion)) setTyped('');
  };

  return (
    <div className="chess-board">
      <Dock side={bottom === 'w' ? 'b' : 'w'} taken={taken} />
      {mounted ? <Chessboard options={options} /> : <StaticBoard fen={position} orientation={orientation} />}
      <Dock side={bottom} taken={taken} />
      {promotion && (
        <div className="chess-promo" role="dialog" aria-label="Choose a piece to promote to">
          <span className="tag">Promote to</span>
          {Object.entries(PIECE_NAME).map(([p, name]) => (
            <button key={p} type="button" className="flow-btn" onClick={() => send(promotion.from, promotion.to, p)}>
              {name}
            </button>
          ))}
          <button type="button" className="flow-btn" onClick={() => setPromotion(null)}>Cancel</button>
        </div>
      )}
      <form className="chess-type" onSubmit={submitTyped}>
        <label htmlFor="chess-type-input" className="tag">Or type a move</label>
        <input
          id="chess-type-input"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={canMove ? 'e2e4 or Nf3' : 'you can watch this one'}
          disabled={!canMove}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck="false"
        />
        <button type="submit" className="flow-btn" disabled={!canMove || !typed.trim()}>Move</button>
      </form>
      {typedError && <p className="chess-type-error" role="alert">{typedError}</p>}
    </div>
  );
}
