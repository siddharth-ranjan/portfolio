const ROWS = [
  { badge: 'active', label: 'active', name: 'TCS', href: 'https://www.tcs.com',
    desc: 'System Engineer C1 — Prime · Spring Boot, EC2, Redis caching, Kafka ingest', when: 'Jan 2026 →' },
  { badge: 'resolved', label: 'resolved', name: 'Nokia', href: 'https://www.nokia.com',
    desc: 'R&D Intern, FN BBN CU-Hardening · test-data aggregation tooling, −30% reporting effort', when: 'Aug 24 – May 25' },
  { badge: 'active', label: 'build', name: 'vigil',
    desc: 'Incident intelligence — alert firehose to correlated incidents, human-approved remediation', when: 'Sept 2026 →' },
  { badge: 'shipped', label: 'shipped', name: 'multi-pdf-chat', href: 'https://github.com/siddharth-ranjan/multi-pdf-chat',
    desc: 'GenAI document QA over LangChain + FAISS, Google Generative AI', when: 'Feb 2024' },
  { badge: 'shipped', label: 'shipped', name: 'movie-reservation', href: 'https://github.com/siddharth-ranjan/movie-reservation-system',
    desc: 'Spring Modulith backend, JWT auth, role-based access control', when: '2025' },
  { badge: 'published', label: 'published', name: 'IEEE', href: 'https://ieeexplore.ieee.org/document/10675697',
    desc: 'Performance assessment of recommendation algorithms — SVD, SVD++, k-NN on MovieLens', when: '2024' }
];

export default function TrackRecord() {
  return (
    <section id="record" className="wrap block">
      <div className="block-head"><h2>Track record</h2></div>
      <ul className="record">
        {ROWS.map((r) => (
          <li key={r.name}>
            <span className={`badge badge-${r.badge}`}>{r.label}</span>
            {r.href
              ? <a className="r-name" href={r.href} target="_blank" rel="noopener">{r.name}</a>
              : <span className="r-name">{r.name}</span>}
            <span className="r-desc">{r.desc}</span>
            <span className="r-when">{r.when}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
