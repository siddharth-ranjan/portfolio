import { useEffect, useState } from 'react';

export function useScrollSpy(ids) {
  const [active, setActive] = useState('');
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY + 120;
      let current = '';
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= y) current = id;
      });
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [ids]);
  return active;
}
