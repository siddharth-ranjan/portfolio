# Portfolio — siddharthranjan.me

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

## Run

    npm install
    npm run dev        # http://localhost:5173
    npm run build      # → dist/ (client build + SSR build + prerender)
    npm run preview    # serve the built output

## Deploy

Push to `main`; Vercel builds with `npm run build` and serves `dist/`
(`vercel.json`). Domain: siddharthranjan.me.

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
