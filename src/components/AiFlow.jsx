import { Fragment, useEffect, useRef, useState } from 'react';
import { createEvictMachine } from '../hooks/evictPhase.js';

// "How an AI answer moves": one question through retrieval and the model. Illustrative,
// like the request flow above it. Unlike useFlow this is plain React state on a timer —
// the chain's own CSS draws the boxes and connectors. The semantic cache is clickable and
// uses the same one-eviction-at-a-time rules as redis (src/hooks/evictPhase.js).
const HOPS = [
  { title: 'user', desc: 'asks a question', ms: '0ms' },
  { title: 'api gateway', desc: 'auth · quota', ms: '2ms' },
  { title: 'rag service', desc: 'normalises it · builds the prompt', ms: '3ms' },
  { title: 'semantic cache', desc: 'repeat questions end here', ms: '4ms', cache: true },
  { title: 'embeddings', desc: 'question → vector', ms: '+38ms' },
  { title: 'faiss', desc: 'top-4 chunks', ms: '+6ms' },
  { title: 'llm', desc: 'answers from the chunks', ms: '+1.3s on miss', dashed: true }
];
const EDGES = ['HTTPS', 'internal', 'lookup', 'on miss only', 'search', 'context'];
const CACHE = 3;
const STEP_MS = 520;
const REST_MS = 1500;
const HIT = { text: '← answer · 4ms · from the cache', miss: false };
const MISS = { text: '← answer · 1.36s · written from 4 retrieved chunks', miss: true };

export default function AiFlow() {
  const sectionRef = useRef(null);
  const machineRef = useRef(null);
  const [lit, setLit] = useState(-1);
  const [miss, setMiss] = useState(false);
  const [evicted, setEvicted] = useState(false);
  const [hint, setHint] = useState(true);
  const [label, setLabel] = useState(HIT);
  const [stats, setStats] = useState('Illustrative · one question every few seconds');

  useEffect(() => {
    const el = sectionRef.current;
    const machine = createEvictMachine();
    machineRef.current = machine;
    let stopped = false;
    let onScreen = !('IntersectionObserver' in window);
    let n = 0;
    let hits = 0;
    const io = onScreen ? null : new IntersectionObserver((en) => { onScreen = en[0].isIntersecting; }, { threshold: 0.2 });
    if (io) io.observe(el);

    // time only passes while the section is on screen, the tab is visible and motion isn't paused
    const live = () => onScreen && !document.hidden && !document.documentElement.classList.contains('motion-paused');
    const tick = () => new Promise((r) => setTimeout(r, 100));
    const wait = async (ms) => {
      for (let left = ms; left > 0 && !stopped;) {
        await tick();
        if (live()) left -= 100;
      }
    };

    (async () => {
      while (!stopped) {
        while (!stopped && !live()) await tick();
        if (stopped) return;
        n += 1;
        const { miss: isMiss } = machine.start(n);
        setMiss(isMiss);
        const last = isMiss ? HOPS.length - 1 : CACHE;
        for (let i = 0; i <= last && !stopped; i++) {
          setLit(i);
          if (i === CACHE) setEvicted(false);
          await wait(i === CACHE && isMiss ? STEP_MS + 380 : STEP_MS);
        }
        if (stopped) return;
        if (!isMiss) hits += 1;
        setLabel(isMiss ? MISS : HIT);
        if (machine.finish(isMiss)) setHint(true);
        setStats(`Illustrative · ${n} questions · ${hits} from the cache · ${Math.round((hits / n) * 100)}% never reached the model`);
        await wait(REST_MS);
        setLit(-1);
        setMiss(false);
      }
    })();

    return () => {
      stopped = true;
      if (io) io.disconnect();
    };
  }, []);

  const forget = () => {
    const machine = machineRef.current;
    if (!machine || machine.tap() !== 'ok') return; // ignored while an eviction plays out
    setEvicted(true);
    setHint(false);
  };

  const boxClass = (i, hop) => {
    const cls = ['box'];
    if (hop.dashed) cls.push('is-dashed');
    if (i <= lit) cls.push(i === CACHE && miss ? 'is-miss' : 'is-lit');
    if (hop.cache && evicted && lit < CACHE) cls.push('is-evicted');
    return cls.join(' ');
  };

  const cacheProps = {
    role: 'button',
    tabIndex: 0,
    title: 'Forget the cached answer',
    'aria-label': 'Forget the cached answer: the next question goes all the way to the model',
    onClick: forget,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); forget(); }
    }
  };

  return (
    <section id="ai-flow" className="wrap block" ref={sectionRef}>
      <div className="block-head">
        <h2>How an AI answer moves</h2>
        <span className="tag">Repeat questions never reach the model</span>
      </div>
      <p className="block-sub">
        One question, seven hops. A question asked before stops at the semantic cache in
        milliseconds; a new one pays for embeddings, a vector search and the model. Click the
        cache to forget an answer and watch the next question go all the way.
      </p>

      <div className="chain-scroll flow-scroll ai-flow">
        <ol className="chain">
          {HOPS.map((hop, i) => (
            <Fragment key={hop.title}>
              {i > 0 && (
                <li className={`edge${lit === i ? ' is-pass' : ''}`} aria-hidden="true"><span>{EDGES[i - 1]}</span></li>
              )}
              <li className="hop">
                <span className="hop-n">{String(i + 1).padStart(2, '0')}</span>
                <div className={boxClass(i, hop)} {...(hop.cache ? cacheProps : {})}>
                  <h3>{hop.title}</h3>
                  <p>{hop.desc}</p>
                  <span className="ms">{hop.ms}</span>
                  {hop.cache && hint && <span className="evict-hint" aria-hidden="true" />}
                </div>
              </li>
            </Fragment>
          ))}
        </ol>
      </div>

      <div className="flow-meta">
        <span className={`ai-answer${label.miss ? ' miss' : ''}`}>{label.text}</span>
        <span className="tag">{stats}</span>
      </div>
    </section>
  );
}
