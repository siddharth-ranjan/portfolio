(function () {
  'use strict';

  /* ── theme ──────────────────────────────────────────── */
  var root = document.documentElement;
  var stored = null;
  try { stored = localStorage.getItem('theme'); } catch (e) {}
  if (stored === 'light' || stored === 'dark') setTheme(stored);

  function setTheme(t) {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem('theme', t); } catch (e) {}
    document.querySelectorAll('[data-theme-set]').forEach(function (b) {
      b.classList.toggle('is-on', b.dataset.themeSet === t);
      b.setAttribute('aria-pressed', String(b.dataset.themeSet === t));
    });
  }
  document.querySelectorAll('[data-theme-set]').forEach(function (b) {
    b.addEventListener('click', function () { setTheme(b.dataset.themeSet); });
  });
  setTheme(root.getAttribute('data-theme'));

  /* ── top-bar name: only once the hero name has scrolled away ── */
  var topbar = document.querySelector('.topbar');
  var heroName = document.querySelector('.hero-name');
  if (topbar && heroName && 'IntersectionObserver' in window) {
    topbar.classList.add('brand-hidden');
    new IntersectionObserver(function (en) {
      topbar.classList.toggle('brand-hidden', en[0].isIntersecting);
    }, { rootMargin: '-64px 0px 0px 0px' }).observe(heroName);
  }

  /* ── reveal on scroll ───────────────────────────────── */
  var targets = document.querySelectorAll('section > .block-head, .block-sub, .chain-scroll, .panel, .owns li, .record li, .note-rule');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    targets.forEach(function (el, i) {
      el.classList.add('reveal');
      el.style.transitionDelay = (i % 6) * 40 + 'ms';
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* ── load bars animate in ───────────────────────────── */
  var pool = document.querySelector('.pool');
  if (pool) {
    var fills = [].slice.call(pool.querySelectorAll('.fill'));
    var widths = fills.map(function (f) { return f.style.getPropertyValue('--w'); });
    fills.forEach(function (f) { f.style.width = '0%'; });
    var poolIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        fills.forEach(function (f, i) {
          setTimeout(function () { f.style.width = widths[i]; }, 120 + i * 110);
        });
        poolIO.disconnect();
        setInterval(drift, 1800);
      });
    }, { threshold: 0.3 });
    poolIO.observe(pool);

    // least-connections keeps healthy instances near their baseline, never exactly on it
    var drift = function () {
      if (document.hidden || root.classList.contains('motion-paused')) return;
      fills.forEach(function (f, i) {
        if (!f.classList.contains('ok')) return;
        var base = parseFloat(widths[i]);
        var v = Math.max(8, Math.min(95, Math.round(base + (Math.random() * 12 - 6))));
        f.style.width = v + '%';
        f.closest('li').querySelector('.load').textContent = v + '%';
      });
    };
  }

  /* ── live request flow ──────────────────────────────── */
  // set by the flow below; the shell's `evict` command calls it too
  var evictKey = function () { return 'unavailable'; };
  var flow = document.getElementById('flow-scroll');
  if (flow && flow.animate) {
    var boxes = [].slice.call(flow.querySelectorAll('.chain > .hop .box'));
    var edges = [].slice.call(flow.querySelectorAll('.chain > .edge'));
    var back = flow.querySelector('.packet-back');
    var rail = flow.querySelector('.return-rail');
    var labels = [document.getElementById('rail-label'), document.getElementById('rail-label-m')].filter(Boolean);
    var stats = document.getElementById('flow-stats');
    var toggle = document.getElementById('flow-toggle');
    var CACHE = 5, DB = 6;
    // below 1100px the chain runs top to bottom, so motion switches axis
    var vertical = function () { return matchMedia('(max-width:1100px)').matches; };
    // live motion is the point of this section, so it plays even under reduced-motion;
    // the Pause button freezes everything (WCAG 2.2.2)
    var running = true, onScreen = false, waiters = [], anims = [];
    var n = 0, hits = 0, misses = 0, evicted = false;
    var HINT = ' · ' + (matchMedia('(hover: none)').matches ? 'tap' : 'click') + ' redis to evict its key';

    var live = function () { return running && onScreen && !document.hidden; };
    var flush = function () {
      anims.forEach(function (a) { live() ? a.play() : a.pause(); });
      if (live()) { var w = waiters; waiters = []; w.forEach(function (r) { r(); }); }
    };
    var gate = function () { return live() ? Promise.resolve() : new Promise(function (r) { waiters.push(r); }); };
    var sleep = function (ms) { return gate().then(function () { return new Promise(function (r) { setTimeout(r, ms); }); }); };
    var track = function (a) {
      anims.push(a);
      if (!live()) a.pause();
      return a.finished.then(function () { anims.splice(anims.indexOf(a), 1); });
    };

    var rel = function (el) {
      var r = el.getBoundingClientRect(), c = flow.getBoundingClientRect();
      return { x: r.left - c.left + flow.scrollLeft, y: r.top - c.top, w: r.width, h: r.height };
    };
    var cx = function (el) { var b = rel(el); return b.x + b.w / 2; };
    var cy = function (el) { var b = rel(el); return b.y + b.h / 2; };
    var move = function (el, from, to, ms, axis) {
      var t = axis === 'y' ? 'translateY' : 'translateX';
      return track(el.animate(
        [{ transform: t + '(' + from + 'px)' }, { transform: t + '(' + to + 'px)' }],
        { duration: ms, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' }));
    };

    // least-connections: send each request to the healthy instance with the fewest open conns
    var conns = {};
    var pickLane = function (edge) {
      var healthy = [].slice.call(edge.querySelectorAll('.lanes .lane.ok')).map(function (l) { return l.dataset.app; });
      healthy.forEach(function (k) { if (!(k in conns)) conns[k] = 1 + Math.floor(Math.random() * 4); });
      var pick = healthy.reduce(function (a, b) { return conns[b] < conns[a] ? b : a; });
      healthy.forEach(function (k) { if (k !== pick && Math.random() < 0.6) conns[k] = Math.max(0, conns[k] - 1); });
      conns[pick] += 2;
      return pick;
    };
    // the connector's own marker carries the request across its segment, then settles back
    var slide = function (edge, ms) {
      if (edge.classList.contains('edge-pool')) {
        var app = pickLane(edge);
        [].slice.call(edge.querySelectorAll('[data-app]')).forEach(function (el) {
          el.classList.toggle('pick', el.dataset.app === app);
        });
        var lanes = edge.querySelector(vertical() ? '.lanes-v' : '.lanes');
        var dot = lanes.querySelector('.pool-dot');
        dot.style.offsetPath = "path('" + lanes.querySelector('path[data-app="' + app + '"]').getAttribute('d') + "')";
        return track(dot.animate(
          [{ offsetDistance: '0%', opacity: 1 }, { offsetDistance: '100%', opacity: 1 }],
          { duration: ms * 1.4, easing: 'cubic-bezier(.45,0,.55,1)' }));
      }
      var from = {}, to = {}, prop = vertical() ? 'top' : 'left';
      from[prop] = '0%'; to[prop] = '100%';
      from.opacity = to.opacity = 1;
      from.boxShadow = to.boxShadow = '0 0 14px var(--blue)';
      return track(edge.animate([from, to],
        { duration: ms, easing: 'cubic-bezier(.45,0,.55,1)', pseudoElement: '::after' }));
    };
    var reset = function () {
      boxes.forEach(function (b) { b.classList.remove('is-lit', 'is-miss'); });
      [].slice.call(flow.querySelectorAll('.edge-pool .pick')).forEach(function (el) { el.classList.remove('pick'); });
    };

    var cycle = function () {
      n++;
      // a miss happens on schedule, or on the first request after someone evicts the key
      var miss = evicted || n % 6 === 3;
      evicted = false;
      var last = miss ? DB : CACHE;
      reset();
      boxes[0].classList.add('is-lit');

      var step = Promise.resolve();
      for (var i = 1; i <= last; i++) (function (i) {
        step = step.then(function () {
          return slide(edges[i - 1], 430);
        }).then(function () {
          if (i === CACHE) boxes[i].classList.remove('is-evicted');
          boxes[i].classList.add(miss && i === CACHE ? 'is-miss' : 'is-lit');
          if (miss && i === CACHE) return sleep(380);
        });
      })(i);

      return step.then(function () {
        var ms = miss ? '15.9ms · cache miss' : '3.9ms · cache hit';
        labels.forEach(function (l) {
          l.textContent = '← 200 OK · ' + ms;
          l.classList.toggle('miss', miss);
        });
        back.classList.toggle('miss', miss);
        back.classList.add('on');
        var dur = miss ? 1300 : 900;
        if (vertical()) {
          var y0 = rel(rail).y;
          return move(back, cy(boxes[last]) - y0 - 4.5, cy(boxes[0]) - y0 - 4.5, dur, 'y');
        }
        var x0 = rel(rail).x;
        return move(back, cx(boxes[last]) - x0 - 4.5, cx(boxes[0]) - x0 - 4.5, dur, 'x');
      }).then(function () {
        back.classList.remove('on');
        miss ? misses++ : hits++;
        stats.textContent = 'Live · ' + n + ' requests · ' + hits + ' cache hits · ' +
          Math.round(hits / n * 100) + '% never reached postgres' + HINT;
        return sleep(1500);
      });
    };

    var redis = boxes[CACHE];
    evictKey = function () {
      if (evicted) return 'pending';
      evicted = true;
      redis.classList.add('is-evicted');
      return live() ? 'ok' : 'paused';
    };
    redis.setAttribute('role', 'button');
    redis.setAttribute('tabindex', '0');
    redis.setAttribute('aria-label', 'Evict the cached key: the next request misses and reads from postgres');
    redis.title = 'Evict the cached key';
    redis.addEventListener('click', function () { evictKey(); });
    redis.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); evictKey(); }
    });
    stats.textContent += HINT;

    (function loop() { gate().then(cycle).then(loop); })();

    var setRunning = function (on) {
      running = on;
      toggle.textContent = on ? 'Pause motion' : 'Play motion';
      root.classList.toggle('motion-paused', !on);
      toggle.setAttribute('aria-pressed', String(!on));
      flush();
    };
    setRunning(running);
    toggle.addEventListener('click', function () { setRunning(!running); });
    document.addEventListener('visibilitychange', flush);
    new IntersectionObserver(function (en) { onScreen = en[0].isIntersecting; flush(); }, { threshold: 0.2 }).observe(flow);
  }

  /* ── résumé preview: closed until asked for ─────────── */
  var cv = document.getElementById('cv-body');
  var cvToggle = document.getElementById('cv-toggle');
  if (cv && cvToggle && cv.dataset.src) {
    var cvPanel = cv.closest('.cv');
    var built = false;
    // the PDF only loads once someone opens the preview; phones get a page image instead
    var buildPreview = function () {
      var frame = document.createElement('iframe');
      frame.src = cv.dataset.src + '#view=FitH';
      frame.title = 'Résumé preview';
      frame.className = 'cv-frame';
      cv.appendChild(frame);
      if (cv.dataset.img) {
        var shot = document.createElement('a');
        shot.className = 'cv-shot';
        shot.href = cv.dataset.src;
        shot.target = '_blank';
        shot.rel = 'noopener';
        shot.innerHTML = '<img src="' + cv.dataset.img + '" alt="Résumé of Siddharth Ranjan, page 1">';
        cv.appendChild(shot);
      }
      built = true;
    };
    cvToggle.addEventListener('click', function () {
      var open = cv.hidden;
      if (open && !built) buildPreview();
      cv.hidden = !open;
      cvPanel.classList.toggle('is-open', open);
      cvToggle.textContent = open ? 'Close preview' : 'Preview résumé';
      cvToggle.setAttribute('aria-expanded', String(open));
      // closing a tall preview from further down: bring the panel header back into view
      if (!open) cvPanel.scrollIntoView({ block: 'nearest' });
    });
  }

  /* ── contact form ───────────────────────────────────── */
  var form = document.getElementById('req-form');
  if (form) {
    var TO = 'siddharthranjan0909@gmail.com';
    // each route gets its own subject line and its own prompt for the message
    var ROUTES = {
      '/roles': {
        subject: 'Backend role',
        hint: 'the role, team and stack',
        placeholder: "We're hiring a backend engineer for our payments team (Java 21, Spring Boot, Kafka). Here's the role and what the interview loop looks like…"
      },
      '/contract': {
        subject: 'Contract work',
        hint: 'scope, timeline and budget',
        placeholder: "We're moving order events from a nightly cron job to Kafka and need someone who has shipped a transactional outbox. Roughly 6 weeks, starting…"
      },
      '/collab': {
        subject: 'Collaboration',
        hint: 'what we would build together',
        placeholder: "I'm building an open-source rate limiter on Redis and want a second pair of eyes on the sliding-window logic…"
      },
      '/hello': {
        subject: 'Hello',
        hint: 'anything at all',
        placeholder: "Evicted your Redis key and watched the request fall through to Postgres. Neat. Just saying hi."
      }
    };
    var preview = document.getElementById('req-preview');
    var reqStatus = document.getElementById('req-status');
    var idemKey = (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)).slice(0, 8);
    var esc = function (t) { return t.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); };
    var field = function (name) { return form.elements[name].value.trim(); };
    var json = function (name, ph) {
      var v = field(name);
      return v ? '<span class="s">' + esc(JSON.stringify(v)) + '</span>' : '<span class="ph">' + ph + '</span>';
    };
    var renderRequest = function () {
      form.elements.payload.placeholder = ROUTES[form.elements.route.value].placeholder;
      preview.innerHTML =
        '<span class="m">POST</span> /v1/messages HTTP/1.1\n' +
        '<span class="k">To:</span> ' + TO + '\n' +
        '<span class="k">Content-Type:</span> application/json\n' +
        '<span class="k">Idempotency-Key:</span> ' + idemKey + '\n\n{\n' +
        '  <span class="k">"from"</span>: ' + json('from', 'your name') + ',\n' +
        '  <span class="k">"reply_to"</span>: ' + json('reply_to', 'you@company.com') + ',\n' +
        '  <span class="k">"route"</span>: <span class="s">"' + form.elements.route.value + '"</span>,\n' +
        '  <span class="k">"payload"</span>: ' + json('payload', ROUTES[form.elements.route.value].hint) + '\n}';
    };
    form.addEventListener('input', function (e) {
      if (e.target.getAttribute('aria-invalid')) e.target.removeAttribute('aria-invalid');
      renderRequest();
    });
    renderRequest();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var errors = [];
      var check = function (name, ok, msg) {
        var el = form.elements[name];
        if (ok) { el.removeAttribute('aria-invalid'); return; }
        el.setAttribute('aria-invalid', 'true');
        errors.push({ el: el, msg: msg });
      };
      check('from', field('from'), '"from" is required');
      check('reply_to', field('reply_to') && form.elements.reply_to.checkValidity(), '"reply_to" must be an email address');
      check('payload', field('payload').length >= 10, '"payload" needs a few words');
      if (errors.length) {
        reqStatus.className = 'req-status err';
        reqStatus.textContent = '400 Bad Request — ' + errors[0].msg;
        errors[0].el.focus();
        return;
      }
      var route = form.elements.route.value;
      var subject = ROUTES[route].subject + ' — ' + field('from');
      var body = field('payload') + '\n\n— ' + field('from') + '\n' + field('reply_to');
      window.location.href = 'mailto:' + TO + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      reqStatus.className = 'req-status ok';
      reqStatus.innerHTML = '202 Accepted — opening your mail app. Nothing opened? Write to <a href="mailto:' + TO + '">' + TO + '</a>';
    });
  }

  /* ── scrollspy ──────────────────────────────────────── */
  var links = [].slice.call(document.querySelectorAll('.nav a'));
  var sections = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  window.addEventListener('scroll', function () {
    var y = window.scrollY + 120, active = -1;
    sections.forEach(function (s, i) { if (s && s.offsetTop <= y) active = i; });
    links.forEach(function (a, i) { a.classList.toggle('is-active', i === active); });
  }, { passive: true });

  /* ── shell ──────────────────────────────────────────── */
  var term = document.getElementById('term-body');
  var typed = document.getElementById('typed');
  var input = document.getElementById('term-input');
  if (!term || !typed || !input) return;
  var promptLine = typed.closest('.prompt-line');
  var touch = matchMedia('(hover: none)').matches;
  var history = [];
  var hIndex = -1;

  var COMMANDS = {
    help: function () {
      return [
        ['dim', 'commands'],
        ['', '  whoami     who is behind this'],
        ['', '  trace      walk the request path hop by hop'],
        ['', '  flow       the seven hops, one line each'],
        ['', '  cache      what the cache absorbs'],
        ['', '  scale      how the pool resizes'],
        ['', '  failure    what breaks and what happens next'],
        ['', '  evict      drop the cached key so the next GET misses'],
        ['', '  stack      the tools in play'],
        ['', '  projects   track record'],
        ['', '  contact    how to reach me'],
        ['', '  clear      wipe the screen']
      ];
    },
    whoami: function () {
      return [
        ['ok', 'siddharth-ranjan · backend engineer · Java 21 / Spring Boot'],
        ['dim', 'distributed systems · event-driven · Kafka, Redis, Postgres']
      ];
    },
    flow: function () {
      return [
        ['dim', '01 client        browser · mobile · service call      0.0ms'],
        ['dim', '02 cdn           static served at the edge            1.2ms'],
        ['dim', '03 load balancer health checks · least-conn           2.0ms'],
        ['dim', '04 api gateway   JWT · rate limit · routing           2.6ms'],
        ['dim', '05 service ×3    stateless · idempotent writes        3.1ms'],
        ['dim', '06 redis         most reads end right here            3.5ms'],
        ['dim', '07 postgres      source of truth · on miss only     +12.0ms'],
        ['ok', '← 200 OK · 3.9ms · cache hit']
      ];
    },
    trace: function () {
      return {
        stream: [
          ['dim', 'GET /api/v1/orders/8821  →  tracing'],
          ['', '  01 client        0.0ms   request issued'],
          ['', '  02 cdn           1.2ms   miss, forwarding to origin'],
          ['', '  03 load balancer 2.0ms   least-conn → app-7'],
          ['', '  04 api gateway   2.6ms   jwt ok · quota 118/500'],
          ['', '  05 service       3.1ms   cache-aside lookup'],
          ['', '  06 redis         3.5ms   HIT orders:8821 (ttl 42s)'],
          ['warn', '  -- postgres never touched on this path'],
          ['ok', '← 200 OK · 3.9ms · cache hit']
        ]
      };
    },
    cache: function () {
      return [
        ['', 'read-through on every GET, TTL only — the cache owns nothing durable.'],
        ['dim', '  hit ratio      94.2% over the last hour'],
        ['dim', '  miss penalty   +12ms, one query to the primary'],
        ['dim', '  invalidation   write-through on commit, TTL as the backstop'],
        ['warn', '  a stampede is bounded by a per-key lock in redis']
      ];
    },
    scale: function () {
      return [
        ['', 'least-connections over a pool that resizes under the URL.'],
        ['dim', '  target      65% cpu per instance'],
        ['dim', '  bounds      min 3 · max 12'],
        ['dim', '  cooldown    120s between actions'],
        ['dim', '  unhealthy   2 failed /healthz checks → eject'],
        ['ok', '  app-9 added, warming up — takes no traffic until it passes']
      ];
    },
    failure: function () {
      return [
        ['', 'nothing here assumes the happy path.'],
        ['dim', '  instance dies      health check ejects it in 4s, client sees nothing'],
        ['dim', '  redis down         reads fall through to postgres, slower not broken'],
        ['dim', '  consumer lags      backpressure throttles intake, writes still land'],
        ['dim', '  poison message     routed to .DLT, partition keeps moving'],
        ['warn', '  redelivery is normal — every consumer is idempotent']
      ];
    },
    stack: function () {
      return [
        ['dim', '  language    Java 21 · Python 3.12'],
        ['dim', '  framework   Spring Boot / MVC'],
        ['dim', '  event bus   Kafka (KRaft)'],
        ['dim', '  cache       Redis 7'],
        ['dim', '  store       Postgres 16 + pgvector'],
        ['dim', '  testing     TDD · PIT mutation']
      ];
    },
    projects: function () {
      return [
        ['dim', '  [active]     TCS               System Engineer C1 — Prime      Jan 2026 →'],
        ['dim', '  [resolved]   Nokia             R&D Intern, FN BBN CU-Hardening Aug 24 – May 25'],
        ['dim', '  [build]      vigil             incident intelligence           Sept 2026 →'],
        ['dim', '  [shipped]    multi-pdf-chat    LangChain + FAISS document QA   Feb 2024'],
        ['dim', '  [shipped]    movie-reservation Spring Modulith, JWT, RBAC      2025'],
        ['dim', '  [published]  IEEE              recommendation algorithms       2024']
      ];
    },
    contact: function () {
      return [
        ['ok', '  siddharthranjan0909@gmail.com'],
        ['ok', '  github.com/siddharth-ranjan'],
        ['ok', '  linkedin.com/in/siddharth-ranjan09'],
        ['ok', '  leetcode.com/u/sid0909'],
        ['dim', '  India — open to backend roles'],
        ['', '  or send a request with the form at #contact ↓']
      ];
    },
    evict: function () {
      var state = evictKey();
      if (state === 'unavailable') return [['warn', 'evict: the request flow is not running in this browser']];
      if (state === 'pending') return [['dim', 'orders:8821 is already evicted — the next GET will miss']];
      var out = [
        ['', 'redis> DEL orders:8821'],
        ['dim', '(integer) 1'],
        ['warn', 'next GET misses the cache, reads postgres (+12ms), and cache-aside refills the key']
      ];
      out.push(state === 'paused'
        ? ['dim', 'the flow is paused or off-screen — scroll up to #flow and press Play motion']
        : ['ok', 'watch "how a request moves" above ↑']);
      return out;
    },
    clear: 'clear'
  };
  COMMANDS.miss = COMMANDS.evict;

  function push(cls, text) {
    var el = document.createElement('div');
    el.className = 'line' + (cls ? ' ' + ({ dim: 'dim', ok: 'ok-t', warn: 'warn-t' }[cls] || '') : '');
    el.textContent = text;
    term.insertBefore(el, promptLine);
    term.scrollTop = term.scrollHeight;
    return el;
  }

  function echo(cmd) {
    var el = document.createElement('div');
    el.className = 'line';
    el.innerHTML = '<span class="ps">$</span> <span class="cmd"></span>';
    el.querySelector('.cmd').textContent = cmd;
    term.insertBefore(el, promptLine);
  }

  var busy = false;

  function run(raw) {
    var cmd = raw.trim().toLowerCase();
    echo(raw);
    if (!cmd) return;
    history.unshift(raw);
    hIndex = -1;

    var handler = COMMANDS[cmd];
    if (!handler) {
      push('warn', 'sr-shell: ' + cmd + ': command not found — type `help`');
      return;
    }
    if (handler === 'clear') {
      [].slice.call(term.querySelectorAll('.line')).forEach(function (l) {
        if (l !== promptLine) term.removeChild(l);
      });
      return;
    }
    var out = handler();
    if (Array.isArray(out)) {
      out.forEach(function (l) { push(l[0], l[1]); });
    } else if (out && out.stream) {
      busy = true;
      out.stream.forEach(function (l, i) {
        setTimeout(function () {
          push(l[0], l[1]);
          if (i === out.stream.length - 1) busy = false;
        }, i * 260);
      });
    }
  }

  // the input is invisible so phone keyboards have something to type into;
  // the prompt line mirrors whatever is in it
  function render() { typed.textContent = input.value; }
  function setLine(v) { input.value = v; render(); }
  render();

  term.addEventListener('click', function () { input.focus({ preventScroll: true }); });
  input.addEventListener('input', render);

  input.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (busy) return;
      var v = input.value; setLine(''); run(v);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (hIndex < history.length - 1) { hIndex++; setLine(history[hIndex]); }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (hIndex > 0) { hIndex--; setLine(history[hIndex]); }
      else { hIndex = -1; setLine(''); }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      var m = Object.keys(COMMANDS).filter(function (k) { return k.indexOf(input.value.trim()) === 0; });
      if (m.length === 1) setLine(m[0]);
      else if (m.length > 1) { echo(input.value); push('dim', m.join('  ')); }
    }
  });

  document.querySelectorAll('.term-keys button').forEach(function (b) {
    b.addEventListener('click', function () {
      if (busy) return;
      setLine(''); run(b.dataset.cmd);
      // on touch screens, don't pop the keyboard up just because a button was tapped
      if (!touch) input.focus({ preventScroll: true });
    });
  });
})();
