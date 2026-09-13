import { useEffect, useState } from 'react';

const REFRESH_MS = 60_000;

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
 */
export default function NowPlaying() {
  const [data, setData] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch('/api/music/recent', { headers: { accept: 'application/json' } });
        const body = await r.json().catch(() => null);
        if (alive && r.ok && body?.ok) setData(body);
      } catch { /* keep what we have */ }
      if (alive) setNow(Date.now());
    };
    load();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!data || (!data.nowPlaying && !data.recent.length)) return null;
  const { nowPlaying, recent } = data;
  const latest = recent[0];

  return (
    <section className="panel music" aria-label="What I'm listening to">
      <div className="panel-head">
        <span className="tag">On my headphones</span>
        {nowPlaying
          ? <span className="tag chess-live is-live">now playing</span>
          : latest?.playedAt && <span className="tag">last played {ago(latest.playedAt, now)}</span>}
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
