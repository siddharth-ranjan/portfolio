import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildCommands, suggest } from '../shell/commands.js';
import { useEvict } from '../flowContext.js';

const KEYS = ['flow', 'cache', 'evict', 'scale', 'failure', 'whoami'];
const CLASS = { dim: 'dim', ok: 'ok-t', warn: 'warn-t' };

const INTRO = [
  { node: <>sr-shell 1.0 — type <code>help</code> for commands</>, cls: 'dim' },
  { echo: 'whoami' },
  { cls: 'ok', text: 'siddharth-ranjan · backend engineer · Java / Spring Boot' },
  { cls: 'dim', text: 'distributed systems · event-driven · Kafka, Redis, MySQL' }
];

export default function Shell() {
  const bridge = useEvict();
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const [lines, setLines] = useState(INTRO);
  // the input element stays uncontrolled: its own cursor position is the truth,
  // and the prompt below mirrors it
  const [line, setLine] = useState({ value: '', caret: 0 });
  const historyRef = useRef([]);
  const hIndexRef = useRef(-1);
  const busyRef = useRef(false);
  const touch = useMemo(() => matchMedia('(hover: none)').matches, []);
  const COMMANDS = useMemo(() => buildCommands(() => bridge.current()), [bridge]);

  const sync = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    setLine({ value: el.value, caret: el.selectionStart == null ? el.value.length : el.selectionStart });
  }, []);
  const put = useCallback((v) => {
    const el = inputRef.current;
    if (!el) return;
    el.value = v;
    el.setSelectionRange(v.length, v.length);
    sync();
  }, [sync]);

  const push = useCallback((rows) => setLines((prev) => [...prev, ...rows]), []);

  const run = useCallback((raw) => {
    const cmd = raw.trim().toLowerCase().split(/\s+/)[0] || '';
    push([{ echo: raw }]);
    if (!cmd) return;
    historyRef.current = [raw, ...historyRef.current];
    hIndexRef.current = -1;

    const handler = COMMANDS[cmd];
    if (!handler) {
      const guesses = suggest(cmd, Object.keys(COMMANDS));
      const rows = [{ cls: 'warn', text: `sr-shell: ${cmd}: command not found` }];
      if (guesses.length === 1) {
        rows.push({ cls: 'dim', text: `did you mean \`${guesses[0]}\`? press Enter to run it` });
        push(rows);
        put(guesses[0]);
        return;
      }
      rows.push(guesses.length
        ? { cls: 'dim', text: `did you mean ${guesses.map((g) => `\`${g}\``).join(' or ')}?` }
        : { cls: 'dim', text: 'type `help` for the list' });
      push(rows);
      return;
    }
    if (handler === 'clear') { setLines([]); return; }

    const out = handler();
    if (Array.isArray(out)) {
      push(out.map(([cls, text]) => ({ cls, text })));
    } else if (out && out.stream) {
      busyRef.current = true;
      out.stream.forEach(([cls, text], i) => {
        setTimeout(() => {
          push([{ cls, text }]);
          if (i === out.stream.length - 1) busyRef.current = false;
        }, i * 260);
      });
    }
  }, [COMMANDS, push, put]);

  const onKeyDown = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const el = inputRef.current;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (busyRef.current) return;
      const v = el.value;
      put('');
      run(v);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (hIndexRef.current < historyRef.current.length - 1) {
        hIndexRef.current += 1;
        put(historyRef.current[hIndexRef.current]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (hIndexRef.current > 0) {
        hIndexRef.current -= 1;
        put(historyRef.current[hIndexRef.current]);
      } else {
        hIndexRef.current = -1;
        put('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const m = Object.keys(COMMANDS).filter((k) => k.indexOf(el.value.trim()) === 0);
      if (m.length === 1) put(m[0]);
      else if (m.length > 1) push([{ echo: el.value }, { cls: 'dim', text: m.join('  ') }]);
    } else {
      // Left/Right/Home/End: let the input move its cursor, then redraw
      setTimeout(sync, 0);
    }
  };

  // keep the newest line in view, and follow the cursor when it moves without an input event
  useEffect(() => {
    const body = bodyRef.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [lines]);
  useEffect(() => {
    const onSel = () => { if (document.activeElement === inputRef.current) sync(); };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, [sync]);

  const { value, caret } = line;

  return (
    <section id="shell" className="wrap block-tight">
      <div className="panel term" id="term">
        <div className="panel-head">
          <span className="tag">Shell — try <code>trace</code></span>
          <div className="term-keys">
            {KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  if (busyRef.current) return;
                  put('');
                  run(k);
                  // on touch screens, don't pop the keyboard up just because a button was tapped
                  if (!touch) inputRef.current.focus({ preventScroll: true });
                }}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
        <div
          className="term-body"
          id="term-body"
          ref={bodyRef}
          role="log"
          aria-live="polite"
          aria-label="Terminal output"
          onClick={() => inputRef.current.focus({ preventScroll: true })}
        >
          {lines.map((l, i) => (
            l.echo !== undefined
              ? <div className="line" key={i}><span className="ps">$</span> <span className="cmd">{l.echo}</span></div>
              : <div className={`line${l.cls ? ` ${CLASS[l.cls] || ''}` : ''}`} key={i}>{l.node || l.text}</div>
          ))}
          <div className={`line prompt-line${value ? '' : ' is-empty'}`}>
            <span className="ps">$</span>
            <span className="typed" id="typed" aria-hidden="true">{value.slice(0, caret)}</span>
            <span className="caret" id="caret" aria-hidden="true">{value.charAt(caret) || '\u00a0'}</span>
            <span className="typed-after" id="typed-after" aria-hidden="true">{value.slice(caret + 1)}</span>
            <input
              className="term-input"
              id="term-input"
              ref={inputRef}
              type="text"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              enterKeyHint="go"
              aria-label="Type a shell command, then press Enter"
              onInput={sync}
              onKeyUp={sync}
              onSelect={sync}
              onKeyDown={onKeyDown}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
