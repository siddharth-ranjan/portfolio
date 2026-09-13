// The redis "click to evict" demo, one eviction at a time. Kept apart from useFlow so the
// rules can be tested without a browser.
//
//   idle → armed        tap: the next request will miss
//   armed → missing     that request starts (a forced miss)
//   missing → settling  it's served
//   settling → idle     the next request, a guaranteed hit, is served: show the hint again
//
// Taps outside idle are ignored, so a double tap can't queue a second miss. The demo's own
// misses come every six requests counted from the last miss of any kind (first at request 3),
// so one is never scheduled mid-eviction or right after it: an eviction reads as one miss,
// then hits.
const FIRST_SCHEDULED = 3;
const EVERY = 6;

export function createEvictMachine() {
  let phase = 'idle';
  let nextScheduled = FIRST_SCHEDULED;
  return {
    get phase() { return phase; },

    // 'ok' when it takes effect; 'pending' (already armed) or 'busy' (still playing out) when ignored
    tap() {
      if (phase === 'armed') return 'pending';
      if (phase !== 'idle') return 'busy';
      phase = 'armed';
      return 'ok';
    },

    // request n is starting: does it miss?
    start(n) {
      const forced = phase === 'armed';
      if (forced) phase = 'missing';
      const miss = forced || (phase === 'idle' && n >= nextScheduled);
      if (miss) nextScheduled = n + EVERY;
      return { forced, miss };
    },

    // request served; true when this closes an eviction (the hint can come back)
    finish(miss) {
      if (phase === 'missing') { phase = 'settling'; return false; }
      if (phase === 'settling' && !miss) { phase = 'idle'; return true; }
      return false;
    }
  };
}
