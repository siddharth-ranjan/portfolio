import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import App from './App.jsx';
import ChessPage from './chess/ChessPage.jsx';

export function render() {
  return renderToString(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

// /chess: only the parts that never change are meaningful here (top bar, heading, copy,
// a starting-position board, empty panels). The browser hydrates and fills in the live game.
export function renderChess() {
  return renderToString(
    <StrictMode>
      <ChessPage />
    </StrictMode>
  );
}
