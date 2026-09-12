const STACK = [
  ['Language', 'Java · Python · SQL'],
  ['Framework', 'Spring Boot · Spring Data JPA'],
  ['Messaging', 'Apache Kafka'],
  ['Cache', 'Redis'],
  ['Store', 'MySQL'],
  ['Cloud', 'AWS · Azure'],
  ['AI', 'LangChain · FAISS · Gemini API']
];

export default function Hero({ nameRef }) {
  return (
    <section className="hero wrap">
      <div className="hero-copy">
        <p className="hero-id">
          <span className="hero-name" ref={nameRef}>Siddharth Ranjan</span>
          <span className="hero-role">
            <i className="live-dot" aria-hidden="true" />Backend engineer · India · open to roles
          </span>
        </p>
        <h1>Most reads<br />should never<br />reach the<br />database.</h1>
        <p className="lede">
          Getting there is the work: a cache that absorbs the reads, stateless services
          behind a load balancer, and an event log that lets the slow parts happen later. Java,
          Spring Boot, Kafka, Redis, MySQL.
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
