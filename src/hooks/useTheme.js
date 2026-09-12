import { useCallback, useEffect, useState } from 'react';

// Swap the theme in one frame: transitions are suspended while the colours
// change, otherwise the navbar, panels and page fade at different speeds.
function applyTheme(theme) {
  const root = document.documentElement;
  if (root.getAttribute('data-theme') === theme) return;
  root.classList.add('theme-switching');
  root.setAttribute('data-theme', theme);
  void root.offsetWidth; // flush styles with transitions still off
  // re-enable after the new colours have been painted; the timeout covers tabs
  // that are not painting (hidden, throttled), where animation frames never come
  const done = () => root.classList.remove('theme-switching');
  requestAnimationFrame(() => requestAnimationFrame(done));
  setTimeout(done, 60);
}

/**
 * Starts as 'dark' so the prerendered HTML and the first client render agree;
 * the stored choice is adopted right after mount. index.html sets the attribute
 * from localStorage before paint, so a light-mode visitor never sees a flash.
 */
export function useTheme() {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    let stored = null;
    try { stored = localStorage.getItem('theme'); } catch { /* private mode */ }
    if (stored === 'light' || stored === 'dark') setTheme(stored);
  }, []);

  useEffect(() => { applyTheme(theme); }, [theme]);

  // only a deliberate choice is persisted, never the pre-hydration default;
  // it is applied in the click itself, not an effect later
  const choose = useCallback((t) => {
    applyTheme(t);
    setTheme(t);
    try { localStorage.setItem('theme', t); } catch { /* private mode */ }
  }, []);

  return [theme, choose];
}
