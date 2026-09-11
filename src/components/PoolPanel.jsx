import { useRef } from 'react';
import { usePool } from '../hooks/usePool.js';

const SPEC = [
  ['Algorithm', 'least-connections'],
  ['Target', '65% cpu per instance'],
  ['Bounds', 'min 3 · max 12'],
  ['Cooldown', '120s between actions'],
  ['Unhealthy', '2 failed checks → eject']
];

const INSTANCES = [
  { node: 'app-5', state: 'ok', pill: 'healthy', w: '61%', load: '61%' },
  { node: 'app-6', state: 'ok', pill: 'healthy', w: '58%', load: '58%' },
  { node: 'app-7', state: 'ok', pill: 'healthy', w: '74%', load: '74%' },
  { node: 'app-8', state: 'bad', pill: 'drained', w: '0%', load: 'ejected', dim: true },
  { node: 'app-9', state: 'warn', pill: 'booting', w: '12%', load: 'warm-up' }
];

export default function PoolPanel() {
  const poolRef = useRef(null);
  usePool(poolRef);
  return (
    <section className="wrap block-tight">
      <div className="panel">
        <div className="panel-head">
          <span className="tag">Hop 03 — why that hop exists</span>
          <span className="tag">Health check <code>/healthz</code> every 2s</span>
        </div>
        <div className="panel-body">
          <div className="panel-left">
            <h3 className="panel-title">The pool changes size<br />while the URL does not</h3>
            <dl className="spec spec-flush">
              {SPEC.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </div>
          <div className="panel-right">
            <ul className="pool" ref={poolRef}>
              {INSTANCES.map((i) => (
                <li key={i.node} className={i.dim ? 'dim' : undefined}>
                  <span className="node">{i.node}</span>
                  <span className={`pill ${i.state}`}>{i.pill}</span>
                  <span className="bar">
                    <i className={`fill${i.state === 'bad' ? '' : ` ${i.state}`}`} style={{ '--w': i.w }} />
                  </span>
                  <span className="load">{i.load}</span>
                </li>
              ))}
            </ul>
            <p className="note">
              <b className="warn-t">Scale-out</b> — app-8 failed two checks and left the rotation;
              app-9 was added and takes no traffic until warm-up passes. The client saw neither event.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
