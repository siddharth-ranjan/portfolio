import { useCallback, useEffect, useRef, useState } from 'react';
import { useFlow } from '../hooks/useFlow.js';
import { useEvict } from '../flowContext.js';

const LANES = [
  { app: '5', state: 'ok', h: 9, v: 24 },
  { app: '6', state: 'ok', h: 27, v: 72 },
  { app: '7', state: 'ok', h: 45, v: 120 },
  { app: '8', state: 'bad', h: 63, v: 168 },
  { app: '9', state: 'warn', h: 81, v: 216 }
];
const hPath = (y) => `M0 45 C12 45 12 ${y} 24 ${y} L86 ${y} C98 ${y} 98 45 110 45`;
const vPath = (x) => `M120 0 C120 12 ${x} 12 ${x} 24 L${x} 86 C${x} 98 120 98 120 110`;

function Hop({ n, title, desc, ms, boxClass, boxProps }) {
  return (
    <li className="hop">
      <span className="hop-n">{n}</span>
      <div className={boxClass ? `box ${boxClass}` : 'box'} {...boxProps}>
        <h3>{title}</h3>
        <p>{desc}</p>
        {ms && <span className="ms">{ms}</span>}
      </div>
    </li>
  );
}

const Edge = ({ label }) => (
  <li className="edge" aria-hidden="true"><span>{label}</span></li>
);

export default function Flow() {
  const flowRef = useRef(null);
  const railRef = useRef(null);
  const bridge = useEvict();
  const [stats, setStats] = useState('Live · one GET every few seconds');
  const [label, setLabel] = useState({ text: '← 200 OK · 3.9ms · cache hit', miss: false });

  const onStats = useCallback((t) => setStats(t), []);
  const onLabel = useCallback((l) => setLabel(l), []);
  const { running, setRunning, evictRef } = useFlow(flowRef, railRef, { onStats, onLabel });

  // let the shell's `evict` command reach this section
  useEffect(() => { bridge.current = () => evictRef.current(); }, [bridge, evictRef]);

  const labelClass = `return-label${label.miss ? ' miss' : ''}`;

  return (
    <section id="flow" className="wrap block">
      <div className="block-head">
        <h2>How a request moves</h2>
        <span className="tag">Solid = blocking · Dashed = async</span>
      </div>
      <p className="block-sub">
        One GET, seven hops, under four milliseconds. Watch where it stops — then
        evict the key and watch what happens when it doesn&apos;t.
      </p>

      <div className="chain-scroll flow-scroll" id="flow-scroll" ref={flowRef}>
        <ol className="chain">
          <Hop n="01" title="client" desc="browser · mobile · service call" ms="0.0ms" />
          <Edge label="HTTPS" />
          <Hop n="02" title="cdn" desc="static served at the edge" ms="1.2ms" />
          <Edge label="origin fetch" />
          <Hop n="03" title="load balancer" desc="health checks · least-conn" ms="2.0ms" boxClass="is-focus" />

          <li className="edge edge-pool" aria-hidden="true">
            <div className="lanes">
              <svg viewBox="0 0 110 90" width="110" height="90">
                {LANES.map((l) => (
                  <path key={l.app} className={`lane-line ${l.state}`} data-app={l.app} d={hPath(l.h)} />
                ))}
              </svg>
              {LANES.map((l) => (
                <span key={l.app} className={`lane ${l.state}`} data-app={l.app} style={{ top: `${l.h}px` }}>
                  app-{l.app}
                </span>
              ))}
              <b className="pool-dot" />
            </div>
            <div className="lanes-v">
              <svg viewBox="0 0 240 110" width="240" height="110">
                {LANES.map((l) => (
                  <path key={l.app} className={`lane-line ${l.state}`} data-app={l.app} d={vPath(l.v)} />
                ))}
              </svg>
              {LANES.map((l) => (
                <span key={l.app} className={`lane ${l.state}`} data-app={l.app}
                      style={{ left: `${l.v}px`, top: '55px' }}>
                  app-{l.app}
                </span>
              ))}
              <b className="pool-dot" />
            </div>
          </li>

          <Hop n="04" title="api gateway" desc="JWT · rate limit · routing" ms="2.6ms" />
          <Edge label="internal" />
          <Hop n="05" title="service ×3" desc="stateless · idempotent writes" ms="3.1ms" />
          <Edge label="cache-aside" />
          {/* redis is the one box you can act on: evicting its key forces the next request to miss */}
          <Hop
            n="06" title="redis" desc="most reads end right here" ms="3.5ms"
            boxProps={{
              role: 'button',
              tabIndex: 0,
              title: 'Evict the cached key',
              'aria-label': 'Evict the cached key: the next request misses and reads from postgres'
            }}
          />
          <Edge label="on miss only" />
          <Hop n="07" title="postgres" desc="source of truth · read replicas" ms="+12ms on miss" boxClass="is-dashed" />
        </ol>
        <div className="return-rail" aria-hidden="true" ref={railRef}>
          <span className="packet-back" />
          <span className={labelClass} id="rail-label">{label.text}</span>
        </div>
      </div>

      <div className="flow-meta">
        <span className={`return-label-m${label.miss ? ' miss' : ''}`} aria-hidden="true">{label.text}</span>
        <span className="tag" id="flow-stats">{stats}</span>
        <button
          type="button"
          className="flow-btn"
          aria-pressed={!running}
          onClick={() => setRunning(!running)}
        >
          {running ? 'Pause motion' : 'Play motion'}
        </button>
      </div>
    </section>
  );
}
