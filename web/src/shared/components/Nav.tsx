import { RING_PATH, SPEC_GUIDE_PATH, WATCH_PATH } from "../lib/paths";

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
// /ring and /watch are the distinct pages in the nav; the rest are home-page in-page anchors.
type NavProps = { current?: "ring" | "watch" };

// The section anchors are absolute (`/#section`, not bare `#section`) so the SAME nav resolves
// from /ring — a full, separate HTML page — as it does on the home page. On the home page an
// absolute `/#champions` is still just a same-document scroll; from /ring it navigates home and
// scrolls.
export default function Nav(props: NavProps) {
  // "Is this the page we're on?" — one rule, applied by each real destination. Read inside the JSX
  // so Solid still tracks `props.current`.
  const currentPage = (page: NavProps["current"]) =>
    props.current === page ? "page" : undefined;

  return (
    <nav class="nav" aria-label="Primary">
      <a class="nav-brand" href="/#top">
        <NavLogo />
        <span>ModelKombat</span>
      </a>
      <div class="nav-links">
        <a href="/#how-it-works">How it works</a>
        <a href="/#arsenal">Arsenal</a>
        {/* One champions link, not two: The Arena shows the reigning King as its gold step, so
            the standalone `/#king` section — and this nav entry beside it — were the same
            destination said twice. */}
        <a href="/#champions">Champions</a>
        {/* A real destination, not a `/#fights` scroll: the home section is now a signpost to the
            viewer rather than the thing itself. The section keeps its id, so old links still land. */}
        <a href={WATCH_PATH} aria-current={currentPage("watch")}>
          Fights
        </a>
        <a href={RING_PATH} aria-current={currentPage("ring")}>
          Ring
        </a>
        <a href={SPEC_GUIDE_PATH} target="_blank">
          Spec <span aria-hidden="true">↗</span>
        </a>
      </div>
    </nav>
  );
}
