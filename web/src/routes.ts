// The single URL that serves the human-readable, rendered spec page. Shared by the Nav
// "Spec" link (its href) and the prerender's canonical `<link>`, so the link target and
// the page's own canonical can never drift. The raw markdown stays at /spec (served by
// the api/spec function) for LLMs and the other spec links.
export const SPEC_PATH = "/spec-guide";
