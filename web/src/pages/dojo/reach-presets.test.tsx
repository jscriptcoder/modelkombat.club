import { describe, expect, it } from "vitest";

import {
  DEFAULT_GAP,
  MAX_GAP,
  MIN_GAP,
  REACH_PRESETS,
  type ReachPreset,
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

  it("mirrors every technique's frame timing value-by-value (startup / active / recovery)", () => {
    // The second half of the mirror (S2): the engine's own three timing fields, under the same names,
    // transcribed from rules.ts. Exhaustive for the same reason the reaches are — any drift (a
    // retuned move, a transposed pair, a dropped field) fails right here rather than silently
    // desynchronising the pose lab's playback speed from the engine's.
    expect(
      REACH_PRESETS.map((p) => [p.move, p.startup, p.active, p.recovery]),
    ).toEqual([
      ["empi", 8, 2, 14],
      ["hiza-geri", 9, 2, 16],
      ["throw", 7, 2, 14],
      ["sweep", 7, 2, 13],
      ["uraken", 7, 2, 13],
      ["kizami-zuki", 7, 2, 13],
      ["gyaku-zuki", 7, 3, 14],
      ["tobi-geri", 4, 3, 14],
      ["shuto", 8, 2, 15],
      ["mae-geri", 9, 3, 16],
      ["mawashi-geri", 11, 3, 18],
      ["yoko-geri", 12, 3, 20],
      ["ushiro-geri", 13, 3, 22],
    ]);
  });

  it("mirrors which height bands each technique may legally strike, in the engine's own order", () => {
    // The third mirrored field (S3): `bands` from rules.ts, as this codebase's numeric band codes
    // (3 high / 2 mid / 1 low), in the order the engine lists them — the first entry is the one the
    // move picker stamps, so ORDER is load-bearing here and not merely cosmetic.
    //
    // `throw` and `sweep` carry NO band list, and that is faithful rather than a gap: `bandLegal`
    // (sim.ts:613) reads an absent `bands` as EVERY band being legal, so those two are unrestricted
    // by the band gate — the sweep is constrained by hurtbox occupancy instead, and a throw is a
    // grab with no height at all. Inventing a list for them would put an interpretation in a table
    // whose whole job is to transcribe.
    // Read through the declared ReachPreset rather than the `as const` literal union: `throw` and
    // `sweep` genuinely have no `bands` KEY, so only the real type exposes it as optional.
    expect(REACH_PRESETS.map((p: ReachPreset) => [p.move, p.bands])).toEqual([
      ["empi", [3, 2]],
      ["hiza-geri", [2]],
      ["throw", undefined],
      ["sweep", undefined],
      ["uraken", [3]],
      ["kizami-zuki", [3, 2]],
      ["gyaku-zuki", [3, 2]],
      ["tobi-geri", [3, 2]],
      ["shuto", [3, 2]],
      ["mae-geri", [2]],
      ["mawashi-geri", [3, 2]],
      ["yoko-geri", [2]],
      ["ushiro-geri", [3, 2]],
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
