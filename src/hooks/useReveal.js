import { useEffect } from 'react';

const SELECTOR = 'section > .block-head, .block-sub, .chain-scroll, .panel, .owns li, .record li, .note-rule';

// fade sections in as they scroll into view; skipped entirely under reduced motion
export function useReveal() {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const targets = [...document.querySelectorAll(SELECTOR)];
    targets.forEach((el, i) => {
      el.classList.add('reveal');
      el.style.transitionDelay = `${(i % 6) * 40}ms`;
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
