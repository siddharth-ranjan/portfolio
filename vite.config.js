import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev only: serve /api/chess/* from the same handlers Vercel runs. Without Upstash
// credentials in the environment they use an in-memory store.
function chessApiInDev() {
  return {
    name: 'chess-api-dev',
    apply: 'serve',
    configureServer(server) {
      if (!process.env.UPSTASH_REDIS_REST_URL && !process.env.KV_REST_API_URL) {
        process.env.CHESS_MEMORY_STORE = '1';
      }
      server.middlewares.use(async (req, res, next) => {
        const route = /^\/api\/(chess\/(?:state|version|move|react|me|reset)|music\/recent)(?:\?.*)?$/.exec(req.url || '');
        if (!route) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${route[1]}.js`);
          await mod.default(req, res);
        } catch (err) {
          next(err);
        }
      });
    }
  };
}

const page = (file) => fileURLToPath(new URL(file, import.meta.url));

// Put each page's SVG favicon into its HTML as a data URI, so the tab icon appears with the
// page instead of after a separate request (which Vercel serves with max-age=0). The files
// in public/ stay the source of truth; the PNG and apple-touch fallbacks remain links.
function inlineSvgFavicon() {
  return {
    name: 'inline-svg-favicon',
    transformIndexHtml(html) {
      return html.replace(/<link rel="icon" href="(\/[^"]+\.svg)" type="image\/svg\+xml">/, (tag, href) => {
        const svg = readFileSync(page(`./public${href}`), 'utf8')
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/\s+/g, ' ')
          .replace(/> </g, '><')
          .trim()
          .replace(/"/g, "'")
          .replace(/#/g, '%23')
          .replace(/</g, '%3C')
          .replace(/>/g, '%3E');
        return `<link rel="icon" href="data:image/svg+xml,${svg}" type="image/svg+xml">`;
      });
    }
  };
}

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), chessApiInDev(), inlineSvgFavicon()],
  // two pages: the portfolio and /chess. The SSR build (prerender) has its own entry.
  build: isSsrBuild ? {} : { rollupOptions: { input: { main: page('./index.html'), chess: page('./chess.html') } } }
}));
