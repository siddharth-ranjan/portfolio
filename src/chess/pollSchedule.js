// How the crowd-chess page paces its checks for new moves. Each poll is a small request
// (and, once per second per edge region, one Redis read), so a tab nobody is using
// should cost nothing.
export const POLL_MS = 1000;               // someone is here: new moves show within about a second
export const SLOW_POLL_MS = 5000;          // quiet for a while
export const SLOW_AFTER_MS = 5 * 60_000;   // no input and no moves for this long → slow down
export const STOP_AFTER_MS = 10 * 60_000;  // no input for this long → stop until they're back
export const CHECK_MS = 5000;              // hidden or stopped: only re-check the rules, no request

// lastInput: the visitor's last click, key, scroll or tap. lastChange: that, or the last
// move seen. Moves by others keep a used page fast, but never keep an abandoned one polling.
export function nextPoll({ first, visible, lastInput, lastChange, now }) {
  if (first) return { poll: true, delay: POLL_MS, asleep: false }; // always load once
  if (!visible) return { poll: false, delay: CHECK_MS, asleep: false };
  if (now - lastInput > STOP_AFTER_MS) return { poll: false, delay: CHECK_MS, asleep: true };
  const quiet = now - Math.max(lastInput, lastChange) > SLOW_AFTER_MS;
  return { poll: true, delay: quiet ? SLOW_POLL_MS : POLL_MS, asleep: false };
}
