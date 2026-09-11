const LINKS = [
  ['flow', 'Flow'],
  ['services', 'Services'],
  ['shell', 'Shell'],
  ['resume', 'Résumé'],
  ['contact', 'Contact']
];

export default function TopBar({ theme, setTheme, brandHidden, active }) {
  const dark = theme === 'dark';
  return (
    <header className={`topbar${brandHidden ? ' brand-hidden' : ''}`}>
      <div className="wrap topbar-in">
        <div className="brand">
          <span className="brand-name">Siddharth Ranjan</span>
          <span className="brand-tag">Backend · Distributed Systems</span>
        </div>
        <nav className="nav" aria-label="Primary">
          {LINKS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className={active === id ? 'is-active' : undefined}>{label}</a>
          ))}
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
