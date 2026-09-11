import { useRef, useState } from 'react';

const PDF = '/assets/resume.pdf';
const IMG = '/assets/resume.png';

export default function Resume() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    // closing a tall preview from further down: bring the panel header back into view
    if (!next && panelRef.current) panelRef.current.scrollIntoView({ block: 'nearest' });
  };

  return (
    <section id="resume" className="wrap block">
      <div className="block-head">
        <h2>Résumé</h2>
        <span className="tag">Latest · Sept 2026</span>
      </div>
      <div className={`panel cv${open ? ' is-open' : ''}`} ref={panelRef}>
        <div className="panel-head">
          <span className="tag">GET /resume.pdf · 200 OK · 1 page</span>
          <div className="cv-actions">
            <button type="button" className="flow-btn" aria-expanded={open} aria-controls="cv-body" onClick={toggle}>
              {open ? 'Close preview' : 'Preview résumé'}
            </button>
            <a className="flow-btn" href={PDF} target="_blank" rel="noopener">Open PDF ↗</a>
          </div>
        </div>
        {/* the PDF only loads once the preview is opened; phones get a page image instead */}
        <div className="cv-body" id="cv-body" hidden={!open}>
          {open && (
            <>
              <iframe className="cv-frame" src={`${PDF}#view=FitH`} title="Résumé preview" />
              <a className="cv-shot" href={PDF} target="_blank" rel="noopener">
                <img src={IMG} alt="Résumé of Siddharth Ranjan, page 1" />
              </a>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
