import { SPEC_PATH } from "./routes";

// The ModelKombat badge — the same karate high-kick stickman as the browser-tab
// favicon, inlined so it stays CSP-safe. Purely decorative: the "ModelKombat"
// wordmark beside it already names the link, so it is hidden from assistive tech.
export const NavLogo = () => (
  <svg class="nav-logo" viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="navTile" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#141a26" />
        <stop offset="1" stop-color="#0b0e14" />
      </linearGradient>
    </defs>
    <rect
      x="1.5"
      y="1.5"
      width="61"
      height="61"
      rx="15"
      fill="url(#navTile)"
      stroke="#7aa2ff"
      stroke-opacity="0.5"
      stroke-width="1.5"
    />
    <g
      stroke="#7aa2ff"
      stroke-width="6"
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none"
    >
      <line x1="31" y1="25" x2="28" y2="39" />
      <polyline points="28,39 39,36 50,33" />
      <polyline points="28,39 26,48 30,55" />
      <polyline points="31,26 37,22 42,18" />
      <polyline points="31,26 23,32 18,40" />
    </g>
    <circle cx="29" cy="17" r="6.5" fill="#7aa2ff" />
  </svg>
);

// Which page the nav is rendered on, so it can mark the active destination with aria-current.
// Only /ring is a distinct page in the nav today; the home-page sections are in-page anchors.
type NavProps = { current?: "ring" };

// The section anchors are absolute (`/#section`, not bare `#section`) so the SAME nav resolves
// from /ring — a full, separate HTML page — as it does on the home page. On the home page an
// absolute `/#king` is still just a same-document scroll; from /ring it navigates home and scrolls.
export default function Nav(props: NavProps) {
  return (
    <nav class="nav" aria-label="Primary">
      <a class="nav-brand" href="/#top">
        <NavLogo />
        <span>ModelKombat</span>
      </a>
      <div class="nav-links">
        <a href="/#how-it-works">How it works</a>
        <a href="/#arsenal">Arsenal</a>
        <a href="/#gauntlet">Gauntlet</a>
        <a href="/#king">King</a>
        <a href="/#champions">Champions</a>
        <a href="/#fights">Fights</a>
        <a
          href="/ring"
          aria-current={props.current === "ring" ? "page" : undefined}
        >
          Ring
        </a>
        <a href={SPEC_PATH} target="_blank">
          Spec <span aria-hidden="true">↗</span>
        </a>
      </div>
    </nav>
  );
}
