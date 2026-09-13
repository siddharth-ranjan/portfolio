import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_MS = 1000;
const IDLE_POLL_MS = 5000;
const IDLE_AFTER_MS = 5 * 60_000; // no clicks, keys or moves for this long
const STATUS_TEXT = { 400: 'Bad Request', 403: 'Forbidden', 409: 'Conflict', 429: 'Too Many Requests', 503: 'Service Unavailable' };
const second = () => Math.floor(Date.now() / 1000);
// the ply the board reached with this visitor's own move; while it's still that ply, they wait
const mineKey = (id) => `chess:mine:${id}`;
// reactions this browser has sent in a game, as "ply:emoji"
const reactedKey = (id) => `chess:reacted:${id}`;

// Versions are "{game}:{ply}:{reactions}"; compare them as numbers, in that order.
const parseVersion = (v) => {
  const [game, ply, r] = String(v).split(':').map(Number);
  return [game || 0, ply || 0, r || 0];
};
const tuple = (s) => [Number(s.gameId), s.ply, s.rseq || 0];
const ahead = (a, b) => {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
};
// A cached copy of the state can be a little old: never step back to it.
const newer = (prev, next) => !prev || !ahead(tuple(prev), tuple(next));

const bump = (reactions, ply, emoji) => {
  const forPly = { ...(reactions?.[ply] || {}) };
  forPly[emoji] = (forPly[emoji] || 0) + 1;
  return { ...reactions, [ply]: forPly };
};

const errorText = (status, body, fallback) =>
  `${status} ${STATUS_TEXT[status] || 'Error'} — ${body.message || fallback}`;

export function useCrowdGame() {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [myPly, setMyPly] = useState(null);
  const [myReactions, setMyReactions] = useState(() => new Set());
  const [pending, setPending] = useState(false);
  const lastActivity = useRef(Date.now());
  const knownGame = useRef(null);
  const current = useRef(null); // the state on screen, for the poll loop

  const show = useCallback((next) => {
    current.current = next;
    setState(next);
  }, []);

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
      const prev = current.current;
      if (newer(prev, body)) {
        if (prev && body.ply !== prev.ply) lastActivity.current = Date.now(); // a live game keeps polling fast
        show(body);
      }
      return body;
    } catch {
      setError({ kind: 'down', message: "Can't reach the game right now." });
      return null;
    }
  }, [show]);

  // One poll: ask for the tiny version; load the full state only when something changed,
  // or when a finished game is due to be replaced.
  const poll = useCallback(async () => {
    const shown = current.current;
    if (!shown) return fetchState();
    try {
      const r = await fetch(`/api/chess/version?s=${second()}`, { headers: { accept: 'application/json' } });
      if (!r.ok) return fetchState();
      const { v } = await r.json();
      if (v == null) return fetchState();
      if (ahead(parseVersion(v), tuple(shown))) return fetchState(`v=${v}`);
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

  // what this visitor did in the game on screen: made the last move? reacted to what?
  const gameId = state?.gameId;
  useEffect(() => {
    if (!gameId || knownGame.current === gameId) return;
    knownGame.current = gameId;
    let local = null;
    let reacted = [];
    try {
      local = localStorage.getItem(mineKey(gameId));
      reacted = JSON.parse(localStorage.getItem(reactedKey(gameId)) || '[]');
    } catch { /* private mode */ }
    setMyPly(local == null ? null : Number(local));
    setMyReactions(new Set(Array.isArray(reacted) ? reacted : []));
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

  const saveReactions = (id, set) => {
    try { localStorage.setItem(reactedKey(id), JSON.stringify([...set])); } catch { /* private mode */ }
    setMyReactions(set);
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
        show(body.state);
        rememberMine(body.state.gameId, body.state.ply);
        setNotice({ tone: 'ok', text: `Your move ${body.move.san} is in. You can move again once someone replies.` });
        return true;
      }
      if (body.error === 'consecutive') rememberMine(state.gameId, state.ply);
      setNotice({ tone: r.status === 400 ? 'warn' : 'err', text: errorText(r.status, body, 'Move not accepted.') });
      if (r.status === 409) await fetchState(`t=${Date.now()}`);
      return false;
    } catch {
      setNotice({ tone: 'err', text: "Couldn't send your move. Check your connection and try again." });
      return false;
    } finally {
      setPending(false);
    }
  }, [state, pending, fetchState, show]);

  // Shown straight away; the server's counts replace the guess when it answers.
  const react = useCallback(async (ply, emoji) => {
    const shown = current.current;
    const mark = `${ply}:${emoji}`;
    if (!shown || myReactions.has(mark)) return;
    lastActivity.current = Date.now();
    const id = shown.gameId;
    const before = myReactions;
    saveReactions(id, new Set(before).add(mark));
    show({ ...shown, reactions: bump(shown.reactions, ply, emoji) });
    let failure = "Couldn't send that reaction.";
    try {
      const r = await fetch('/api/chess/react', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gameId: id, ply, emoji })
      });
      const body = await r.json().catch(() => ({}));
      if (r.ok && body.ok) {
        const now = current.current;
        if (now && now.gameId === id && body.rseq >= (now.rseq || 0)) show({ ...now, reactions: body.reactions, rseq: body.rseq });
        return;
      }
      failure = errorText(r.status, body, failure);
    } catch { /* offline: fall through */ }
    saveReactions(id, before);
    setNotice({ tone: 'err', text: failure });
    await fetchState(`t=${Date.now()}`);
  }, [myReactions, fetchState, show]);

  const waiting = Boolean(state) && myPly === state.ply; // the last move was theirs
  const canMove = Boolean(state && !error && state.status === 'active' && !waiting && !pending);
  return { state, error, notice, waiting, pending, canMove, submitMove, react, myReactions };
}
