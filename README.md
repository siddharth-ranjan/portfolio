# Portfolio — Siddharth Ranjan

Static site built from `Portfolio Concepts-selection.png`. No build step, no dependencies.

    index.html    markup and all copy
    styles.css    design tokens, layout, dark/light themes
    script.js     theme toggle, live request flow, load drift, scroll reveal, shell
    serve.py      no-cache local dev server
    favicon.svg   site icon (a read that stops above the database); PNG copies in assets/

## Run

    python3 serve.py              # then open http://localhost:8000

`serve.py` is `http.server` with `Cache-Control: no-store`, so a plain refresh always shows
your latest edits. (With plain `python3 -m http.server`, browsers cache the files and keep
showing stale styles.)

Deploys as-is to GitHub Pages, Netlify, Vercel or any static host.

## Notes

- **Theme** — dark by default; the toggle writes to `localStorage`.
- **Live motion** — a GET packet walks the request chain and returns along the rail; every
  6th request (starting with the 3rd) is a cache miss that falls through to postgres. The async chain and pool loads
  also move. It plays even when the OS asks for reduced motion (it is the section's content);
  the *Pause motion* button freezes all of it.
- **Forcing a cache miss** — click (or Enter on) the redis box, or run `evict` / `miss` in the
  shell. The key shows as evicted and the next request falls through to postgres.
- **Shell** — click into it and type. Commands: `help`, `whoami`, `trace`, `flow`,
  `cache`, `scale`, `failure`, `evict` (alias `miss`), `stack`, `projects`, `contact`, `clear`.
  Arrow keys walk history, Tab completes. Add commands in the `COMMANDS` map in `script.js`.
- **Colors** are CSS custom properties on `:root` / `[data-theme="light"]` in `styles.css`.
- **Contact form** (`#contact`) — styled as a `POST /v1/messages` request with a live preview.
  It validates in place (`400 Bad Request` messages) and on submit opens the visitor's mail app
  with subject and body filled in; there is no backend. To send from the page instead, point the
  form at a service like Formspree.
- **Résumé preview** (`#resume`) — closed by default; *Preview résumé* opens it and the same button
  closes it (the PDF only loads on first open). `assets/resume.pdf` is the latest résumé with the
  phone number redacted out. Phones get `assets/resume.png` instead of the embedded PDF. To update:
  replace the PDF, then `pdftoppm -r 150 -png -singlefile assets/resume.pdf assets/resume`.
  The same PDF lives in the `siddharth-ranjan/resume` repo as `siddharth-ranjan-resume.pdf`.
- **Links** — footer has GitHub, LinkedIn, LeetCode buttons; the shell's `contact` lists them too.
  The site itself is meant to be published at siddharthranjan.me, so it doesn't link to itself.
