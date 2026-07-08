import { describe, expect, it } from "vitest";

import { isSpecRoute } from "./routes";

// The single source of truth for "which URL is the rendered spec page". The Nav
// link and the bootstrap route both derive from it, so they cannot drift.
describe("spec route", () => {
  it("selects the rendered spec page for the spec-guide path", () => {
    expect(isSpecRoute("/spec-guide")).toBe(true);
  });

  it("leaves the home page and the raw /spec endpoint off the spec page", () => {
    // The raw markdown endpoint (/spec) must never be captured by the SPA route —
    // it stays served by the api/spec function for LLMs and the other links.
    expect(isSpecRoute("/")).toBe(false);
    expect(isSpecRoute("/spec")).toBe(false);
  });
});
