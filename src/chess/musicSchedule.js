// How often the music card asks for news. Nothing polls on a timer server-side; these
// are the only requests, and they only happen while someone has the page open, visible
// and recently used.
export const PLAYING_MS = 60_000;          // a song is on: check for the next one every minute
export const RECENT_MS = 5 * 60_000;       // nothing on, but something played within the hour
export const QUIET_MS = 30 * 60_000;       // nothing played for over an hour
export const RECENT_WINDOW_MS = 60 * 60_000;
export const IDLE_AFTER_MS = 10 * 60_000;  // visitor hasn't touched the page: stop until they do

export function nextRefreshMs(data, now = Date.now()) {
  if (!data) return RECENT_MS; // not configured or Last.fm down: don't hammer it
  if (data.nowPlaying) return PLAYING_MS;
  const last = data.recent?.[0]?.playedAt;
  return last && now - last < RECENT_WINDOW_MS ? RECENT_MS : QUIET_MS;
}

// should a check run now?
export function shouldRefresh({ visible, lastActivity, lastFetch, data, now = Date.now() }) {
  if (!visible) return false;
  if (now - lastActivity > IDLE_AFTER_MS) return false;
  return now - lastFetch >= nextRefreshMs(data, now);
}
