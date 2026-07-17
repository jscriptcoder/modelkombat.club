// The viewer is ONE SPA served at both /watch (the browsable list) and /watch/{id} (a permalink to
// one fight). This reads a pathname and returns the fight id after /watch/, or null for the bare
// list route — the seam `ReplayPage` dispatches on. Pure, so it is exhaustively unit-tested (web/
// is not Stryker-reachable).
export const replayIdFromPath = (pathname: string): string | null => {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);

  return segments[0] === "watch" && segments.length > 1 ? segments[1] : null;
};
