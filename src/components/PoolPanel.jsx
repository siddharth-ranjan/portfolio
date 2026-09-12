import { useCallback, useEffect, useRef, useState } from 'react';

const SPEC = [
  ['Algorithm', 'least-connections'],
  ['Target', '65% cpu per instance'],
  ['Bounds', 'min 3 · max 12'],
  ['Cooldown', '120s between actions'],
  ['Health check', '/healthz every 2s'],
  ['Unhealthy', '2 failed checks → eject']
];

const START = [
  { id: 'app-5', state: 'ok', load: 61, base: 61 },
  { id: 'app-6', state: 'ok', load: 58, base: 58 },
  { id: 'app-7', state: 'ok', load: 74, base: 74 },
  { id: 'app-8', state: 'bad', load: 0, base: 0 },
  { id: 'app-9', state: 'warm', load: 12, base: 12 }
];

const PILL = { ok: 'ok', bad: 'bad', warm: 'warn', draining: 'warn' };
const PILL_TEXT = { ok: 'healthy', bad: 'drained', warm: 'booting', draining: 'draining' };
const FILL = { ok: 'fill ok', bad: 'fill', warm: 'fill warn', draining: 'fill warn' };
const LOAD_TEXT = {
  bad: 'ejected', warm: 'warm-up', draining: 'draining'
};

const DEFAULT_NOTE = (
  <>
    <b className="warn-t">Scale-out</b> — app-8 failed two checks and left the rotation;
    app-9 was added and takes no traffic until warm-up passes. The client saw neither event.
  </>
);

export default function PoolPanel() {
  const listRef = useRef(null);
  const [rows, setRows] = useState(START);
  const [entered, setEntered] = useState(false);
  const [note, setNote] = useState(DEFAULT_NOTE);
  const nextId = useRef(10);
  const timers = useRef([]);

  const later = useCallback((fn, ms) => { timers.current.push(setTimeout(fn, ms)); }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // bars grow in the first time the panel is seen
  useEffect(() => {
    const el = listRef.current;
    if (!el || !('IntersectionObserver' in window)) { setEntered(true); return; }
    const io = new IntersectionObserver((en) => {
      if (en[0].isIntersecting) { setEntered(true); io.disconnect(); }
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // least-connections keeps healthy instances near their baseline, never exactly on it
  useEffect(() => {
    if (!entered) return undefined;
    const t = setInterval(() => {
      if (document.hidden || document.documentElement.classList.contains('motion-paused')) return;
      setRows((rs) => rs.map((r) => (
        r.state === 'ok'
          ? { ...r, load: Math.max(8, Math.min(95, Math.round(r.base + (Math.random() * 12 - 6)))) }
          : r
      )));
    }, 1800);
    return () => clearInterval(t);
  }, [entered]);

  // clicking a healthy instance fails its health checks: drain, eject, scale out, warm up
  const fail = useCallback((id) => {
    setRows((rs) => rs.map((r) => (r.id === id && r.state === 'ok' ? { ...r, state: 'draining' } : r)));
    setNote(<><b className="warn-t">Health check</b> — {id} missed a check; draining its connections…</>);

    later(() => {
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, state: 'bad', load: 0 } : r)));
    }, 900);

    later(() => {
      const fresh = `app-${nextId.current++}`;
      setRows((rs) => {
        const next = [...rs, { id: fresh, state: 'warm', load: 12, base: 12 }];
        // keep the list short: the oldest ejected instance drops off
        if (next.length > 6) {
          const i = next.findIndex((r) => r.state === 'bad');
          if (i > -1) next.splice(i, 1);
        }
        return next;
      });
      setNote(
        <>
          <b className="warn-t">Scale-out</b> — {id} failed two checks and left the rotation;
          {' '}{fresh} was added and takes no traffic until warm-up passes. The client saw neither event.
        </>
      );
      later(() => {
        const base = 48 + Math.floor(Math.random() * 20);
        setRows((rs) => rs.map((r) => (r.id === fresh ? { ...r, state: 'ok', load: base, base } : r)));
      }, 2600);
    }, 1800);
  }, [later]);

  return (
    <section className="wrap block-tight">
      <div className="panel">
        <div className="panel-head">
          <span className="tag">Hop 03 — why that hop exists</span>
          <span className="tag">Simulated pool · click an instance to fail it</span>
        </div>
        <div className="panel-body">
          <div className="panel-left">
            <h3 className="panel-title">The pool changes size<br />while the URL does not</h3>
            <dl className="spec spec-flush">
              {SPEC.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </div>
          <div className="panel-right">
            <ul className="pool" ref={listRef}>
              {rows.map((r, i) => {
                const healthy = r.state === 'ok';
                return (
                  <li
                    key={r.id}
                    className={r.state === 'bad' ? 'dim' : undefined}
                    role={healthy ? 'button' : undefined}
                    tabIndex={healthy ? 0 : undefined}
                    title={healthy ? `Fail ${r.id}` : undefined}
                    aria-label={healthy ? `Fail ${r.id}: two failed health checks eject it from the pool` : undefined}
                    onClick={healthy ? () => fail(r.id) : undefined}
                    onKeyDown={healthy ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fail(r.id); }
                    } : undefined}
                  >
                    <span className="node">{r.id}</span>
                    <span className={`pill ${PILL[r.state]}`}>{PILL_TEXT[r.state]}</span>
                    <span className="bar">
                      <i
                        className={FILL[r.state]}
                        style={{ width: entered ? `${r.load}%` : '0%', transitionDelay: entered ? `${(i % 6) * 110}ms` : '0ms' }}
                      />
                    </span>
                    <span className="load">{LOAD_TEXT[r.state] || `${r.load}%`}</span>
                  </li>
                );
              })}
            </ul>
            <p className="note">{note}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
