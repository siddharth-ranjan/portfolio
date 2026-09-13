import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, pickMatch, lookupArtwork, fillArtwork } from '../api/_lib/artwork.js';

// shaped like iTunes Search API results
const song = (trackName, artistName, collectionName, id = 'x') => ({
  wrapperType: 'track', kind: 'song', trackName, artistName, collectionName,
  artworkUrl100: `https://is1-ssl.mzstatic.com/image/thumb/Music/v4/${id}/cover.jpg/100x100bb.jpg`
});
const memCache = () => {
  const m = new Map();
  return { m, get: async (k) => m.get(k) ?? null, set: async (k, v) => { m.set(k, v); } };
};
const itunes = (byCountry) => {
  const calls = [];
  const fetchImpl = async (url) => {
    const u = new URL(url);
    calls.push({ country: u.searchParams.get('country'), term: u.searchParams.get('term') });
    const reply = byCountry[u.searchParams.get('country')];
    if (reply instanceof Error) throw reply;
    return new Response(JSON.stringify({ resultCount: (reply || []).length, results: reply || [] }), { status: 200 });
  };
  return { calls, fetchImpl };
};

test('normalize strips what video titles and soundtrack names add', () => {
  assert.equal(normalize('Baghon Mein Bahar Hai [4K] Video Song'), 'baghon mein bahar hai');
  assert.equal(normalize('Mamta (Original Motion Picture Soundtrack)'), 'mamta');
  assert.equal(normalize('Baghon Mein Bahar Hai (From "Aradhana")'), 'baghon mein bahar hai');
  assert.equal(normalize('Lata Mangeshkar & Mohd. Rafi'), 'lata mangeshkar and mohd rafi');
  assert.equal(normalize('SNAP'), 'snap');
});

test('a clean scrobble matches on title plus a shared artist name', () => {
  const m = pickMatch(
    [song('Baghon Mein Bahar Hai (From "Aradhana")', 'Lata Mangeshkar & Mohd. Rafi', 'Matinee Star Rajesh Khanna')],
    'Baghon Mein Bahar Hai', 'Lata Mangeshkar and Mohammed Rafi'
  );
  assert.ok(m);
  assert.equal(m.swapped, false);
});

test('a music video scrobbled with the fields swapped still matches (MAMTA by RAHEN NA RAHEN)', () => {
  const m = pickMatch(
    [song('Rahen Na Rahen', 'Lata Mangeshkar', 'Mamta (Original Motion Picture Soundtrack)')],
    'MAMTA', 'RAHEN NA RAHEN'
  );
  assert.ok(m);
  assert.equal(m.swapped, true);
});

test('video-title junk in a field does not stop the match (Aradhana by "Baghon Mein Bahar Hai [4K] Video Song")', () => {
  const m = pickMatch(
    [song('Baghon Mein Bahar Hai', 'Lata Mangeshkar & Mohd. Rafi', 'Aradhana (Original Motion Picture Soundtrack)')],
    'Aradhana', 'Baghon Mein Bahar Hai [4K] Video Song'
  );
  assert.ok(m);
  assert.equal(m.swapped, true);
});

test('the same title by someone else is not a match, and a later right result is', () => {
  assert.equal(pickMatch([song('Nights', 'Avicii', 'Nights - Single')], 'Nights', 'Frank Ocean'), null);
  const m = pickMatch(
    [song('Nights', 'Avicii', 'Nights - Single', 'wrong'), song('Nights', 'Frank Ocean', 'Blonde', 'right')],
    'Nights', 'Frank Ocean'
  );
  assert.match(m.result.artworkUrl100, /right/);
});

