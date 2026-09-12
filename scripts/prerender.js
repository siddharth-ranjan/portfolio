// Renders the app to HTML at build time and drops it into dist/index.html, so
// crawlers and no-JS visitors get the page's content. main.jsx hydrates it.
import { readFileSync, writeFileSync } from 'node:fs';
import { render } from '../dist-ssr/entry-server.js';

const file = 'dist/index.html';
const html = render();
const page = readFileSync(file, 'utf8');
const marker = '<div id="root"></div>';
if (!page.includes(marker)) throw new Error(`prerender: ${marker} not found in ${file}`);
writeFileSync(file, page.replace(marker, `<div id="root">${html}</div>`));
console.log(`prerendered ${(html.length / 1024).toFixed(1)} kB into ${file}`);
