import { useEffect, useState } from 'react';

const TO = 'siddharthranjan0909@gmail.com';

// each route gets its own subject line and its own prompt for the message
const ROUTES = {
  '/roles': {
    subject: 'Backend or AI role',
    hint: 'the role, team and stack',
    label: 'backend or AI role',
    placeholder: "We're hiring an engineer to build retrieval and LLM features on our Java platform (Spring Boot, Kafka, Python). Here's the role and what the interview loop looks like…"
  },
  '/contract': {
    subject: 'Contract work',
    hint: 'scope, timeline and budget',
    label: 'contract work',
    placeholder: "We're moving order events from a nightly cron job to Kafka and need someone who has shipped a transactional outbox. Roughly 6 weeks, starting…"
  },
  '/collab': {
    subject: 'Collaboration',
    hint: 'what we would build together',
    label: 'build something',
    placeholder: "I'm building an open-source rate limiter on Redis and want a second pair of eyes on the sliding-window logic…"
  },
  '/hello': {
    subject: 'Hello',
    hint: 'anything at all',
    label: 'just saying hi',
    placeholder: 'Evicted your Redis key and watched the request fall through to Postgres. Neat. Just saying hi.'
  }
};

const Value = ({ value, hint }) => (
  value
    ? <span className="s">{JSON.stringify(value)}</span>
    : <span className="ph">{hint}</span>
);

export default function Contact() {
  const [from, setFrom] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [route, setRoute] = useState('/roles');
  const [payload, setPayload] = useState('');
  const [invalid, setInvalid] = useState({});
  const [status, setStatus] = useState({ cls: '', node: 'Opens your mail app with this filled in.' });
  const [idemKey, setIdemKey] = useState('········');
  useEffect(() => {
    setIdemKey((window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)).slice(0, 8));
  }, []);

  const clear = (name) => setInvalid((p) => (p[name] ? { ...p, [name]: false } : p));

  const onSubmit = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const errors = [];
    const bad = {};
    if (!from.trim()) { bad.from = true; errors.push(['from', '"from" is required']); }
    if (!replyTo.trim() || !form.elements.reply_to.checkValidity()) {
      bad.reply_to = true; errors.push(['reply_to', '"reply_to" must be an email address']);
    }
    if (payload.trim().length < 10) { bad.payload = true; errors.push(['payload', '"payload" needs a few words']); }
    setInvalid(bad);
    if (errors.length) {
      setStatus({ cls: 'err', node: `400 Bad Request — ${errors[0][1]}` });
      form.elements[errors[0][0]].focus();
      return;
    }
    const subject = `${ROUTES[route].subject} — ${from.trim()}`;
    const body = `${payload.trim()}\n\n— ${from.trim()}\n${replyTo.trim()}`;
    window.location.href = `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setStatus({
      cls: 'ok',
      node: <>202 Accepted — opening your mail app. Nothing opened? Write to <a href={`mailto:${TO}`}>{TO}</a></>
    });
  };

  return (
    <section id="contact" className="wrap block">
      <div className="block-head">
        <h2>Send a request</h2>
        <span className="tag">POST /v1/messages · async · reply by email</span>
      </div>
      <div className="contact-grid">
        <form className="req-form" id="req-form" noValidate onSubmit={onSubmit}>
          <label className="field">
            <span className="field-k">from <em>name · company</em></span>
            <input
              name="from" required autoComplete="name" value={from}
              aria-invalid={invalid.from || undefined}
              placeholder="Ada Lovelace · Analytical Engines Ltd"
              onChange={(e) => { setFrom(e.target.value); clear('from'); }}
            />
          </label>
          <label className="field">
            <span className="field-k">reply_to <em>where I answer</em></span>
            <input
              name="reply_to" type="email" required autoComplete="email" value={replyTo}
              aria-invalid={invalid.reply_to || undefined}
              placeholder="ada@engines.io"
              onChange={(e) => { setReplyTo(e.target.value); clear('reply_to'); }}
            />
          </label>
          <fieldset className="field">
            <legend className="field-k">route <em>what it&apos;s about</em></legend>
            <div className="routes">
              {Object.entries(ROUTES).map(([value, r]) => (
                <label className="route" key={value}>
                  <input
                    type="radio" name="route" value={value}
                    checked={route === value}
                    onChange={() => setRoute(value)}
                  />
                  <span>{value} <small>{r.label}</small></span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="field">
            <span className="field-k">payload <em>the message</em></span>
            <textarea
              name="payload" required rows={6} value={payload}
              aria-invalid={invalid.payload || undefined}
              placeholder={ROUTES[route].placeholder}
              onChange={(e) => { setPayload(e.target.value); clear('payload'); }}
            />
          </label>
          <div className="req-actions">
            <button className="btn btn-solid" type="submit">Send request →</button>
            <span className={`req-status${status.cls ? ` ${status.cls}` : ''}`} id="req-status" role="status" aria-live="polite">
              {status.node}
            </span>
          </div>
        </form>
        <div className="req-side" aria-hidden="true">
          <span className="tag">Live request preview</span>
          <pre className="req-preview" id="req-preview">
            <span className="m">POST</span>{' /v1/messages HTTP/1.1\n'}
            <span className="k">To:</span>{` ${TO}\n`}
            <span className="k">Content-Type:</span>{' application/json\n'}
            <span className="k">Idempotency-Key:</span>{` ${idemKey}\n\n{\n  `}
            <span className="k">&quot;from&quot;</span>{': '}<Value value={from.trim()} hint="your name" />{',\n  '}
            <span className="k">&quot;reply_to&quot;</span>{': '}<Value value={replyTo.trim()} hint="you@company.com" />{',\n  '}
            <span className="k">&quot;route&quot;</span>{': '}<span className="s">&quot;{route}&quot;</span>{',\n  '}
            <span className="k">&quot;payload&quot;</span>{': '}<Value value={payload.trim()} hint={ROUTES[route].hint} />{'\n}'}
          </pre>
        </div>
      </div>
    </section>
  );
}
