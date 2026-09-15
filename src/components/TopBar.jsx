const LINKS = [
  ['flow', 'Flow'],
  ['ai', 'AI'],
  ['services', 'Services'],
  ['shell', 'Shell'],
  ['resume', 'Résumé'],
  ['contact', 'Contact']
];

// `base` is '' on the portfolio (in-page anchors) and '/' on other pages, so the
// section links lead back to the portfolio.
export default function TopBar({ theme, setTheme, brandHidden, active, base = '' }) {
  const dark = theme === 'dark';
  const Brand = base ? 'a' : 'div';
  return (
    <header className={`topbar${brandHidden ? ' brand-hidden' : ''}`}>
      <div className="wrap topbar-in">
        <Brand className="brand" {...(base ? { href: '/' } : {})}>
          <span className="brand-name">Siddharth Ranjan</span>
          <span className="brand-tag">Backend · AI</span>
        </Brand>
        <nav className="nav" aria-label="Primary">
          {LINKS.map(([id, label]) => (
            <a key={id} href={`${base}#${id}`} className={active === id ? 'is-active' : undefined}>{label}</a>
          ))}
          <a href="/chess" className={active === 'chess' ? 'is-active' : undefined}>Chess</a>
        </nav>
        <button
          type="button"
          id="theme-switch"
          className="theme-switch"
          role="switch"
          aria-checked={dark}
          aria-label="Dark theme"
          onClick={() => setTheme(dark ? 'light' : 'dark')}
        >
          <span className="ts-track" aria-hidden="true"><span className="ts-knob" /></span>
          <span className="ts-label">{dark ? 'Dark' : 'Light'}</span>
        </button>
      </div>
    </header>
  );
}
