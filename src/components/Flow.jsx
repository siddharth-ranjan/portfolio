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

function Hop({ n, title, desc, ms, boxClass, boxProps, hint }) {
  return (
    <li className="hop">
      <span className="hop-n">{n}</span>
      <div className={boxClass ? `box ${boxClass}` : 'box'} {...boxProps}>
        <h3>{title}</h3>
        <p>{desc}</p>
        {ms && <span className="ms">{ms}</span>}
        {hint}
      </div>
    </li>
  );
}

const Edge = ({ label }) => (
  <li className="edge" aria-hidden="true"><span>{label}</span></li>
);

// one path for an API call or a question: hops 05–07 are the AI side
const FLOW_LABELS = { hit: '4.1ms · cache hit', miss: '1.36s · cache miss → model', never: 'never reached the model' };

export default function Flow() {
  const flowRef = useRef(null);
  const railRef = useRef(null);
  const bridge = useEvict();
  const [stats, setStats] = useState('Live · one GET every few seconds');
  const [label, setLabel] = useState({ text: `← 200 OK · ${FLOW_LABELS.hit}`, miss: false });

  // the "click to evict" tag hides while an eviction plays out, and returns on the next cache hit
  const [evictPending, setEvictPending] = useState(false);

  const onStats = useCallback((t) => setStats(t), []);
  const onLabel = useCallback((l) => setLabel(l), []);
  const onEvict = useCallback(() => setEvictPending(true), []);
  const onEvictCleared = useCallback(() => setEvictPending(false), []);
  const { running, setRunning, evictRef } = useFlow(flowRef, railRef, { onStats, onLabel, onEvict, onEvictCleared, labels: FLOW_LABELS });

  // let the shell's `evict` command reach this section
  useEffect(() => { bridge.current = () => evictRef.current(); }, [bridge, evictRef]);

  const labelClass = `return-label${label.miss ? ' miss' : ''}`;

  return (
    <section id="flow" className="wrap block">
      <div className="block-head">
        <h2>One request path, AI included</h2>
        <span className="tag">Solid = blocking · Dashed = async</span>
      </div>
      <p className="block-sub">
        One API call or one question, seven hops. Most end at the cache in milliseconds; a new
        question goes on to retrieval and the model. Click redis to evict an answer and watch the
        next one go all the way.
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
          <Hop n="05" title="rag service ×3" desc="stateless · retrieval + prompt" ms="3.1ms" />
          <Edge label="cache-aside" />
          {/* redis is the one box you can act on: evicting its key forces the next request to miss */}
          <Hop
            n="06" title="redis" desc="semantic cache · repeats end here" ms="3.5ms"
            hint={evictPending ? null : <span className="evict-hint" aria-hidden="true" />}
            boxProps={{
              role: 'button',
              tabIndex: 0,
              title: 'Evict the cached answer',
              'aria-label': 'Evict the cached answer: the next question misses and goes to the model'
            }}
          />
          <Edge label="on miss only" />
          <Hop n="07" title="faiss + llm" desc="embed · search · generate" ms="+1.3s on miss" boxClass="is-dashed" />
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
