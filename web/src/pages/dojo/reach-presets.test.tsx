import { describe, expect, it } from "vitest";

import {
  DEFAULT_GAP,
  MAX_GAP,
  MIN_GAP,
  REACH_PRESETS,
} from "./reach-presets";

// The reach-preset table is a documented mirror of the engine move reaches (src/engine/rules.ts):
// web/src can't import src/, exactly as WORLD_WIDTH mirrors the ring width. The pose lab snaps the
// fighter gap to these so spacing/contact can be calibrated at true engine distances. web/ is not
// Stryker-reachable, so the value-by-value assertion stands in for mutation coverage.

describe("REACH_PRESETS — mirrors every engine technique reach, ascending", () => {
  it("lists all 13 techniques' reaches value-by-value, in ascending order", () => {
    // The full arsenal from rules.ts, shortest → longest. Exhaustive: move + reach + order + count
    // all pinned in one assertion, so any drift from the engine (a wrong value, a dropped move, a
    // reordering) fails here.
    expect(REACH_PRESETS.map((p) => [p.move, p.reach])).toEqual([
      ["empi", 95_000],
      ["hiza-geri", 110_000],
      ["throw", 120_000],
      ["sweep", 180_000],
      ["uraken", 200_000],
      ["kizami-zuki", 210_000],
      ["gyaku-zuki", 240_000],
      ["tobi-geri", 250_000],
      ["shuto", 260_000],
      ["mae-geri", 270_000],
      ["mawashi-geri", 300_000],
      ["yoko-geri", 315_000],
      ["ushiro-geri", 330_000],
    ]);
  });
});

describe("gap bounds — the slider's travel and the lab's opening distance", () => {
  it("starts the slider at 0 (fighters overlapping on the midpoint)", () => {
    expect(MIN_GAP).toBe(0);
  });

  it("ends the slider at the longest reach in the arsenal (ushiro-geri 330k)", () => {
    const longest = Math.max(...REACH_PRESETS.map((p) => p.reach));

    expect(MAX_GAP).toBe(330_000);
    expect(MAX_GAP).toBe(longest); // derived from the table, not a stray literal
  });

  it("opens the pair at gyaku-zuki reach — the default gap folds onto the preset table", () => {
    const gyaku = REACH_PRESETS.find((p) => p.move === "gyaku-zuki");

    expect(DEFAULT_GAP).toBe(240_000);
    expect(gyaku?.reach).toBe(DEFAULT_GAP); // one source of truth: the opening distance IS a preset
  });
});
