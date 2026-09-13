# Portfolio — siddharthranjan.app

React + Vite. The page is one long scroll about how a request moves through a
distributed system, with the diagrams animating live.

    src/
      main.jsx          entry; imports styles.css
      App.jsx           composition, top-bar name reveal, scrollspy, evict bridge
      styles.css        design tokens, layout, dark/light themes, responsive rules
      components/       TopBar Hero Flow PoolPanel Async Ownership Shell
                        TrackRecord Resume Contact Footer
      hooks/            useTheme useReveal usePool useFlow useScrollSpy
      shell/commands.js shell command map + typo suggestions
    public/             favicon.svg, assets/ (resume.pdf, resume.png, icons)
      chess/            the /chess page: ChessPage, Board, useCrowdGame
    api/chess/          Vercel functions: state, move, me, reset
    api/_lib/           game logic (chess.js), Redis + in-memory stores, session
    tests/              node:test suite for the game logic (`npm test`)

## Run

    npm install
    npm run dev        # http://localhost:5173
    npm run build      # → dist/ (client build + SSR build + prerender)
    npm run preview    # serve the built output
    npm test           # crowd chess game-logic tests

## Deploy

Push to `main`; Vercel builds with `npm run build` and serves `dist/`
(`vercel.json`). Domain: siddharthranjan.app.

## Domains

| Host | Behaviour |
|---|---|
| `siddharthranjan.app` | serves the site (primary) |
| `www.siddharthranjan.app` | 308 → `siddharthranjan.app` |
| `siddharthranjan.me` | 308 → `siddharthranjan.app` |
| `www.siddharthranjan.me` | 308 → `siddharthranjan.app` |

`.app` DNS is hosted at Name.com (nameservers stay with Name.com):
apex `A` → `216.198.79.1`, `CNAME www` → the target Vercel shows under the
domain (currently `d6b6c1cc938b9fba.vercel-dns-017.com`).

### Changing the primary domain later

For example back to `.me`, or to a new domain:

1. **Vercel** → project → Settings → Domains: add the domain if it is not
   listed, wait for it to verify, then edit it and choose *Connect to an
   environment → Production*. Edit the old primary and set it to *Redirect to*
   the new one (308). Do the same for its `www`.
2. **DNS** at the new domain's registrar: add the records Vercel lists for it
   (apex `A` record and `CNAME www`). Leave the old domain's records alone until
   its redirect is confirmed working.
3. **Code** — four absolute URLs in `index.html` name the primary domain:
   `<link rel="canonical">`, `og:url`, `og:image`, `twitter:image`. Find them with
   `grep -n 'siddharthranjan\.' index.html`, change them, push to `main`.
   Update the domain in this README and CLAUDE.md too.
4. **Résumé** — the contact line in `public/assets/resume.pdf` links to the
   domain; change it in the Overleaf source, export, copy the PDF over, and
   regenerate `resume.png` (see Notes).
5. **Link previews** — re-scrape the new URL in LinkedIn's Post Inspector; other
   apps refresh on their own.

### Retiring `siddharthranjan.me`

Nothing in the code references `.me` any more, so dropping it is DNS-only:
remove it (and `www.siddharthranjan.me`) from Vercel → Settings → Domains, then
let it lapse at its registrar. Anyone still using an old `.me` link will get an
error instead of the redirect from then on, so keep it until old links (résumé
copies already sent, LinkedIn posts) have aged out.

## Crowd chess (`/chess`)

One shared game of chess for every visitor. Each visitor gets **one move per game**;
when a game ends, a new one starts 60 seconds later.

**How it works**
- `chess.html` is a second Vite page (not prerendered, since it is live data);
  Vercel rewrites `/chess` to it.
- State lives in **Upstash Redis**. `api/chess/state` returns the shared game and is
  CDN-cached for 1s, so polling costs at most one database read a second however many
  people watch. `api/chess/move` validates with chess.js, then commits through one Lua
  script that atomically checks nobody moved first, this visitor hasn't moved, and their
  network is under its cap. Key layout is documented at the top of `api/_lib/redisStore.js`.
- A visitor is an anonymous `chess_sid` cookie (HttpOnly). Raw IPs are never stored —
  only a salted hash, to allow at most 3 moves per network per game and 20 attempts a minute.

**Setup (once)** — Vercel → project → Storage → Create → *Upstash for Redis* (free) →
connect it to this project with **Production** and **Preview** ticked, then redeploy.
Until then `/chess` shows "Crowd chess isn't connected to its database yet."
The database is in Mumbai, so `vercel.json` pins functions to `"regions": ["bom1"]`;
if the database ever moves, change the region with it (every move is several
function → database calls, and a cross-ocean hop costs ~150ms each).

**Reset a game** — set `CHESS_ADMIN_TOKEN` in Vercel's env vars, then
`curl -X POST -H "Authorization: Bearer <token>" https://siddharthranjan.app/api/chess/reset`.
Without the variable the endpoint doesn't exist (404).

**Locally** — `npm run dev` serves the API from the same handlers over an in-memory
store (no Redis needed); open http://localhost:5173/chess.html.

## Notes

- **Theme** — switch in the top bar; the choice is saved in `localStorage`.
- **Live motion** — a GET packet walks the request chain and returns along the
  rail; every 6th request (starting with the 3rd) is a cache miss that falls
  through to postgres. Click redis (or run `evict` in the shell) to force one.
  *Pause motion* freezes every animation on the page.
- **Shell** — click in and type. `help`, `whoami`, `trace`, `flow`, `cache`,
  `scale`, `failure`, `evict` (alias `miss`), `stack`, `projects`, `contact`,
  `clear`. Arrows walk history, Tab completes, a mistyped command suggests the
  closest match. Add commands in `src/shell/commands.js`.
- **Résumé** — `public/assets/resume.pdf` is the Overleaf export without the phone
  number; phones get `resume.png` instead of the embedded PDF.
- **Hop-03 pool** — labelled *Simulated pool*; click a healthy instance to fail its
  health checks and watch the pool drain, eject and scale out.
- **Contact form** — validates in place and opens the visitor's mail app; there
  is no backend.
- **Link previews** — Open Graph/Twitter tags live in `index.html` and the card is
  `public/assets/og.png`; regenerate it with `python3 scripts/og-image.py`.
- **Prerendering** — `npm run build` renders the app to HTML and the browser
  hydrates it, so crawlers and no-JS visitors see the content.
