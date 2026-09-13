import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRecent, fetchRecent } from '../api/_lib/lastfm.js';

// shaped like Last.fm's user.getrecenttracks JSON
const art = (id) => ['small', 'medium', 'large', 'extralarge']
  .map((size) => ({ size, '#text': `https://lastfm.freetls.fastly.net/i/u/${size}/${id}.jpg` }));
const track = (n, extra = {}) => ({
  artist: { mbid: '', '#text': `Artist ${n}` }, name: `Song ${n}`, album: { mbid: '', '#text': `Album ${n}` },
  url: `https://www.last.fm/music/Artist+${n}/_/Song+${n}`, image: art(`a${n}`), streamable: '0', mbid: '', ...extra
});
const played = (n, uts) => track(n, { date: { uts: String(uts), '#text': '14 Nov 2023, 22:13' } });
const T = 1_700_000_000;

test('the song playing now is split out and the last five plays follow, newest first', () => {
  const out = parseRecent({
    recenttracks: { track: [track(0, { '@attr': { nowplaying: 'true' } }), ...[1, 2, 3, 4, 5].map((n) => played(n, T - n * 300))] }
  });
  assert.equal(out.nowPlaying.name, 'Song 0');
  assert.equal(out.nowPlaying.artist, 'Artist 0');
  assert.equal(out.nowPlaying.image, 'https://lastfm.freetls.fastly.net/i/u/extralarge/a0.jpg');
  assert.equal(out.nowPlaying.playedAt, null);
  assert.deepEqual(out.recent.map((t) => t.name), ['Song 1', 'Song 2', 'Song 3', 'Song 4', 'Song 5']);
  assert.equal(out.recent[0].playedAt, (T - 300) * 1000);
  assert.equal(out.recent[0].thumb, 'https://lastfm.freetls.fastly.net/i/u/medium/a1.jpg');
  assert.equal(out.recent[0].url, 'https://www.last.fm/music/Artist+1/_/Song+1');
});

test('never more than five plays, and nothing playing is fine', () => {
  const out = parseRecent({ recenttracks: { track: [1, 2, 3, 4, 5, 6].map((n) => played(n, T - n)) } });
  assert.equal(out.nowPlaying, null);
  assert.equal(out.recent.length, 5);
});

test('a lone track can arrive as an object instead of a list', () => {
  const out = parseRecent({ recenttracks: { track: played(1, T) } });
  assert.equal(out.recent.length, 1);
  assert.equal(out.recent[0].name, 'Song 1');
});

test('the no-artwork placeholder and links that are not Last.fm pages are dropped', () => {
  const t = played(1, T);
  t.image = [{ size: 'extralarge', '#text': 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png' }];
  t.url = 'javascript:alert(1)';
  const [song] = parseRecent({ recenttracks: { track: [t] } }).recent;
  assert.equal(song.image, null);
  assert.equal(song.thumb, null);
  assert.equal(song.url, null);
});

test('an account with no plays gives an empty card', () => {
  assert.deepEqual(parseRecent({ recenttracks: { track: [] } }), { nowPlaying: null, recent: [] });
});

test('a Last.fm error (like an unknown user) is an upstream error', () => {
  assert.throws(() => parseRecent({ error: 6, message: 'User not found' }), /User not found/);
});

test('fetchRecent asks Last.fm for the configured user and five plays', async () => {
  let asked;
  const fetchImpl = async (url) => {
    asked = new URL(url);
    return new Response(JSON.stringify({ recenttracks: { track: [played(1, T)] } }), { status: 200 });
  };
  const out = await fetchRecent({ apiKey: 'k', user: 'sid r', fetchImpl });
  assert.equal(asked.origin + asked.pathname, 'https://ws.audioscrobbler.com/2.0/');
  assert.equal(asked.searchParams.get('method'), 'user.getrecenttracks');
  assert.equal(asked.searchParams.get('user'), 'sid r');
  assert.equal(asked.searchParams.get('limit'), '5');
  assert.equal(asked.searchParams.get('format'), 'json');
  assert.equal(out.profile, 'https://www.last.fm/user/sid%20r');
  assert.equal(out.recent.length, 1);
});
