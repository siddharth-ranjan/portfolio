import { useEffect, useState } from 'react';

const read = () => {
  try {
    const t = localStorage.getItem('theme');
    if (t === 'light' || t === 'dark') return t;
  } catch { /* private mode */ }
  return document.documentElement.getAttribute('data-theme') || 'dark';
};

export function useTheme() {
  const [theme, setTheme] = useState(read);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch { /* private mode */ }
  }, [theme]);
  return [theme, setTheme];
}
