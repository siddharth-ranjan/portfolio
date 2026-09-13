import { useEffect, useRef, useState } from 'react';
import { nextRefreshMs, shouldRefresh } from './musicSchedule.js';

const TICK_MS = 15_000; // how often to decide whether a check is due (no request unless it is)

function ago(ms, now) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function Art({ src, size }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return <span className="music-art is-empty" style={{ width: size, height: size }} aria-hidden="true">♪</span>;
  }
  return (
    <img className="music-art" src={src} alt="" width={size} height={size} loading="lazy"
      referrerPolicy="no-referrer" onError={() => setBroken(true)} />
  );
}

function TrackLink({ track, className, children }) {
  if (!track.url) return <div className={className}>{children}</div>;
  return (
    <a className={className} href={track.url} target="_blank" rel="noopener noreferrer"
      title={`${track.name} — ${track.artist} on Last.fm`}>
      {children}
    </a>
  );
}

/**
 * What Siddharth is listening to: YouTube Music scrobbled to Last.fm, served by
 * /api/music/recent. Stays hidden until there is something to show (not configured,
 * Last.fm down, nothing played), and keeps the last good copy if a refresh fails.
 *
 * Checks are paced by musicSchedule.js: every minute while a song plays, every 5 minutes
 * after one recently, every 30 when quiet; never in a hidden tab or once the visitor has
 * left the page untouched for 10 minutes, and straight away when they come back.
 */
export default function NowPlaying() {
  const [data, setData] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const latest = useRef(null);         // last good answer, for pacing
  const lastFetch = useRef(0);
  const lastActivity = useRef(Date.now());
  const inFlight = useRef(false);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      lastFetch.current = Date.now();
      try {
        const r = await fetch('/api/music/recent', { headers: { accept: 'application/json' } });
        const body = await r.json().catch(() => null);
        if (alive && r.ok && body?.ok) {
          latest.current = body;
          setData(body);
        }
      } catch { /* keep what we have */ }
      inFlight.current = false;
      if (alive) setNow(Date.now());
    };

    const check = () => {
      const visible = document.visibilityState === 'visible';
      if (shouldRefresh({ visible, lastActivity: lastActivity.current, lastFetch: lastFetch.current, data: latest.current })) load();
      else if (visible) setNow(Date.now()); // keep "3m ago" honest without a request
    };

    // coming back after a pause: fetch now if the schedule says one is due
    const wake = () => {
      const wasIdle = Date.now() - lastActivity.current;
      lastActivity.current = Date.now();
      if (wasIdle > 60_000) check();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') { lastActivity.current = Date.now(); check(); } };

    load();
    const timer = setInterval(check, TICK_MS);
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, wake));
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!data || (!data.nowPlaying && !data.recent.length)) return null;
  const { nowPlaying, recent } = data;
  const last = recent[0];

  return (
    <section className="panel music" aria-label="What I'm listening to" data-next-check-ms={nextRefreshMs(data, now)}>
      <div className="panel-head">
        <span className="tag">On my headphones</span>
        {nowPlaying
          ? <span className="tag chess-live is-live">now playing</span>
          : last?.playedAt && <span className="tag">last played {ago(last.playedAt, now)}</span>}
      </div>

      {nowPlaying && (
        <TrackLink track={nowPlaying} className="music-now">
          <Art key={nowPlaying.image || 'none'} src={nowPlaying.image} size={64} />
          <span className="music-text">
            <strong>{nowPlaying.name}</strong>
            <span>{nowPlaying.artist}</span>
          </span>
          <span className="music-eq" aria-hidden="true"><i /><i /><i /></span>
        </TrackLink>
      )}

      {recent.length > 0 && (
        <ol className="music-recent" aria-label="Recently played">
          {recent.map((t, i) => (
            <li key={`${t.playedAt}-${i}`}>
              <TrackLink track={t} className="music-row">
                <Art key={t.thumb || 'none'} src={t.thumb} size={36} />
                <span className="music-text">
                  <strong>{t.name}</strong>
                  <span>{t.artist}</span>
                </span>
                {t.playedAt && <time dateTime={new Date(t.playedAt).toISOString()}>{ago(t.playedAt, now)}</time>}
              </TrackLink>
            </li>
          ))}
        </ol>
      )}

      <p className="music-foot">
        YouTube Music, scrobbled to <a href={data.profile} target="_blank" rel="noopener noreferrer">Last.fm</a>
      </p>
    </section>
  );
}