test('a found cover comes back at card sizes and is cached, so the song is looked up once', async () => {
  const cache = memCache();
  const { calls, fetchImpl } = itunes({ IN: [song('Snap', 'Vikki Leigh', 'Snap - Single', 'snap')] });
  const art = await lookupArtwork({ name: 'SNAP', artist: 'Vikki Leigh' }, { fetchImpl, cache });
  assert.equal(art.image, 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/snap/cover.jpg/600x600bb.jpg');
  assert.equal(art.thumb, 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/snap/cover.jpg/120x120bb.jpg');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].term, 'snap vikki leigh');

  const again = await lookupArtwork({ name: 'SNAP', artist: 'Vikki Leigh' }, { fetchImpl, cache });
  assert.deepEqual(again, art);
  assert.equal(calls.length, 1, 'served from the cache');
});

test('the US store is tried when India has no match', async () => {
  const { calls, fetchImpl } = itunes({ IN: [], US: [song('PERFECT BLUE', 'RYMAN LEON', 'PERFECT BLUE - Single')] });
  const art = await lookupArtwork({ name: 'PERFECT BLUE', artist: 'ryman leon' }, { fetchImpl, cache: memCache() });
  assert.ok(art);
  assert.deepEqual(calls.map((c) => c.country), ['IN', 'US']);
});

test('a song iTunes does not have is remembered as a miss', async () => {
  const cache = memCache();
  const { calls, fetchImpl } = itunes({ IN: [], US: [] });
  assert.equal(await lookupArtwork({ name: 'Unreleased Demo', artist: 'Nobody' }, { fetchImpl, cache }), null);
  assert.equal(await lookupArtwork({ name: 'Unreleased Demo', artist: 'Nobody' }, { fetchImpl, cache }), null);
  assert.equal(calls.length, 2, 'both stores once, then the cached miss');
});

test('when iTunes is unreachable nothing is cached, so the next request tries again', async () => {
  const cache = memCache();
  const { calls, fetchImpl } = itunes({ IN: new Error('timeout'), US: new Error('timeout') });
  assert.equal(await lookupArtwork({ name: 'SNAP', artist: 'Vikki Leigh' }, { fetchImpl, cache }), null);
  assert.equal(cache.m.size, 0);
  await lookupArtwork({ name: 'SNAP', artist: 'Vikki Leigh' }, { fetchImpl, cache });
  assert.equal(calls.length, 4);
});

test('covers fill only the tracks without one; garbled names are replaced, clean ones kept', async () => {
  const asked = [];
  const lookup = async (t) => {
    asked.push(t.name);
    if (t.name === 'MAMTA') return { image: 'https://i/m600.jpg', thumb: 'https://i/m120.jpg', name: 'Rahen Na Rahen', artist: 'Lata Mangeshkar', swapped: true };
    if (t.name === 'SNAP') return { image: 'https://i/s600.jpg', thumb: 'https://i/s120.jpg', name: 'Snap', artist: 'Vikki Leigh', swapped: false };
    throw new Error('boom');
  };
  const out = await fillArtwork({
    user: 'sid',
    nowPlaying: { name: 'MAMTA', artist: 'RAHEN NA RAHEN', image: null, thumb: null },
    recent: [
      { name: 'SNAP', artist: 'Vikki Leigh', image: null, thumb: null },
      { name: 'SNAP', artist: 'Vikki Leigh', image: null, thumb: null },
      { name: 'Pompeii', artist: 'Bastille', image: 'https://lastfm/p.jpg', thumb: 'https://lastfm/pt.jpg' },
      { name: 'Broken', artist: 'Lookup', image: null, thumb: null }
    ]
  }, lookup);

  assert.deepEqual(out.nowPlaying, { name: 'Rahen Na Rahen', artist: 'Lata Mangeshkar', image: 'https://i/m600.jpg', thumb: 'https://i/m120.jpg' });
  assert.deepEqual(out.recent[0], { name: 'SNAP', artist: 'Vikki Leigh', image: 'https://i/s600.jpg', thumb: 'https://i/s120.jpg' });
  assert.equal(out.recent[2].image, 'https://lastfm/p.jpg');
  assert.deepEqual(out.recent[3], { name: 'Broken', artist: 'Lookup', image: null, thumb: null });
  assert.deepEqual(asked.sort(), ['Broken', 'MAMTA', 'SNAP'], 'Pompeii not looked up; SNAP twice looked up once');
  assert.equal(out.user, 'sid');
});
