# Portfolio — siddharthranjan.me

React + Vite app, no backend. Deployed on Vercel from `siddharth-ranjan/portfolio`
(`main` = production). Custom domain: siddharthranjan.me (+ www).

## Layout
    src/main.jsx        entry, imports styles.css
    src/App.jsx         composition, brand reveal, scrollspy, FlowContext (evict bridge)
    src/styles.css      the whole design system — tokens, layout, themes, responsive
    src/components/     one per section (Flow and Shell are the involved ones)
    src/hooks/          useTheme useReveal useFlow useScrollSpy
    src/shell/commands.js  command map, Damerau–Levenshtein suggestions
    public/             favicon.svg + assets/ (resume.pdf, resume.png, icons) → served at /

## Run / deploy
    npm install && npm run dev     # dev
    npm run build && npm run preview
Push to `main` → Vercel production build. `vercel.json` pins framework vite,
`npm run build`, output `dist`, and keeps the /resume and /image redirects.

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

## What is real vs illustrative
Real: track record, résumé, links, contact form (opens the visitor's mail app).
Illustrative and labelled as such: the hop-03 pool ("Simulated pool"), latencies,
cache hit/miss counter, lane picks, shell output. A scripted demo, not telemetry.
The pool is interactive: clicking a healthy instance drains it, ejects it after two
failed checks, then boots a replacement that warms up before taking traffic.

## Résumé
`public/assets/resume.pdf` is built from the Overleaf source PDF by deleting the
phone number's glyphs from the content stream and moving the contact line so the
rest stays centred (links shift with it). Source lives in Overleaf; if it is
recompiled, redo that step or drop the phone in the .tex first. Regenerate the
phone fallback with `pdftoppm -r 150 -png -singlefile public/assets/resume.pdf public/assets/resume`.

## Open ideas (not done)
- The page is client-rendered, so link previews (LinkedIn, WhatsApp, Slack) may be
  blank. Prerendering would fix it.
- Certifications row has no date (`—`) — the résumé does not give one.
