// Two tracks, equal billing: what I build on the backend and what I build with models.
const TRACKS = [
  { name: 'Backend', c: 'var(--blue)', items: ['Java', 'Spring Boot', 'Kafka', 'Redis', 'MySQL', 'REST APIs', 'AWS'] },
  { name: 'AI', c: 'var(--violet)', items: ['Python', 'LangChain', 'FAISS', 'RAG', 'Gemini API', 'Vertex AI', 'Claude'] }
];

export default function Hero({ nameRef }) {
  return (
    <section className="hero wrap">
      <div className="hero-copy">
        <p className="hero-id">
          <span className="hero-name" ref={nameRef}>Siddharth Ranjan</span>
          <span className="hero-role">
            <i className="live-dot" aria-hidden="true" />Backend &amp; AI engineer · India · open to roles
          </span>
        </p>
        <h1>Backends<br />that scale.<br /><span className="ai-word">AI</span> that<br />answers.</h1>
        <p className="lede">
          I build the service layer — caches, queues and APIs that stay fast under load — and the
          AI features on top of it: retrieval over documents, a vector index, and model calls that
          get a cache in front and a timeout behind, like any other dependency.
        </p>
      </div>
      <div className="tracks" aria-label="Stack">
        {TRACKS.map((t) => (
          <div className="track" key={t.name} style={{ '--c': t.c }}>
            <span className="track-head"><i aria-hidden="true" />{t.name}</span>
            <ul>
              {t.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
