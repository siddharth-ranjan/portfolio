# Portfolio — siddharthranjan.app

React + Vite app, no backend. Deployed on Vercel from `siddharth-ranjan/portfolio`
(`main` = production). Primary domain: siddharthranjan.app;
siddharthranjan.me and both www hosts 308 to it (see README → Domains).

## Layout
    src/main.jsx        entry, imports styles.css
    src/App.jsx         composition, brand reveal, scrollspy, FlowContext (evict bridge)
    src/styles.css      the whole design system — tokens, layout, themes, responsive
    src/components/     one per section (Flow and Shell are the involved ones)
    src/hooks/          useTheme useReveal useFlow useScrollSpy
    src/shell/commands.js  command map, Damerau–Levenshtein suggestions
    src/entry-server.jsx   SSR entry; scripts/prerender.js injects the HTML into dist
    scripts/og-image.py    regenerates the link-preview card
    public/             favicon.svg + assets/ (resume.pdf, resume.png, icons) → served at /
    chess.html          second Vite page → /chess (vercel.json rewrite), client-rendered
    src/chess/          ChessPage, Board (react-chessboard v5), useCrowdGame (polling + moves)
    api/chess/          Vercel functions: state (GET, CDN s-maxage=1), move (POST), me, reset
    api/_lib/           game.js (chess.js rules), redisStore.js (Upstash + Lua commit),
                        memoryStore.js (tests/dev), store.js (picks one), session.js, http.js
    tests/              node:test game-logic suite

## Run / deploy
    npm install && npm run dev     # dev
    npm run build && npm run preview
    npm test                       # chess game logic
`build` = client build, then an SSR build, then `scripts/prerender.js` writes the
rendered markup into `dist/index.html`; the browser hydrates it.
Push to `main` → Vercel production build. `vercel.json` pins framework vite,
`npm run build`, output `dist`, keeps the /resume and /image redirects, and pins
functions to `bom1` (Mumbai) — the same region as the Upstash database. Move the
two together.

## Conventions
- Vite hashes bundle filenames, so no manual cache-busting (the old `?v=N` is gone).
- `styles.css` is deliberately global and unchanged from the static version; class
  names in JSX must match it exactly. Ids kept where CSS or tests rely on them
  (#flow-scroll, #term-input, #cv-body, #theme-switch, #req-preview …).
- `useFlow` stays imperative: it measures geometry and drives Web Animations,
  including on ::after pseudo-elements, which React cannot express. React owns
  only the counter, the response label and the paused state. It must clean up on
  unmount (StrictMode mounts effects twice in dev).
- Chain geometry: the hop number is a fixed 16px + 8px gap, so connectors sit at
  `50% + 12px` (desktop). Below 1100px both chains go vertical — motion switches
  axis via `vertical()`, and the fan uses the separate `.lanes-v` SVG.
- Motion plays even under prefers-reduced-motion (it is the content); *Pause
  motion* freezes it via `.motion-paused`. Scroll-reveal stays off under reduced motion.
- The shell input is uncontrolled on purpose: its own cursor position is the
  truth and the prompt mirrors it.
- The page is prerendered, so nothing browser-only may run during render:
  `useTheme` starts at 'dark' and adopts localStorage in an effect, `Shell` guards
  `matchMedia`, `Contact` fills its Idempotency-Key after mount. index.html sets
  `data-theme` from localStorage before paint so light mode does not flash.
- Link previews come from the static OG/Twitter tags in index.html plus
  `public/assets/og.png`; crawlers never run the JS.
- Crowd chess: the server is the authority. Every move is re-validated with chess.js
  and committed by the Lua script in `redisStore.js` (same game, same ply, visitor isn't
  the game's `lastSid` — nobody moves twice in a row) — keep checks there, not only in
  JS. The memory store must keep the same contract: `npm test` runs against it.
- `vite.config.js` builds two pages and skips `rollupOptions.input` for the SSR build
  (`isSsrBuild`), otherwise the prerender breaks. In dev, a middleware serves
  `/api/chess/*` via `ssrLoadModule` over the in-memory store.
- Keep Redis round trips low — each one is a request from the Vercel function to
  Upstash. `@upstash/redis` auto-pipelines commands started together (Promise.all)
  into one HTTP call: `getState` = 2 trips (current id, then game/movers/stats), a
  move = 3 (attempt count + id, game context, Lua commit). The move's response state
  is built from what was committed, never re-read. Responses carry `Server-Timing`.
- The board shows a move optimistically and rolls back if the server rejects it.
  Board colours are CSS variables (`--chess-light`, `--chess-dark`, `--chess-last`, …).

## What is real vs illustrative
Real: track record, résumé, links, contact form (opens the visitor's mail app),
and crowd chess at /chess (shared game state in Upstash Redis).
Illustrative and labelled as such: the hop-03 pool ("Simulated pool"), latencies,
cache hit/miss counter, lane picks, shell output. A scripted demo, not telemetry.
The redis box is clickable (evicts the key so the next request misses); a pulsing
"click to evict" tag on it advertises that; it hides while an eviction plays out
(the forced miss) and returns on the next cache hit.
The pool is interactive: clicking a healthy instance drains it, ejects it after two
failed checks, then boots a replacement that warms up before taking traffic.

## Résumé
`public/assets/resume.pdf` is exported straight from the Overleaf source with the
phone number left out — no post-processing. To update: export the PDF from
Overleaf, copy it over, then regenerate the phone fallback with
`pdftoppm -r 150 -png -singlefile public/assets/resume.pdf public/assets/resume`.

## Open ideas (not done)
- /chess needs Upstash connected in Vercel (Production + Preview); until then the API
  answers 503 and the page says the database isn't connected.
- The track record's undated rows show the issuer or venue ("Anthropic · Microsoft",
  "VIT Chennai") instead of a date, by choice.
