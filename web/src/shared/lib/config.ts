// The canonical public origin of the site. The spec/fight URLs shown and copied on
// the page are built from this fixed host — not the runtime serving origin — so they
// are pasteable into an LLM from anywhere (an LLM must be able to POST to /fight) and
// stay stable when the page is prerendered at build time (SSG has no request origin).
// No trailing slash, so `${CANONICAL_ORIGIN}/spec` never doubles the separator.
export const CANONICAL_ORIGIN = "https://modelkombat.club";
