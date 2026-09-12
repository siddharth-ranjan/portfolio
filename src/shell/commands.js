// Each command returns lines of [class, text]; `clear` is a sentinel, and a
// { stream } result is printed line by line.
export function buildCommands(evict) {
  const COMMANDS = {
    help: () => [
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
    ],
    whoami: () => [
      ['ok', 'siddharth-ranjan · backend engineer · Java / Spring Boot'],
      ['dim', 'distributed systems · event-driven · Kafka, Redis, MySQL']
    ],
    flow: () => [
      ['dim', '01 client        browser · mobile · service call      0.0ms'],
      ['dim', '02 cdn           static served at the edge            1.2ms'],
      ['dim', '03 load balancer health checks · least-conn           2.0ms'],
      ['dim', '04 api gateway   JWT · rate limit · routing           2.6ms'],
      ['dim', '05 service ×3    stateless · idempotent writes        3.1ms'],
      ['dim', '06 redis         most reads end right here            3.5ms'],
      ['dim', '07 mysql         source of truth · on miss only     +12.0ms'],
      ['ok', '← 200 OK · 3.9ms · cache hit']
    ],
    trace: () => ({
      stream: [
        ['dim', 'GET /api/v1/orders/8821  →  tracing'],
        ['', '  01 client        0.0ms   request issued'],
        ['', '  02 cdn           1.2ms   miss, forwarding to origin'],
        ['', '  03 load balancer 2.0ms   least-conn → app-7'],
        ['', '  04 api gateway   2.6ms   jwt ok · quota 118/500'],
        ['', '  05 service       3.1ms   cache-aside lookup'],
        ['', '  06 redis         3.5ms   HIT orders:8821 (ttl 42s)'],
        ['warn', '  -- mysql never touched on this path'],
        ['ok', '← 200 OK · 3.9ms · cache hit']
      ]
    }),
    cache: () => [
      ['', 'read-through on every GET, TTL only — the cache owns nothing durable.'],
      ['dim', '  hit ratio      94.2% over the last hour'],
      ['dim', '  miss penalty   +12ms, one query to the primary'],
      ['dim', '  invalidation   write-through on commit, TTL as the backstop'],
      ['warn', '  a stampede is bounded by a per-key lock in redis']
    ],
    scale: () => [
      ['', 'least-connections over a pool that resizes under the URL.'],
      ['dim', '  target      65% cpu per instance'],
      ['dim', '  bounds      min 3 · max 12'],
      ['dim', '  cooldown    120s between actions'],
      ['dim', '  unhealthy   2 failed /healthz checks → eject'],
      ['ok', '  app-9 added, warming up — takes no traffic until it passes']
    ],
    failure: () => [
      ['', 'nothing here assumes the happy path.'],
      ['dim', '  instance dies      health check ejects it in 4s, client sees nothing'],
      ['dim', '  redis down         reads fall through to mysql, slower not broken'],
      ['dim', '  consumer lags      backpressure throttles intake, writes still land'],
      ['dim', '  poison message     routed to .DLT, partition keeps moving'],
      ['warn', '  redelivery is normal — every consumer is idempotent']
    ],
    stack: () => [
      ['dim', '  language    Java · Python · SQL'],
      ['dim', '  framework   Spring Boot · Spring Data JPA · Flask'],
      ['dim', '  messaging   Apache Kafka'],
      ['dim', '  cache       Redis'],
      ['dim', '  store       MySQL'],
      ['dim', '  cloud       AWS · Microsoft Azure'],
      ['dim', '  ai          LangChain · FAISS · Gemini API · Vertex AI']
    ],
    projects: () => [
      ['dim', '  [active]     TCS               System Engineer C1 — Prime      Jan 2026 →'],
      ['dim', '  [resolved]   Nokia             R&D Intern, FN BBN CU-Hardening Aug 24 – May 25'],
      ['dim', '  [build]      vigil             incident intelligence           Sept 2026 →'],
      ['dim', '  [shipped]    multi-pdf-chat    LangChain + FAISS document QA   Feb 2024'],
      ['dim', '  [shipped]    blogging-project  Spring Boot REST, JPA, MySQL    Jan – Feb 2024'],
      ['dim', '  [published]  IEEE              recommendation algorithms       2024'],
      ['dim', '  [certified]  Anthropic · Azure Claude Certified Dev · AZ-900 · AI-901'],
      ['dim', '  [won]        CODATHON          1st place, 36h — Hope Haven'],
      ['dim', '  [won]        DATAQUEST         2nd runner-up, ML hackathon']
    ],
    contact: () => [
      ['ok', '  siddharthranjan0909@gmail.com'],
      ['ok', '  github.com/siddharth-ranjan'],
      ['ok', '  linkedin.com/in/siddharth-ranjan09'],
      ['ok', '  leetcode.com/u/sid0909'],
      ['dim', '  India — open to backend roles'],
      ['', '  or send a request with the form at #contact ↓']
    ],
    evict: () => {
      const state = evict();
      if (state === 'unavailable') return [['warn', 'evict: the request flow is not running in this browser']];
      if (state === 'pending') return [['dim', 'orders:8821 is already evicted — the next GET will miss']];
      return [
        ['', 'redis> DEL orders:8821'],
        ['dim', '(integer) 1'],
        ['warn', 'next GET misses the cache, reads mysql (+12ms), and cache-aside refills the key'],
        state === 'paused'
          ? ['dim', 'the flow is paused or off-screen — scroll up to #flow and press Play motion']
          : ['ok', 'watch "how a request moves" above ↑']
      ];
    },
    clear: 'clear'
  };
  COMMANDS.miss = COMMANDS.evict;
  return COMMANDS;
}

// Damerau–Levenshtein (optimal string alignment): a swapped pair of letters counts as one slip
function distance(a, b) {
  const d = [];
  for (let i = 0; i <= a.length; i++) d[i] = [i];
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

// prefixes first ("ev" → evict), then the closest names within one slip (short words) or two
export function suggest(cmd, names) {
  const prefixed = names.filter((n) => n.indexOf(cmd) === 0);
  if (prefixed.length) return prefixed;
  const limit = cmd.length <= 3 ? 1 : 2;
  const near = names
    .map((n) => [n, distance(cmd, n)])
    .filter((p) => p[1] <= limit)
    .sort((a, b) => a[1] - b[1]);
  return near.filter((p) => p[1] === (near[0] && near[0][1])).map((p) => p[0]);
}
