import { useCallback, useEffect, useRef, useState } from 'react';
import { nextPoll } from './pollSchedule.js';

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

const bump = (reactions, ply, emoji, by) => {
  const forPly = { ...(reactions?.[ply] || {}) };
  const n = (forPly[emoji] || 0) + by;
  if (n > 0) forPly[emoji] = n;
  else delete forPly[emoji];
  const out = { ...reactions, [ply]: forPly };
  if (!Object.keys(forPly).length) delete out[ply];
  return out;
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
  const lastActivity = useRef(Date.now()); // input or a move seen: keeps polling fast
  const lastInput = useRef(Date.now());    // clicks, keys, scrolls, taps: someone is actually here
  const [asleep, setAsleep] = useState(false); // polling stopped until the visitor is back
  const knownGame = useRef(null);
  const current = useRef(null); // the state on screen, for the poll loop
  const reacting = useRef(new Set()); // "ply:emoji" taps still in flight

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
    let sleeping = false;
    let busy = false; // a poll is in flight; don't start a second loop
    // pace comes from pollSchedule.js: every second in use, slower when quiet, none when abandoned
    const tick = async () => {
      if (!alive) return;
      const next = nextPoll({
        first,
        visible: document.visibilityState === 'visible',
        lastInput: lastInput.current,
        lastChange: lastActivity.current,
        now: Date.now()
      });
      first = false;
      if (next.asleep !== sleeping) {
        sleeping = next.asleep;
        setAsleep(sleeping);
      }
      if (next.poll) {
        busy = true;
        await poll();
        busy = false;
      }
      if (!alive) return;
      timer = setTimeout(tick, next.delay);
    };
    tick();
    // someone is here; if polling had stopped, catch up now instead of on the next check
    const wake = () => {
      const now = Date.now();
      lastInput.current = now;
      lastActivity.current = now;
      if (sleeping && !busy) {
        clearTimeout(timer);
        tick();
      }
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const wasAsleep = sleeping;
      wake();
      if (!wasAsleep) poll();
    };
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, wake));
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

  // Tap to react, tap your own again to take it back. Shown straight away; the server's
  // counts replace the guess when it answers, and a refusal rolls it back.
  const react = useCallback(async (ply, emoji) => {
    const shown = current.current;
    const mark = `${ply}:${emoji}`;
    if (!shown || reacting.current.has(mark)) return; // a second tap before the first lands
    reacting.current.add(mark);
    lastActivity.current = Date.now();
    const id = shown.gameId;
    const on = !myReactions.has(mark);
    const before = myReactions;
    const after = new Set(before);
    if (on) after.add(mark);
    else after.delete(mark);
    saveReactions(id, after);
    show({ ...shown, reactions: bump(shown.reactions, ply, emoji, on ? 1 : -1) });
    let failure = "Couldn't send that reaction.";
    try {
      const r = await fetch('/api/chess/react', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gameId: id, ply, emoji, on })
      });
      const body = await r.json().catch(() => ({}));
      if (r.ok && body.ok) {
        const now = current.current;
        if (now && now.gameId === id && body.rseq >= (now.rseq || 0)) show({ ...now, reactions: body.reactions, rseq: body.rseq });
        reacting.current.delete(mark);
        return;
      }
      failure = errorText(r.status, body, failure);
    } catch { /* offline: fall through */ }
    reacting.current.delete(mark);
    saveReactions(id, before);
    setNotice({ tone: 'err', text: failure });
    await fetchState(`t=${Date.now()}`);
  }, [myReactions, fetchState, show]);

  const waiting = Boolean(state) && myPly === state.ply; // the last move was theirs
  const canMove = Boolean(state && !error && state.status === 'active' && !waiting && !pending);
  return { state, error, notice, waiting, pending, canMove, submitMove, react, myReactions, asleep };
}
