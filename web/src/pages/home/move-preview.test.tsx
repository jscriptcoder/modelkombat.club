import { describe, expect, it } from "vitest";

import { REACH_PRESETS } from "../dojo/reach-presets";
import { contactFrame, loopIndex, moveLoopTape } from "./move-preview";

// move-preview.ts is the Arsenal preview's pure render-model core: it turns ONE move id into a
// looping ReplayTape — an attacker driving a passive target — that the popover plays through the
// SAME scene()/createStage pipeline /watch ships, plus `loopIndex`, the seamless wrap from the
// preview clock's fractional playhead to a tape index. Pure maths, no Pixi/DOM: web/ is not
// Stryker-reachable, so exhaustive exact cases + an independently-restated roster stand in for
// mutation coverage (same discipline as dojo-tape.test).

// WORLD_WIDTH / 2 — the ring midpoint the pair is centered on (mirrors scene.ts's world bound,
// restated as a literal so this file is independent of production).
const WORLD_MID = 300_000;

describe("moveLoopTape — one move, looping: an attacker driving a passive target", () => {
  it("spans the move's full engine duration, so the loop plays the whole technique", () => {
    // gyaku-zuki is 7 startup / 3 active / 14 recovery = 24 ticks; ushiro-geri 13/3/22 = 38.
    expect(moveLoopTape("gyaku-zuki")).toHaveLength(24);
    expect(moveLoopTape("ushiro-geri")).toHaveLength(38);
  });

  it("commits the attacker (a) to the move and walks its phase startup → active → recovery", () => {
    const tape = moveLoopTape("gyaku-zuki");
    const a0 = tape[0].a;

    expect(a0.attacking).toBe(true);
    expect(a0.attackMove).toBe("gyaku-zuki");
    expect(a0.attackReach).toBe(240_000); // gyaku-zuki reach
    expect(a0.attackBand).toBe(3); // the engine's first legal band for gyaku-zuki (HIGH)
    expect(a0.facing).toBe(1); // the attacker faces right, into the target
    expect(a0.posture).toBe(0); // a clean standing strike
    expect(a0.guardBand).toBe(0);
    expect(a0.knockdown).toBe(false);

    // The phase walks the engine's own 7/3/14 timing, in order — either boundary shifting fails here.
    expect(tape.map((t) => t.a.attackPhase)).toEqual([
      ...Array<number>(7).fill(1),
      ...Array<number>(3).fill(2),
      ...Array<number>(14).fill(3),
    ]);
  });

  it("keeps the target (b) a passive partner facing the attacker for the whole loop", () => {
    const tape = moveLoopTape("gyaku-zuki");
    const b0 = tape[0].b;

    expect(b0.attacking).toBe(false); // never a second attacker
    expect(b0.attackReach).toBe(0); // idle — no committed reach
    expect(b0.facing).toBe(-1); // faces the attacker on its left

    // Idle on EVERY tick, not just the first — a target that "woke up" mid-loop would slip past a
    // tick-0-only check.
    expect(tape.every((t) => t.b.attacking === false)).toBe(true);
  });

  it("places the attacker left of a target its own reach away, centered on the ring", () => {
    const { a, b } = moveLoopTape("gyaku-zuki")[0];

    expect(a.x).toBeLessThan(b.x); // attacker is the LEFT fighter
    expect(b.x - a.x).toBe(240_000); // separation == gyaku-zuki reach (contact distance)
    expect((a.x + b.x) / 2).toBe(WORLD_MID); // centered on the ring midpoint
  });

  it("derives the gap from EACH move's own reach — a shorter move pulls the target closer", () => {
    // empi is the arsenal's shortest reach (95k), ushiro-geri the longest (330k); a hardcoded gap
    // would make both separations equal.
    const near = moveLoopTape("empi")[0];
    const far = moveLoopTape("ushiro-geri")[0];

    expect(near.b.x - near.a.x).toBe(95_000);
    expect(far.b.x - far.a.x).toBe(330_000);
    expect(near.b.x - near.a.x).toBeLessThan(far.b.x - far.a.x);
  });

  it("gives every arsenal move a playable looping span — none collapses or runs backwards", () => {
    // Guards the whole 13-move table at once (REACH_PRESETS order); a dropped/zeroed timing field
    // would surface as a 1-tick span. Restated independently of production — the web ∉ Stryker guard.
    const spans = REACH_PRESETS.map((p) => moveLoopTape(p.move).length);

    expect(spans).toEqual([24, 27, 23, 22, 22, 22, 24, 21, 25, 28, 32, 35, 38]);
    expect(Math.min(...spans)).toBeGreaterThan(1);
  });

  it("stands the attacker down for an unknown or empty move id instead of throwing (M7 totality)", () => {
    // A typo in the hand-curated roster must never crash the home page: a fallback, not an exception.
    for (const id of ["kokoro-nage", ""]) {
      const tape = moveLoopTape(id);

      expect(tape.length).toBeGreaterThanOrEqual(1); // non-empty
      expect(tape[0].a.attacking).toBe(false); // idle fallback, no phantom technique
      // ...and still validly placed: the fallback gap keeps the pair on real coordinates rather than
      // NaN (which a dropped gap fallback would produce and break the render with).
      expect(Number.isFinite(tape[0].a.x)).toBe(true);
      expect(Number.isFinite(tape[0].b.x)).toBe(true);
    }
  });
});

