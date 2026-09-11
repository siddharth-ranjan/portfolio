const ROWS = [
  ['var(--blue)', 'load balancer', 'public TLS → healthy instances', 'owns nothing — routing only'],
  ['var(--blue)', 'api gateway', 'auth, quota → internal routes', 'owns rate-limit counters'],
  ['var(--green)', 'service (×N)', 'REST in → cache, DB, outbox', 'owns its own schema'],
  ['var(--amber)', 'cache', 'read-through on every GET', 'owns nothing durable — TTL only'],
  ['var(--amber)', 'event log', 'outbox → partitioned topics', 'owns the ordering guarantee'],
  ['var(--rose)', 'database', 'primary writes, replica reads', 'owns the source of truth']
];

export default function Ownership() {
  return (
    <section id="services" className="wrap block">
      <div className="block-head">
        <h2>Who owns which hop</h2>
        <span className="tag">Database per service · no shared schema</span>
      </div>
      <ul className="owns">
        {ROWS.map(([c, name, mid, own]) => (
          <li key={name} style={{ '--c': c }}>
            <span className="o-name">{name}</span>
            <span className="o-mid">{mid}</span>
            <span className="o-own">{own}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
