import { Redis } from '@upstash/redis';
import { fetchRecent } from '../_lib/lastfm.js';
import { fillArtwork, lookupArtwork } from '../_lib/artwork.js';
import { redisEnv } from '../_lib/store.js';
import { send } from '../_lib/http.js';

// Where found covers are remembered: Upstash when connected, otherwise this instance's memory.
let artCache = null;
function getArtCache() {
  if (artCache) return artCache;
  const env = redisEnv();
  if (env) {
    const redis = new Redis({ ...env, automaticDeserialization: false });
    artCache = { get: (k) => redis.get(k), set: (k, v, ttl) => redis.set(k, v, { ex: ttl }) };
  } else {
    const mem = new Map();
    artCache = {
      async get(k) { const e = mem.get(k); return e && e.until > Date.now() ? e.value : null; },
      async set(k, value, ttl) { mem.set(k, { value, until: Date.now() + ttl * 1000 }); }
    };
  }
  return artCache;
}

// GET — what's playing and the last five songs, from Last.fm, with covers from iTunes
// where Last.fm has none. The CDN keeps it 30s so visitors never reach either service.
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { ok: false, error: 'method' }, { Allow: 'GET, HEAD' });
  // trimmed: a value pasted into Vercel with a stray space or newline is a different user
  const apiKey = (process.env.LASTFM_API_KEY || '').trim();
  const user = (process.env.LASTFM_USER || '').trim();
  if (!apiKey || !user) {
    return send(res, 503, { ok: false, error: 'not-configured' }, { 'Cache-Control': 'public, max-age=0, s-maxage=60' });
  }
  const started = performance.now();
  try {
    // LASTFM_API_BASE only exists to point local testing at a fixture server
    const data = await fetchRecent({ apiKey, user, base: process.env.LASTFM_API_BASE || undefined });
    const lastfmMs = performance.now() - started;
    const cache = getArtCache();
    const filled = await fillArtwork(data, (track) => lookupArtwork(track, { cache }));
    // while a song plays the next one matters within a minute; otherwise one CDN copy
    // serves everyone for two minutes, so a quiet card barely reaches Last.fm
    const cacheFor = filled.nowPlaying ? 30 : 120;
    return send(res, 200, { ok: true, ...filled }, {
      'Cache-Control': `public, max-age=0, s-maxage=${cacheFor}, stale-while-revalidate=600`,
      'Server-Timing': `lastfm;dur=${Math.round(lastfmMs)}, artwork;dur=${Math.round(performance.now() - started - lastfmMs)}`
    });
  } catch (err) {
    console.error('music/recent', err.message);
    return send(res, 502, { ok: false, error: 'upstream' }, { 'Cache-Control': 'public, max-age=0, s-maxage=15' });
  }
}
