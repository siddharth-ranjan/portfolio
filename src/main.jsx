import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

const root = document.getElementById('root');
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// the build prerenders the markup, so attach to it instead of throwing it away
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
