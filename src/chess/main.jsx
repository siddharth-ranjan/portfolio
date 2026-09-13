import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ChessPage from './ChessPage.jsx';
import '../styles.css';

// /chess is live data, so it isn't prerendered: render on the client.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ChessPage />
  </StrictMode>
);
