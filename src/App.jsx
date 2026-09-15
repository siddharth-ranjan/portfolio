import { useEffect, useRef, useState } from 'react';
import { FlowContext } from './flowContext.js';
import { useTheme } from './hooks/useTheme.js';
import { useReveal } from './hooks/useReveal.js';
import { useScrollSpy } from './hooks/useScrollSpy.js';
import TopBar from './components/TopBar.jsx';
import Hero from './components/Hero.jsx';
import Flow from './components/Flow.jsx';
import PoolPanel from './components/PoolPanel.jsx';
import Async from './components/Async.jsx';
import Ownership from './components/Ownership.jsx';
import AiWork from './components/AiWork.jsx';
import AiFlow from './components/AiFlow.jsx';
import Shell from './components/Shell.jsx';
import ChessTeaser from './components/ChessTeaser.jsx';
import TrackRecord from './components/TrackRecord.jsx';
import Resume from './components/Resume.jsx';
import Contact from './components/Contact.jsx';
import Footer from './components/Footer.jsx';

const SECTIONS = ['flow', 'ai', 'services', 'shell', 'resume', 'contact'];

export default function App() {
  const [theme, setTheme] = useTheme();
  const evictBridge = useRef(() => 'unavailable');
  const heroNameRef = useRef(null);
  const [brandHidden, setBrandHidden] = useState(true);
  const active = useScrollSpy(SECTIONS);
  useReveal();

  // the top-bar name only appears once the big hero name has scrolled away
  useEffect(() => {
    const el = heroNameRef.current;
    if (!el || !('IntersectionObserver' in window)) { setBrandHidden(false); return; }
    const io = new IntersectionObserver(
      (en) => setBrandHidden(en[0].isIntersecting),
      { rootMargin: '-64px 0px 0px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <FlowContext.Provider value={evictBridge}>
      <a className="skip" href="#flow">Skip to content</a>
      <TopBar theme={theme} setTheme={setTheme} brandHidden={brandHidden} active={active} />
      <main>
        <Hero nameRef={heroNameRef} />
        <Flow />
        <AiFlow />
        <AiWork />
        <PoolPanel />
        <Async />
        <Ownership />
        <Shell />
        <ChessTeaser />
        <TrackRecord />
        <Resume />
        <Contact />
      </main>
      <Footer />
    </FlowContext.Provider>
  );
}
