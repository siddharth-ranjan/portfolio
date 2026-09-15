// How I approach LLM features, then the work that backs it up. Every card is real
// (see TrackRecord and the résumé); nothing here is illustrative.
const PRACTICE = [
  ['var(--violet)', 'retrieval', 'question → embeddings → vector search', 'answers built from what was retrieved'],
  ['var(--amber)', 'semantic cache', 'repeat questions end in Redis', 'the model is the slowest hop — call it last'],
  ['var(--blue)', 'model calls', 'timeout · retry · fallback model', 'an LLM is one more flaky dependency']
];

const PROOF = [
  {
    badge: 'shipped', label: 'shipped', title: 'ChatPDF', href: 'https://chatpdf.siddharthranjan.app',
    text: 'Question answering over several PDFs at once: LangChain chunks and embeds them into FAISS, and Gemini answers from what gets retrieved.'
  },
  {
    badge: 'build', label: 'building', title: 'vigil',
    text: 'Incident intelligence: an alert firehose correlated into incidents, with remediation a human approves.'
  },
  {
    badge: 'certified', label: 'certified', title: 'Claude · Azure AI',
    text: 'Claude Certified Developer – Foundations (Anthropic) and Microsoft Azure AI Fundamentals (AI-901).'
  }
];

export default function AiWork() {
  return (
    <section id="ai" className="wrap block">
      <div className="block-head">
        <h2>AI, built like a backend</h2>
        <span className="tag">Retrieval · caching · failure handling</span>
      </div>
      <p className="block-sub">
        An LLM feature is a request path with one slow, costly, sometimes-wrong hop. Everything
        around that hop is backend work: what to retrieve, what to cache, and what happens when
        the model times out.
      </p>
      <ul className="owns">
        {PRACTICE.map(([c, name, mid, own]) => (
          <li key={name} style={{ '--c': c }}>
            <span className="o-name">{name}</span>
            <span className="o-mid">{mid}</span>
            <span className="o-own">{own}</span>
          </li>
        ))}
      </ul>
      <div className="ai-proof">
        {PROOF.map((p) => (
          <article className="panel ai-card" key={p.title}>
            <div className="panel-head">
              <span className={`badge badge-${p.badge}`}>{p.label}</span>
              {p.href && <a className="r-name" href={p.href} target="_blank" rel="noopener">live</a>}
            </div>
            <h3>{p.title}</h3>
            <p>{p.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
