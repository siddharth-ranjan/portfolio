import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_MS = 4000;
const IDLE_POLL_MS = 15000;
const IDLE_AFTER_MS = 120000;
const STATUS_TEXT = { 400: 'Bad Request', 403: 'Forbidden', 409: 'Conflict', 429: 'Too Many Requests', 503: 'Service Unavailable' };
const movedKey = (id) => `chess:moved:${id}`;

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
  const [moved, setMoved] = useState(false);
  const [pending, setPending] = useState(false);
  const lastActivity = useRef(Date.now());
  const knownGame = useRef(null);

  const fetchState = useCallback(async ({ fresh = false } = {}) => {
    try {
      // `fresh` skips the 2s CDN copy — only used after a conflict
      const r = await fetch(`/api/chess/state${fresh ? `?t=${Date.now()}` : ''}`, { headers: { accept: 'application/json' } });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError({ kind: r.status === 503 ? 'setup' : 'down', message: body.message || 'Crowd chess is unavailable right now.' });
        return null;
      }
      setError(null);
      setState((prev) => (newer(prev, body) ? body : prev));
      return body;
    } catch {
      setError({ kind: 'down', message: "Can't reach the game right now." });
      return null;
    }
  }, []);

  // poll while the tab is visible; slow down once the visitor has gone quiet
  useEffect(() => {
    let alive = true;
    let timer;
    let first = true;
    const tick = async () => {
      if (!alive) return;
      // always load once, even in a background tab; after that, only poll while visible
      if (first || document.visibilityState === 'visible') await fetchState();
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
      fetchState();
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
  }, [fetchState]);

  // has this visitor already moved in the game on screen? (local first, then the server)
  const gameId = state?.gameId;
  useEffect(() => {
    if (!gameId || knownGame.current === gameId) return;
    knownGame.current = gameId;
    let local = false;
    try { local = localStorage.getItem(movedKey(gameId)) === '1'; } catch { /* private mode */ }
    setMoved(local);
    setNotice(null);
    fetch('/api/chess/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => { if (me && String(me.gameId) === String(gameId) && me.moved) setMoved(true); })
      .catch(() => {});
  }, [gameId]);

  const rememberMoved = (id) => {
    try { localStorage.setItem(movedKey(id), '1'); } catch { /* private mode */ }
    setMoved(true);
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
        setState(body.state);
        rememberMoved(body.state.gameId);
        setNotice({ tone: 'ok', text: `Your move ${body.move.san} is in. One move per visitor — watch the game play out.` });
        return true;
      }
      if (body.error === 'already-moved' || body.error === 'network-limit') rememberMoved(state.gameId);
      setNotice({
        tone: r.status === 400 ? 'warn' : 'err',
        text: `${r.status} ${STATUS_TEXT[r.status] || 'Error'} — ${body.message || 'Move not accepted.'}`
      });
      if (r.status === 409) await fetchState({ fresh: true });
      return false;
    } catch {
      setNotice({ tone: 'err', text: "Couldn't send your move. Check your connection and try again." });
      return false;
    } finally {
      setPending(false);
    }
  }, [state, pending, fetchState]);

  const canMove = Boolean(state && !error && state.status === 'active' && !moved && !pending);
  return { state, error, notice, moved, pending, canMove, submitMove };
}
