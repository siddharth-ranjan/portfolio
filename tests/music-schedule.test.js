import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nextRefreshMs, shouldRefresh, PLAYING_MS, RECENT_MS, QUIET_MS, IDLE_AFTER_MS
} from '../src/chess/musicSchedule.js';

const NOW = 1_800_000_000_000;
const MIN = 60_000;
const playing = { nowPlaying: { name: 'Snap' }, recent: [{ playedAt: NOW - 3 * MIN }] };
const justStopped = { nowPlaying: null, recent: [{ playedAt: NOW - 20 * MIN }] };
const quiet = { nowPlaying: null, recent: [{ playedAt: NOW - 5 * 60 * MIN }] };

test('checks every minute while a song plays, less often once it stops, rarely when quiet', () => {
  assert.equal(nextRefreshMs(playing, NOW), PLAYING_MS);
  assert.equal(nextRefreshMs(justStopped, NOW), RECENT_MS);
  assert.equal(nextRefreshMs(quiet, NOW), QUIET_MS);
  assert.equal(nextRefreshMs({ nowPlaying: null, recent: [] }, NOW), QUIET_MS);
  assert.equal(nextRefreshMs(null, NOW), RECENT_MS, 'no answer yet (or Last.fm down): wait, do not hammer');
});

test('no request in a hidden tab, however long it has been', () => {
  assert.equal(shouldRefresh({ visible: false, lastActivity: NOW, lastFetch: 0, data: playing, now: NOW }), false);
});

test('no request once the visitor has left the page untouched', () => {
  const base = { visible: true, lastFetch: NOW - 2 * QUIET_MS, data: playing, now: NOW };
  assert.equal(shouldRefresh({ ...base, lastActivity: NOW - IDLE_AFTER_MS - 1 }), false);
  assert.equal(shouldRefresh({ ...base, lastActivity: NOW - 1000 }), true);
});

test('a request only when the schedule says one is due', () => {
  const visible = { visible: true, lastActivity: NOW, now: NOW };
  assert.equal(shouldRefresh({ ...visible, data: playing, lastFetch: NOW - 30_000 }), false);
  assert.equal(shouldRefresh({ ...visible, data: playing, lastFetch: NOW - PLAYING_MS }), true);
  assert.equal(shouldRefresh({ ...visible, data: quiet, lastFetch: NOW - 10 * MIN }), false);
  assert.equal(shouldRefresh({ ...visible, data: quiet, lastFetch: NOW - QUIET_MS }), true);
});
