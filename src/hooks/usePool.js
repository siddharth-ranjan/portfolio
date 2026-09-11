import { useEffect } from 'react';

// bars grow in when the panel is first seen, then drift: least-connections keeps
// healthy instances near their baseline, never exactly on it
export function usePool(poolRef) {
  useEffect(() => {
    const pool = poolRef.current;
    if (!pool) return;
    const fills = [...pool.querySelectorAll('.fill')];
    const widths = fills.map((f) => f.style.getPropertyValue('--w'));
    fills.forEach((f) => { f.style.width = '0%'; });

    let timer = null;
    const drift = () => {
      if (document.hidden || document.documentElement.classList.contains('motion-paused')) return;
      fills.forEach((f, i) => {
        if (!f.classList.contains('ok')) return;
        const base = parseFloat(widths[i]);
        const v = Math.max(8, Math.min(95, Math.round(base + (Math.random() * 12 - 6))));
        f.style.width = `${v}%`;
        f.closest('li').querySelector('.load').textContent = `${v}%`;
      });
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        fills.forEach((f, i) => setTimeout(() => { f.style.width = widths[i]; }, 120 + i * 110));
        io.disconnect();
        timer = setInterval(drift, 1800);
      });
    }, { threshold: 0.3 });
    io.observe(pool);
    return () => { io.disconnect(); if (timer) clearInterval(timer); };
  }, [poolRef]);
}
