import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_MS = 1000;
const IDLE_POLL_MS = 5000;
const IDLE_AFTER_MS = 5 * 60_000; // no clicks, keys or moves for this long
const second = () => Math.floor(Date.now() / 1000);
// is version "{game}:{ply}" ahead of the state on screen?
const versionAhead = (v, shown) => {
  const [game, ply] = v.split(':').map(Number);
  return game !== Number(shown.gameId) ? game > Number(shown.gameId) : ply > shown.ply;
};
const STATUS_TEXT = { 400: 'Bad Request', 403: 'Forbidden', 409: 'Conflict', 429: 'Too Many Requests', 503: 'Service Unavailable' };
// the ply the board reached with this visitor's own move; while it's still that ply, they wait
const mineKey = (id) => `chess:mine:${id}`;

// A cached copy of the state can be a few seconds old: never step back to it.
const newer = (prev, next) => {
  if (!prev) return true;
  if (Number(next.gameId) !== Number(prev.gameId)) return Number(next.gameId) > Number(prev.gameId);
  return next.ply >= prev.ply;
};

export function useCrowdGame() {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [myPly, setMyPly] = useState(null);
  const [pending, setPending] = useState(false);
  const lastActivity = useRef(Date.now());
  const knownGame = useRef(null);

  const current = useRef(null); // the state on screen, for the poll loop

  // `key` picks the CDN copy: `v=` a known version, `s=` this second, `t=` bypass (after a conflict)
  const fetchState = useCallback(async (key = `s=${second()}`) => {
    try {
      const r = await fetch(`/api/chess/state?${key}`, { headers: { accept: 'application/json' } });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError({ kind: r.status === 503 ? 'setup' : 'down', message: body.message || 'Crowd chess is unavailable right now.' });
        return null;
      }
      setError(null);
      if (newer(current.current, body)) {
        if (current.current && body.ply !== current.current.ply) lastActivity.current = Date.now(); // a live game keeps polling fast
        current.current = body;
        setState(body);
      }
      return body;
    } catch {
      setError({ kind: 'down', message: "Can't reach the game right now." });
      return null;
    }
  }, []);

  // One poll: ask for the tiny version; load the full state only when the board changed,
  // or when a finished game is due to be replaced.
  const poll = useCallback(async () => {
    const shown = current.current;
    if (!shown) return fetchState();
    try {
      const r = await fetch(`/api/chess/version?s=${second()}`, { headers: { accept: 'application/json' } });
      if (!r.ok) return fetchState();
      const { v } = await r.json();
      if (v == null) return fetchState();
      if (v !== `${shown.gameId}:${shown.ply}` && versionAhead(v, shown)) return fetchState(`v=${v}`);
      if (shown.status !== 'active' && Date.now() >= shown.nextGameAt) return fetchState();
      return shown;
    } catch {
      return fetchState();
    }
  }, [fetchState]);

  // poll while the tab is visible; slow down once nothing has happened for a while
  useEffect(() => {
    let alive = true;
    let timer;
    let first = true;
    const tick = async () => {
      if (!alive) return;
      // always load once, even in a background tab; after that, only poll while visible
      if (first || document.visibilityState === 'visible') await poll();
      first = false;
      if (!alive) return;
      const idle = Date.now() - lastActivity.current > IDLE_AFTER_MS;
      timer = setTimeout(tick, idle ? IDLE_POLL_MS : POLL_MS);
    };
    tick();
    const wake = () => { lastActivity.current = Date.now(); };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      wake();
      poll();
    };
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearTimeout(timer);
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [poll]);

  // did this visitor make the last move in the game on screen? (local first, then the server)
  const gameId = state?.gameId;
  useEffect(() => {
    if (!gameId || knownGame.current === gameId) return;
    knownGame.current = gameId;
    let local = null;
    try { local = localStorage.getItem(mineKey(gameId)); } catch { /* private mode */ }
    setMyPly(local == null ? null : Number(local));
    setNotice(null);
    fetch('/api/chess/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => { if (me && String(me.gameId) === String(gameId) && me.lastMover) setMyPly(me.ply); })
      .catch(() => {});
  }, [gameId]);

  const rememberMine = (id, ply) => {
    try { localStorage.setItem(mineKey(id), String(ply)); } catch { /* private mode */ }
    setMyPly(ply);
  };

  const submitMove = useCallback(async ({ from, to, promotion }) => {
    if (!state || pending) return false;
    lastActivity.current = Date.now();
    setPending(true);
    setNotice(null);
    try {
      const r = await fetch('/api/chess/move', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gameId: state.gameId, ply: state.ply, from, to, promotion })
      });
      const body = await r.json().catch(() => ({}));
      if (r.ok && body.ok) {
        current.current = body.state;
        setState(body.state);
        rememberMine(body.state.gameId, body.state.ply);
        setNotice({ tone: 'ok', text: `Your move ${body.move.san} is in. You can move again once someone replies.` });
        return true;
      }
      if (body.error === 'consecutive') rememberMine(state.gameId, state.ply);
      setNotice({
        tone: r.status === 400 ? 'warn' : 'err',
        text: `${r.status} ${STATUS_TEXT[r.status] || 'Error'} — ${body.message || 'Move not accepted.'}`
      });
      if (r.status === 409) await fetchState(`t=${Date.now()}`);
      return false;
    } catch {
      setNotice({ tone: 'err', text: "Couldn't send your move. Check your connection and try again." });
      return false;
    } finally {
      setPending(false);
    }
  }, [state, pending, fetchState]);

  const waiting = Boolean(state) && myPly === state.ply; // the last move was theirs
  const canMove = Boolean(state && !error && state.status === 'active' && !waiting && !pending);
  return { state, error, notice, waiting, pending, canMove, submitMove };
}
