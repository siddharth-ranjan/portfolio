# Portfolio — siddharthranjan.me

Static site: plain HTML/CSS/JS, no build step, no backend. Deployed on Vercel from
`siddharth-ranjan/portfolio` (`main` = production). Custom domain: siddharthranjan.me (+ www).

## Files
    index.html    all markup and copy
    styles.css    tokens, layout, dark/light themes, responsive rules
    script.js     one IIFE: theme, brand reveal, scroll reveal, pool drift,
                  live request flow, résumé toggle, contact form, scrollspy, shell
    favicon.svg   site icon (a read stopping above a database) + PNGs in assets/
    assets/       resume.pdf (+ resume.png page image), icons
    serve.py      local dev server with Cache-Control: no-store
    vercel.json   framework:null, no install/build, serve repo root; /resume and /image redirects
    .vercelignore README.md, CLAUDE.md, serve.py — in the repo, not on the domain

## Run / deploy
    python3 serve.py     # http://localhost:8000
Push to `main` → Vercel production build (~20s). Edit in a clone of the repo, not a loose folder.

## Conventions
- Bump `?v=N` on styles.css/script.js in index.html with every CSS/JS change (browsers cache hard).
- Sections: hero · flow · hop-03 panel · async · ownership · shell · record · résumé · contact.
- Chain geometry: hop number is a fixed 16px + 8px gap, so connectors sit at `50% + 12px`
  (desktop). Below 1100px both chains switch to a vertical layout — motion switches axis in JS
  (`vertical()`), and the load-balancer fan uses the separate `.lanes-v` SVG.
- Motion plays even under prefers-reduced-motion (it is the content); "Pause motion" freezes
  everything via `.motion-paused`. Scroll-reveal stays off under reduced motion.
- Shell commands live in the `COMMANDS` map. Unknown input gets prefix/edit-distance suggestions.
- Résumé: `assets/resume.pdf` is the latest CV with the phone number redacted out; regenerate the
  image with `pdftoppm -r 150 -png -singlefile assets/resume.pdf assets/resume`. The same PDF is
  mirrored in the `siddharth-ranjan/resume` repo.

## What is real vs illustrative
Real: track record, résumé, links, contact form (opens the visitor's mail app; no backend).
Illustrative: request latencies, cache hit/miss counter, instance pool numbers and drift,
least-connections lane picks, shell output. It is a scripted demo, not live telemetry.

## Open ideas (not done)
- Label the hop-03 pool as simulated, or make instances clickable to fail a health check.
- Track record vs résumé mismatch: résumé lists Blogging Platform Backend + certifications.
- Résumé contact line sits ~41pt right of centre after redaction; a LaTeX rebuild would centre it.
- Diagram says "postgres" while the stack row says MySQL.
