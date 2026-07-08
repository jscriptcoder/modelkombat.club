// The single URL that serves the human-readable, rendered spec page. Shared by
// the Nav "Spec" link (its href) and the bootstrap route (which root to mount),
// so the link target and the route can never drift. The raw markdown stays at
// /spec (served by the api/spec function) for LLMs and the other spec links.
export const SPEC_PATH = "/spec-guide";

export const isSpecRoute = (pathname: string): boolean =>
  pathname === SPEC_PATH;
