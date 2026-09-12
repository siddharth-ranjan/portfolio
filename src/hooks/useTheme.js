import { useCallback, useEffect, useState } from 'react';

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

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // only a deliberate choice is persisted, never the pre-hydration default
  const choose = useCallback((t) => {
    setTheme(t);
    try { localStorage.setItem('theme', t); } catch { /* private mode */ }
  }, []);

  return [theme, choose];
}
