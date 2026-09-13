import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import ChessPage from './ChessPage.jsx';
import '../styles.css';

const root = document.getElementById('root');
const app = (
  <StrictMode>
    <ChessPage />
  </StrictMode>
);

// the build prerenders the static shell; attach to it, then the live game fills in
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
