export default function Nav() {
  return (
    <nav class="nav" aria-label="Primary">
      <a class="nav-brand" href="#top">
        ModelKombat
      </a>
      <div class="nav-links">
        <a href="#how-it-works">How it works</a>
        <a href="#king">King</a>
        <a href="/spec">
          Spec <span aria-hidden="true">↗</span>
        </a>
      </div>
    </nav>
  );
}
