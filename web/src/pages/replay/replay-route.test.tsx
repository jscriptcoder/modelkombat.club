import { describe, expect, it } from "vitest";

import { replayIdFromPath } from "./replay-route";

// The viewer is ONE SPA served at both /watch (the browsable list) and /watch/{id} (a permalink to
// one fight). `replayIdFromPath` reads a pathname and decides which view: the fight id after
// /watch/, or null for the bare list route. Pure string logic — exhaustively asserted here, since
// web/ is not Stryker-reachable, so exact cases stand in for mutation coverage.
describe("replayIdFromPath — /watch vs /watch/{id}", () => {
  it("returns the id segment for a permalink path", () => {
    expect(replayIdFromPath("/watch/9f8e7d6c")).toBe("9f8e7d6c");
  });

  it("returns null for the bare list route", () => {
    expect(replayIdFromPath("/watch")).toBeNull();
  });

  it("returns null for the list route with a trailing slash", () => {
    expect(replayIdFromPath("/watch/")).toBeNull();
  });

  it("tolerates a trailing slash after the id", () => {
    expect(replayIdFromPath("/watch/9f8e7d6c/")).toBe("9f8e7d6c");
  });

  it("returns null for an unrelated root path", () => {
    expect(replayIdFromPath("/")).toBeNull();
  });
});
