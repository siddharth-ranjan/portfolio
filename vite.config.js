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
        const route = /^\/api\/chess\/(state|move|me|reset)(?:\?.*)?$/.exec(req.url || '');
        if (!route) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/chess/${route[1]}.js`);
          await mod.default(req, res);
        } catch (err) {
          next(err);
        }
      });
    }
  };
}

const page = (file) => fileURLToPath(new URL(file, import.meta.url));

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), chessApiInDev()],
  // two pages: the portfolio and /chess. The SSR build (prerender) has its own entry.
  build: isSsrBuild ? {} : { rollupOptions: { input: { main: page('./index.html'), chess: page('./chess.html') } } }
}));
