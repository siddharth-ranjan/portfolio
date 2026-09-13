// Static on purpose: the main page doesn't poll the game.
export default function ChessTeaser() {
  return (
    <section className="wrap block-tight">
      <a className="panel chess-teaser" href="/chess">
        <span className="tag">Off hours</span>
        <span className="chess-teaser-title">Crowd chess — one shared game, one move per visitor</span>
        <span className="chess-teaser-go" aria-hidden="true">Make your move →</span>
      </a>
    </section>
  );
}
