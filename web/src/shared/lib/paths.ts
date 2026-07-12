// The one place that names every URL the site links to or calls, so a path is never
// hardcoded in two files that could drift apart. Two kinds live here:
//
//   - Site pages — the HTML routes a visitor navigates to (home, ring, the rendered spec).
//   - API endpoints — the routes the UI fetches at runtime (the throne, a fight, raw spec).
//
// In-page section anchors (`/#king`, `/#how-it-works`, …) are deliberately NOT here: they
// are same-document scroll fragments, not routes, and each is used in exactly one place.

// --- Site pages ---

// The marketing home page.
export const HOME_PATH = "/";

// The browser bot-submit page (its own client-rendered shell, ring.html).
export const RING_PATH = "/ring";

// The human-readable, rendered spec page (prerendered static HTML). Distinct from the raw
// /spec endpoint below: this is the one a person opens and reads; /spec is the machine copy.
export const SPEC_GUIDE_PATH = "/spec-guide";

// --- API endpoints the UI calls ---

// The raw spec markdown, served by the api/spec function (and the static /spec.md fallback)
// for LLMs and tooling — the source the SPEC_GUIDE_PATH page is rendered from.
export const SPEC_PATH = "/spec";

// The identity-only reigning-champion + succession payload (GET), feeding the King and the
// Hall of Kings sections from one request.
export const KING_PATH = "/king";

// The gauntlet + King-of-the-Hill title bout (POST), the target of the /ring submit form.
export const FIGHT_PATH = "/fight";
