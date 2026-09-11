const CONSUMERS = [
  ['notifier', 'email, push, webhooks'],
  ['projector', 'builds the read model'],
  ['analytics', 'warehouse sink']
];

export default function Async() {
  return (
    <section className="wrap block">
      <div className="block-head">
        <h2>And what happens after the response</h2>
        <span className="tag">The caller never waits for this</span>
      </div>

      <div className="chain-scroll">
        <ol className="chain chain-async">
          <li className="hop">
            <span className="hop-n warn-t">05</span>
            <div className="box"><h3>service</h3><p>commits state, then the event</p></div>
          </li>
          <li className="edge edge-async edge-long" aria-hidden="true"><span>outbox relay</span></li>
          <li className="hop">
            <span className="hop-n warn-t">06</span>
            <div className="box is-amber"><h3>kafka</h3><p>partitioned by key · replayable</p></div>
          </li>
          <li className="edge edge-async edge-long edge-fan" aria-hidden="true"><span>fan-out</span></li>
          <li className="hop hop-group">
            <span className="hop-n">07 — independent consumers</span>
            <div className="group">
              {CONSUMERS.map(([name, desc]) => (
                <div className="box" key={name}><h3>{name}</h3><p>{desc}</p></div>
              ))}
            </div>
          </li>
        </ol>
      </div>

      <p className="note note-rule">
        <b className="warn-t">Note</b> — consumers are idempotent because at-least-once
        delivery means redelivery is normal. A poison message goes to a dead-letter topic so one bad payload
        cannot stall a partition.
      </p>
    </section>
  );
}
