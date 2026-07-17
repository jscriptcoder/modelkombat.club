import { describe, expect, it } from "vitest";

import { markCollisions } from "./collisions";
import type { Fighter, ReplaySummary } from "./replay-contract";

// Per-test factories (no shared state). The collision key is the challenger+King *name* pair
// (models are ignored), so tests pin names explicitly and vary the id. Pure string logic —
// exhaustively asserted here, since web/ is not Stryker-reachable, so exact cases stand in for
// mutation coverage.
const fighter = (name: string): Fighter => ({ name, model: "m" });

const summary = (
  id: string,
  challenger: string,
  king: string,
): ReplaySummary => ({
  id,
  fighters: [fighter(challenger), fighter(king)],
});

describe("markCollisions — flagging repeated challenger↔King name pairs", () => {
  it("flags nothing when every name pair is unique", () => {
    const marked = markCollisions([
      summary("a1", "aki", "rex"),
      summary("b2", "juno", "rex"),
      summary("c3", "aki", "juno"),
    ]);

    expect(marked.map((m) => m.collides)).toEqual([false, false, false]);
  });

  it("flags both cards of a 2-way collision", () => {
    const marked = markCollisions([
      summary("a1", "aki", "rex"),
      summary("b2", "aki", "rex"),
    ]);

    expect(marked.map((m) => m.collides)).toEqual([true, true]);
  });

  it("flags all three cards of a 3-way collision", () => {
    const marked = markCollisions([
      summary("a1", "aki", "rex"),
      summary("b2", "aki", "rex"),
      summary("c3", "aki", "rex"),
    ]);

    expect(marked.map((m) => m.collides)).toEqual([true, true, true]);
  });

  it("flags only the colliding pair, leaves a unique entry untouched, preserves order", () => {
    const marked = markCollisions([
      summary("a1", "aki", "rex"), // collides with c3
      summary("b2", "juno", "rex"), // unique pair
      summary("c3", "aki", "rex"), // collides with a1
    ]);

    expect(marked.map((m) => ({ id: m.id, collides: m.collides }))).toEqual([
      { id: "a1", collides: true },
      { id: "b2", collides: false },
      { id: "c3", collides: true },
    ]);
  });

  it("needs the FULL pair to match — a shared single name is not a collision", () => {
    const marked = markCollisions([
      summary("a1", "aki", "rex"), // shares challenger with b2, King with c3
      summary("b2", "aki", "juno"), // shares challenger with a1 only
      summary("c3", "leo", "rex"), // shares King with a1 only
    ]);

    expect(marked.map((m) => m.collides)).toEqual([false, false, false]);
  });

  it("does not conflate pairs that concatenate to the same string without a separator", () => {
    // "a"+"bc" and "ab"+"c" both flatten to "abc" — a delimiter-less key would wrongly collide them.
    const marked = markCollisions([
      summary("a1", "a", "bc"),
      summary("b2", "ab", "c"),
    ]);

    expect(marked.map((m) => m.collides)).toEqual([false, false]);
  });

  it("carries each summary's own fields (id, fighters) through alongside the flag", () => {
    const only = summary("a1", "aki", "rex");

    const [marked] = markCollisions([only]);

    expect(marked).toEqual({ ...only, collides: false });
  });
});
