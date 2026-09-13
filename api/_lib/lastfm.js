// Last.fm "recently played" for the music card on /chess. The scrobbles come from
// YouTube Music via Web Scrobbler (laptop) and Pano Scrobbler (Android).
const API = 'https://ws.audioscrobbler.com/2.0/';
const PLACEHOLDER = '2a96cbd8b46e442fc41c2b86b821562f'; // Last.fm's grey "no artwork" star

const safeUrl = (u, prefix = 'https://') => (typeof u === 'string' && u.startsWith(prefix) ? u : null);

function image(track, size) {
  const list = Array.isArray(track.image) ? track.image : [];
  const pick = list.find((i) => i.size === size) || list[list.length - 1];
  const url = safeUrl(pick?.['#text']);
  return url && !url.includes(PLACEHOLDER) ? url : null;
}

const shape = (t) => ({
  name: String(t.name || ''),
  artist: String(t.artist?.['#text'] ?? t.artist?.name ?? ''),
  album: String(t.album?.['#text'] || ''),
  url: safeUrl(t.url, 'https://www.last.fm/'),
  image: image(t, 'extralarge'),
  thumb: image(t, 'medium'),
  playedAt: t.date?.uts ? Number(t.date.uts) * 1000 : null
});

// user.getrecenttracks → { nowPlaying, recent[] }. With something playing Last.fm sends
// it first (flagged nowplaying, no date) on top of `limit` finished plays; a lone track
// can arrive as an object instead of a list.
export function parseRecent(json, limit = 5) {
  if (!json || json.error) throw Object.assign(new Error(json?.message || 'Last.fm error'), { status: 502 });
  const raw = json.recenttracks?.track;
  const tracks = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const playing = tracks.find((t) => t['@attr']?.nowplaying === 'true');
  return {
    nowPlaying: playing ? shape(playing) : null,
    recent: tracks.filter((t) => t !== playing && t.date).slice(0, limit).map(shape)
  };
}

export async function fetchRecent({ apiKey, user, base = API, fetchImpl = fetch, limit = 5 }) {
  const url = new URL(base);
  url.search = new URLSearchParams({
    method: 'user.getrecenttracks', user, api_key: apiKey, format: 'json', limit: String(limit)
  }).toString();
  const r = await fetchImpl(url, {
    headers: { 'user-agent': 'siddharthranjan.app portfolio' },
    signal: AbortSignal.timeout(4000)
  });
  const json = await r.json().catch(() => null);
  if (!r.ok && !json?.error) throw Object.assign(new Error(`Last.fm answered ${r.status}`), { status: 502 });
  return { user, profile: `https://www.last.fm/user/${encodeURIComponent(user)}`, ...parseRecent(json, limit) };
}
