const STACK = [
  ['Language', 'Java · Python · SQL'],
  ['Backend', 'Spring Boot · Spring Data JPA · Flask'],
  ['Messaging', 'Apache Kafka'],
  ['Data', 'Redis · MySQL'],
  ['AI · RAG', 'LangChain · FAISS · embeddings'],
  ['Models', 'Gemini API · Vertex AI · Claude'],
  ['Cloud', 'AWS · Azure']
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
        <h1>Backends<br />that scale.<br />AI that<br />answers.</h1>
        <p className="lede">
          I build the service layer — caches, queues and APIs that stay fast under load — and the
          AI features on top of it: retrieval over documents, a vector index, and model calls that
          get a cache in front and a timeout behind, like any other dependency.
        </p>
      </div>
      <dl className="spec" aria-label="Stack">
        {STACK.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
    </section>
  );
}
