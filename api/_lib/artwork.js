import { createHash } from 'node:crypto';

// Cover art for songs Last.fm has none for. Common with YouTube Music scrobbles: the song
// sits on a compilation album nobody uploaded a cover to, or it was a music video whose
// title the scrobbler split into the wrong fields ("MAMTA" by "RAHEN NA RAHEN").
// Looks the song up on the iTunes Search API (no key) and caches the answer in Redis,
// so each song is looked up once.
const SEARCH = 'https://itunes.apple.com/search';
const STORES = ['IN', 'US'];              // the Indian catalogue first (film songs), then US
const HIT_TTL = 60 * 60 * 24 * 30;        // found: keep 30 days
const MISS_TTL = 60 * 60 * 24 * 7;        // not found: look again in a week
const NONE = 'none';

// words video titles and soundtrack names wrap around the song itself
const JUNK = /\b(official|music|lyrical|lyrics?|full|audio|video|songs?|hd|4k|8k|remastered|remaster|visualizer|from|ost|soundtrack|original motion picture)\b/g;
const STOP = new Set(['and', 'the', 'with']);

export function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[[(【][^\])】]*[\])】]/g, ' ')  // [4K], (Official Video), (From "Aradhana")
    .replace(/\b(feat|ft)\b\.?\s.*$/, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(JUNK, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// the same text with only case, "&" and punctuation evened out — no words removed
const plain = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const sameTitle = (a, b) => Boolean(a && b) &&
  (a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a))));
const tokens = (s) => new Set(s.split(' ').filter((w) => w.length >= 3 && !STOP.has(w)));
const shares = (haystack, needle) => {
  const have = tokens(haystack);
  return [...tokens(needle)].some((t) => have.has(t));
};

// The first result whose title matches one Last.fm field while its artist or album
// shares a word with the other — in either order, since video scrobbles swap them.
export function pickMatch(results, name, artist) {
  const n = normalize(name);
  const a = normalize(artist);
  for (const r of results || []) {
    if (r.kind && r.kind !== 'song') continue;
    const title = normalize(r.trackName);
    const credits = `${normalize(r.artistName)} ${normalize(r.collectionName)}`;
    if (sameTitle(title, n) && a && shares(credits, a)) return { result: r, swapped: false };
    if (sameTitle(title, a) && n && shares(credits, n)) return { result: r, swapped: true };
  }
  return null;
}

const sized = (url, px) =>
  typeof url === 'string' && url.startsWith('https://') ? url.replace(/\/\d+x\d+bb\.(jpg|png)$/, `/${px}x${px}bb.jpg`) : null;

export async function lookupArtwork({ name, artist }, { fetchImpl = fetch, cache = null } = {}) {
  const n = normalize(name);
  const a = normalize(artist);
  if (!n && !a) return null;
  const key = `music:art:v1:${createHash('sha1').update(`${n}|${a}`).digest('hex')}`;

  const saved = cache ? await cache.get(key).catch(() => null) : null;
  if (saved === NONE) return null;
  if (saved) {
    try { return JSON.parse(saved); } catch { /* look it up again */ }
  }

  let found = null;
  let everyStoreAnswered = true;
  for (const country of STORES) {
    const url = new URL(SEARCH);
    url.search = new URLSearchParams({ term: `${n} ${a}`.trim(), entity: 'song', limit: '10', country }).toString();
    try {
      const r = await fetchImpl(url, { signal: AbortSignal.timeout(2500) });
      if (!r.ok) { everyStoreAnswered = false; continue; }
      const match = pickMatch((await r.json()).results, name, artist);
      if (match) {
        const { result, swapped } = match;
        found = {
          image: sized(result.artworkUrl100, 600),
          thumb: sized(result.artworkUrl100, 120),
          name: String(result.trackName || ''),
          artist: String(result.artistName || ''),
          swapped
        };
        break;
      }
    } catch {
      everyStoreAnswered = false; // timeout or network: try the next store, don't remember a miss
    }
  }

  // a miss is only remembered when iTunes actually answered everywhere
  if (cache && (found || everyStoreAnswered)) {
    await cache.set(key, found ? JSON.stringify(found) : NONE, found ? HIT_TTL : MISS_TTL).catch(() => {});
  }
  return found;
}

// Give every track without a cover one from `lookup`. The catalogue's title and artist
// replace Last.fm's only when those were garbled (swapped fields or video-title junk).
export async function fillArtwork(data, lookup) {
  const pending = new Map(); // the same song twice (playing now and just played) is looked up once
  const fill = async (track) => {
    if (!track || (track.image && track.thumb)) return track;
    const id = `${normalize(track.name)}|${normalize(track.artist)}`;
    if (!pending.has(id)) pending.set(id, Promise.resolve().then(() => lookup(track)).catch(() => null));
    const art = await pending.get(id);
    if (!art || (!art.image && !art.thumb)) return track;
    const garbled = art.swapped || normalize(track.name) !== plain(track.name) || normalize(track.artist) !== plain(track.artist);
    return {
      ...track,
      image: track.image || art.image,
      thumb: track.thumb || art.thumb,
      ...(garbled && art.name ? { name: art.name, artist: art.artist } : {})
    };
  };
  const [nowPlaying, ...recent] = await Promise.all([fill(data.nowPlaying), ...(data.recent || []).map(fill)]);
  return { ...data, nowPlaying, recent };
}
