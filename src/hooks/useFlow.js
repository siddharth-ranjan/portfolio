import { useEffect, useRef, useState } from 'react';

const CACHE = 5;
const DB = 6;
// below 1100px the chain runs top to bottom, so motion switches axis
const vertical = () => matchMedia('(max-width:1100px)').matches;

/**
 * The live request animation. Deliberately imperative: it measures geometry and
 * drives Web Animations, including on ::after pseudo-elements, which React cannot
 * express. React owns only what is rendered as text: the counter, the response
 * label and the paused state.
 */
export function useFlow(flowRef, railRef, { onStats, onLabel }) {
  const [running, setRunning] = useState(true);
  const evictRef = useRef(() => 'unavailable');
  const runningRef = useRef(true);
  const flushRef = useRef(null);
  const cbs = useRef({ onStats, onLabel });
  cbs.current = { onStats, onLabel };

  useEffect(() => {
    const flow = flowRef.current;
    const rail = railRef.current;
    if (!flow || !rail || !flow.animate) return;

    const boxes = [...flow.querySelectorAll('.chain > .hop .box')];
    const edges = [...flow.querySelectorAll('.chain > .edge')];
    const back = flow.querySelector('.packet-back');
    const HINT = ` · ${matchMedia('(hover: none)').matches ? 'tap' : 'click'} redis to evict its key`;

    let stopped = false;
    let onScreen = false;
    let waiters = [];
    let anims = [];
    let n = 0, hits = 0, evicted = false;

    const live = () => runningRef.current && onScreen && !document.hidden && !stopped;
    const flush = () => {
      anims.forEach((a) => (live() ? a.play() : a.pause()));
      if (live() || stopped) { const w = waiters; waiters = []; w.forEach((r) => r()); }
    };
    flushRef.current = flush;
    const gate = () => (live() ? Promise.resolve() : new Promise((r) => waiters.push(r)));
    const sleep = (ms) => gate().then(() => new Promise((r) => setTimeout(r, ms)));
    const track = (a) => {
      anims.push(a);
      if (!live()) a.pause();
      return a.finished.then(() => { anims.splice(anims.indexOf(a), 1); }, () => {});
    };

    const rel = (el) => {
      const r = el.getBoundingClientRect();
      const c = flow.getBoundingClientRect();
      return { x: r.left - c.left + flow.scrollLeft, y: r.top - c.top, w: r.width, h: r.height };
    };
    const cx = (el) => { const b = rel(el); return b.x + b.w / 2; };
    const cy = (el) => { const b = rel(el); return b.y + b.h / 2; };
    const move = (el, from, to, ms, axis) => {
      const t = axis === 'y' ? 'translateY' : 'translateX';
      return track(el.animate(
        [{ transform: `${t}(${from}px)` }, { transform: `${t}(${to}px)` }],
        { duration: ms, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' }
      ));
    };

    // least-connections: send each request to the healthy instance with the fewest open conns
    const conns = {};
    const pickLane = (edge) => {
      const healthy = [...edge.querySelectorAll('.lanes .lane.ok')].map((l) => l.dataset.app);
      healthy.forEach((k) => { if (!(k in conns)) conns[k] = 1 + Math.floor(Math.random() * 4); });
      const pick = healthy.reduce((a, b) => (conns[b] < conns[a] ? b : a));
      healthy.forEach((k) => { if (k !== pick && Math.random() < 0.6) conns[k] = Math.max(0, conns[k] - 1); });
      conns[pick] += 2;
      return pick;
    };
    // the connector's own marker carries the request across its segment, then settles back
    const slide = (edge, ms) => {
      if (edge.classList.contains('edge-pool')) {
        const app = pickLane(edge);
        [...edge.querySelectorAll('[data-app]')].forEach((el) => {
          el.classList.toggle('pick', el.dataset.app === app);
        });
        const lanes = edge.querySelector(vertical() ? '.lanes-v' : '.lanes');
        const dot = lanes.querySelector('.pool-dot');
        dot.style.offsetPath = `path('${lanes.querySelector(`path[data-app="${app}"]`).getAttribute('d')}')`;
        return track(dot.animate(
          [{ offsetDistance: '0%', opacity: 1 }, { offsetDistance: '100%', opacity: 1 }],
          { duration: ms * 1.4, easing: 'cubic-bezier(.45,0,.55,1)' }
        ));
      }
      const prop = vertical() ? 'top' : 'left';
      const shadow = '0 0 14px var(--blue)';
      const from = { [prop]: '0%', opacity: 1, boxShadow: shadow };
      const to = { [prop]: '100%', opacity: 1, boxShadow: shadow };
      return track(edge.animate([from, to], {
        duration: ms, easing: 'cubic-bezier(.45,0,.55,1)', pseudoElement: '::after'
      }));
    };
    const reset = () => {
      boxes.forEach((b) => b.classList.remove('is-lit', 'is-miss'));
      [...flow.querySelectorAll('.edge-pool .pick')].forEach((el) => el.classList.remove('pick'));
    };

    const cycle = () => {
      n++;
      // a miss happens on schedule, or on the first request after someone evicts the key
      const miss = evicted || n % 6 === 3;
      evicted = false;
      const last = miss ? DB : CACHE;
      reset();
      boxes[0].classList.add('is-lit');

      let step = Promise.resolve();
      for (let i = 1; i <= last; i++) {
        step = step
          .then(() => (stopped ? null : slide(edges[i - 1], 430)))
          .then(() => {
            if (stopped) return null;
            if (i === CACHE) boxes[i].classList.remove('is-evicted');
            boxes[i].classList.add(miss && i === CACHE ? 'is-miss' : 'is-lit');
            return miss && i === CACHE ? sleep(380) : null;
          });
      }

      return step
        .then(() => {
          if (stopped) return null;
          cbs.current.onLabel({ text: `← 200 OK · ${miss ? '15.9ms · cache miss' : '3.9ms · cache hit'}`, miss });
          back.classList.toggle('miss', miss);
          back.classList.add('on');
          const dur = miss ? 1300 : 900;
          if (vertical()) {
            const y0 = rel(rail).y;
            return move(back, cy(boxes[last]) - y0 - 4.5, cy(boxes[0]) - y0 - 4.5, dur, 'y');
          }
          const x0 = rel(rail).x;
          return move(back, cx(boxes[last]) - x0 - 4.5, cx(boxes[0]) - x0 - 4.5, dur, 'x');
        })
        .then(() => {
          if (stopped) return null;
          back.classList.remove('on');
          if (!miss) hits++;
          cbs.current.onStats(
            `Live · ${n} requests · ${hits} cache hits · ${Math.round((hits / n) * 100)}% never reached mysql${HINT}`
          );
          return sleep(1500);
        });
    };

    const redis = boxes[CACHE];
    evictRef.current = () => {
      if (evicted) return 'pending';
      evicted = true;
      redis.classList.add('is-evicted');
      return live() ? 'ok' : 'paused';
    };
    const onEvictClick = () => evictRef.current();
    const onEvictKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); evictRef.current(); }
    };
    redis.addEventListener('click', onEvictClick);
    redis.addEventListener('keydown', onEvictKey);
    cbs.current.onStats(`Live · one GET every few seconds${HINT}`);

    const io = new IntersectionObserver((en) => { onScreen = en[0].isIntersecting; flush(); }, { threshold: 0.2 });
    io.observe(flow);
    document.addEventListener('visibilitychange', flush);

    (function loop() {
      if (stopped) return;
      gate().then(() => (stopped ? null : cycle())).then(() => { if (!stopped) loop(); });
    })();

    return () => {
      stopped = true;
      flushRef.current = null;
      io.disconnect();
      document.removeEventListener('visibilitychange', flush);
      redis.removeEventListener('click', onEvictClick);
      redis.removeEventListener('keydown', onEvictKey);
      anims.forEach((a) => a.cancel());
      anims = [];
      waiters.forEach((r) => r());
      waiters = [];
      reset();
    };
  }, [flowRef, railRef]);

  useEffect(() => {
    runningRef.current = running;
    document.documentElement.classList.toggle('motion-paused', !running);
    if (flushRef.current) flushRef.current();
  }, [running]);

  return { running, setRunning, evictRef };
}