describe("loopIndex — seamless wrap from a fractional playhead to a tape index", () => {
  it("tracks the playhead within the tape", () => {
    expect(loopIndex(0, 24)).toBe(0);
    expect(loopIndex(2.4, 24)).toBe(2);
    expect(loopIndex(23.1, 24)).toBe(23);
  });

  it("never indexes past the tape's last frame", () => {
    // The off-by-one that would read tape[length] (undefined): a playhead in [23, 24) must stay 23.
    expect(loopIndex(23.9, 24)).toBe(23);
  });

  it("wraps back to the start at and beyond the end, so the loop has no seam", () => {
    expect(loopIndex(24, 24)).toBe(0); // exactly at the end → first frame
    expect(loopIndex(24.5, 24)).toBe(0);
    expect(loopIndex(25.2, 24)).toBe(1);
  });

  it("floors a negative playhead back into range", () => {
    expect(loopIndex(-0.5, 24)).toBe(23);
    expect(loopIndex(-1, 24)).toBe(23);
  });

  it("stays a valid in-range integer across a long sweep of playheads (never length, never fractional)", () => {
    const length = 24;

    for (let i = 0; i < 200; i++) {
      const idx = loopIndex(i * 0.37, length);

      expect(Number.isInteger(idx)).toBe(true);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(length);
    }
  });
});

describe("contactFrame — the still frame a reduced-motion preview freezes on", () => {
  it("lands inside the active (contact) window for EVERY arsenal move", () => {
    // The chosen frame must be the strike AT CONTACT — phase 2 (active) in the engine encoding — not
    // a wind-up (1) or recovery (3) frame. Asserted through moveLoopTape itself for the whole roster,
    // so a wrong window or an off-by-one on the boundary surfaces here (web ∉ Stryker guard).
    for (const preset of REACH_PRESETS) {
      const tape = moveLoopTape(preset.move);
      const frame = contactFrame(preset.move);

      expect(tape[frame].a.attackPhase).toBe(2);
    }
  });

  it("freezes on the FIRST active tick — the moment the strike reaches contact", () => {
    // The active window opens exactly at `startup`; the still frame sits on its first tick, not the
    // last wind-up frame (startup - 1) nor the first recovery frame (startup + active).
    expect(contactFrame("gyaku-zuki")).toBe(7); // 7 startup → active opens at 7
    expect(contactFrame("mae-geri")).toBe(9); // the dojo's "contact tick"
    expect(contactFrame("tobi-geri")).toBe(4); // the fastest wind-up
    expect(contactFrame("ushiro-geri")).toBe(13); // the slowest
  });

  it("falls back to frame 0 for an unknown or empty move id (M7 totality)", () => {
    // An unknown move has a single-tick idle tape; freezing on tick 0 is the only valid index and
    // must never read off the end or throw.
    for (const id of ["kokoro-nage", ""]) {
      expect(contactFrame(id)).toBe(0);
    }
  });
});
