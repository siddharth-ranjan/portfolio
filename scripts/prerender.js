// Renders both pages to HTML at build time and drops the markup into dist, so crawlers
// and no-JS visitors get content and the first paint isn't blank. main.jsx and
// chess/main.jsx hydrate it. /chess gets its static shell; the live game fills in after.
import { readFileSync, writeFileSync } from 'node:fs';
import { render, renderChess } from '../dist-ssr/entry-server.js';

const marker = '<div id="root"></div>';
for (const [file, renderPage] of [['dist/index.html', render], ['dist/chess.html', renderChess]]) {
  const html = renderPage();
  const page = readFileSync(file, 'utf8');
  if (!page.includes(marker)) throw new Error(`prerender: ${marker} not found in ${file}`);
  writeFileSync(file, page.replace(marker, `<div id="root">${html}</div>`));
  console.log(`prerendered ${(html.length / 1024).toFixed(1)} kB into ${file}`);
}
