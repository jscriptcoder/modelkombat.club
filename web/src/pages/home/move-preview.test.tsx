import { describe, expect, it } from "vitest";

import { REACH_PRESETS } from "../dojo/reach-presets";
import { scene, type Viewport } from "../replay/scene";
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

// PreviewStage's DEFAULT_VIEWPORT — the popover's real canvas size, restated so this file stays
// independent of production (the same discipline WORLD_MID follows).
const PREVIEW_VIEWPORT: Viewport = { width: 220, height: 168 };

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

describe("moveLoopTape — the target goes DOWN for the techniques that knock it down", () => {
  // The three knockdown techniques and, for each, how many ticks its target spends upright then
  // prone. Restated independently of the preset table (the web ∉ Stryker guard): `throw` is 7/2/14
  // = 23 ticks dropping at 7, `sweep` 7/2/13 = 22 dropping at 7, `hiza-geri` 9/2/16 = 27 dropping
  // at 9. A shared contact constant, or a boundary shifted either way, fails here.
  const KNOCKDOWN_MOVES = [
    ["throw", 7, 16],
    ["sweep", 7, 15],
    ["hiza-geri", 9, 18],
  ] as const;

  const targetKnockdown = (move: string): readonly boolean[] =>
    moveLoopTape(move).map((t) => t.b.knockdown);

  it("lays the target out from the sweep's contact tick to the end of the loop", () => {
    // The sweep first, deliberately: it is the move whose ENTIRE payload is the knockdown (score 0),
    // and starting here rather than on `throw` proves this is a table-driven rule about knockdown
    // techniques, not a second special case grafted onto the grab.
    expect(targetKnockdown("sweep")).toEqual([
      ...Array<boolean>(7).fill(false),
      ...Array<boolean>(15).fill(true),
    ]);
  });

  it("drops the target at each knockdown technique's OWN contact tick", () => {
    for (const [move, upright, prone] of KNOCKDOWN_MOVES) {
      expect(targetKnockdown(move)).toEqual([
        ...Array<boolean>(upright).fill(false),
        ...Array<boolean>(prone).fill(true),
      ]);
    }
  });

  it("never lays the target down for the ten techniques that leave it standing", () => {
    const standing = REACH_PRESETS.map((p) => p.move).filter(
      (move) => !KNOCKDOWN_MOVES.some(([id]) => id === move),
    );

    expect(standing).toHaveLength(10); // the whole roster is accounted for: 3 down + 10 standing

    for (const move of standing) {
      expect(targetKnockdown(move)).toEqual(
        Array<boolean>(moveLoopTape(move).length).fill(false),
      );
    }
  });

  it("leaves the ATTACKER standing through its own knockdown technique", () => {
    // The knockdown is a cross-fighter effect: it lands on the foe, never on the fighter throwing it.
    for (const [move] of KNOCKDOWN_MOVES) {
      expect(moveLoopTape(move).every((t) => t.a.knockdown === false)).toBe(
        true,
      );
    }
  });

  it("keeps an unknown move's target upright instead of throwing (M7 totality)", () => {
    for (const id of ["kokoro-nage", ""]) {
      expect(targetKnockdown(id)).toEqual([false]);
    }
  });

  it("ends every knockdown loop before the foe would wake, so no wake-up needs modelling", () => {
    // rules.ts sets knockdownDuration 18 — a downed foe rises 18 ticks after it drops. Each of the
    // three tapes ends within that budget (throw 16, sweep 15, hiza-geri 18 — exactly on the edge),
    // so the target simply stays prone to the loop's end and the preview needs no wake-up. Pinned as
    // an assertion rather than a comment: a retuned recovery that pushed a tape past the budget would
    // otherwise silently render a foe still lying down after the engine would have stood it up.
    const KNOCKDOWN_DURATION = 18;

    for (const [move] of KNOCKDOWN_MOVES) {
      const tape = moveLoopTape(move);

      expect(tape.length - contactFrame(move)).toBeLessThanOrEqual(
        KNOCKDOWN_DURATION,
      );
      expect(tape[tape.length - 1].b.knockdown).toBe(true);
    }
  });
});

describe("moveLoopTape — tobi-geri leaves the ground, kicks at the apex, and lands", () => {
  // Postures in the engine's own encoding, restated here (web ∉ Stryker): 2 airborne, 0 grounded.
  const AIR = 2;
  const GROUND = 0;
  const TOBI_REACH = 250_000;
  // tobi-geri is 4 startup / 3 active / 14 recovery = 21 ticks, and the arc lands on tick 7 — so 14
  // of those ticks are spent grounded in recovery. That is a KNOWN, accepted cost (plan D5/D7), not
  // an oversight: the recovery is not static, `easeDriven` retracts the foot across it.
  const GROUNDED_TAIL = 14;

  const attacker = (move: string) => moveLoopTape(move).map((t) => t.a);

  it("lifts the attacker along the engine's jump arc and puts it back down", () => {
    expect(attacker("tobi-geri").map((a) => a.y)).toEqual([
      0,
      12_000,
      20_000,
      24_000,
      24_000,
      20_000,
      12_000,
      ...Array<number>(GROUNDED_TAIL).fill(0),
    ]);
  });

  it("reads AIRBORNE on exactly the ticks it is off the ground", () => {
    expect(attacker("tobi-geri").map((a) => a.posture)).toEqual([
      GROUND,
      ...Array<number>(6).fill(AIR),
      ...Array<number>(GROUNDED_TAIL).fill(GROUND),
    ]);
  });

  it("kicks at the APEX — the contact tick is the held top of the arc", () => {
    // Also acceptance for the reduced-motion still: `contactFrame` is the frame a reduced-motion
    // preview freezes on, and for the arsenal's one aerial technique that frame has to be airborne.
    const tape = moveLoopTape("tobi-geri");
    const contact = contactFrame("tobi-geri");

    expect(contact).toBe(4); // the fastest wind-up in the arsenal
    expect(tape[contact].a.y).toBe(24_000);
    expect(tape[contact].a.y).toBe(Math.max(...tape.map((t) => t.a.y)));
    expect(tape[contact].a.posture).toBe(AIR);
    expect(tape[contact].a.attackPhase).toBe(2); // and genuinely at contact, not wind-up
  });

  it("closes the distance in flight — one true reach away exactly when the foot arrives", () => {
    // The jump-in supplies the closing, not the reach (rules.ts). So the pair opens FURTHER out than
    // tobi-geri's reach and the leap eats the difference: 250000 + the 40000 closed by contact. The
    // attacker keeps travelling to touchdown, landing INSIDE reach — past where it kicked, as a real
    // jump-in does — and then holds there.
    const gaps = moveLoopTape("tobi-geri").map((t) => t.b.x - t.a.x);

    expect(gaps.slice(0, 8)).toEqual([
      290_000, 280_000, 270_000, 260_000, 250_000, 240_000, 230_000, 230_000,
    ]);
    expect(gaps[4]).toBe(TOBI_REACH); // the criterion, called out on its own
    expect(gaps.slice(6).every((g) => g === 230_000)).toBe(true); // grounded: no endless slide
  });

  it("keeps the TARGET planted while the attacker flies", () => {
    const tape = moveLoopTape("tobi-geri");

    expect(tape.every((t) => t.b.y === 0 && t.b.posture === GROUND)).toBe(true);
    expect(new Set(tape.map((t) => t.b.x)).size).toBe(1); // the target never moves
  });

  it("leaves the other twelve techniques grounded at a fixed gap", () => {
    const grounded = REACH_PRESETS.filter((p) => p.move !== "tobi-geri");

    expect(grounded).toHaveLength(12);

    for (const preset of grounded) {
      const tape = moveLoopTape(preset.move);

      expect(tape.every((t) => t.a.y === 0 && t.a.posture === GROUND)).toBe(
        true,
      );
      expect(new Set(tape.map((t) => t.b.x - t.a.x))).toEqual(
        new Set([preset.reach]),
      );
    }
  });

  it("DRAWS the attacker off the mat at the apex and back on it after landing", () => {
    // The tape assertions above say the arc is in the data; this one says it reaches the screen.
    // Everything between — scene()'s lift, the AIR stance, the shrinking ground shadow — is machinery
    // that already shipped, but nothing until now proved the preview actually feeds it. Run the same
    // tape through the same scene() the popover renders with, at the popover's own viewport.
    const tape = moveLoopTape("tobi-geri");
    const drawnY = (tick: number) => scene(tape, tick, PREVIEW_VIEWPORT).a.y;

    expect(drawnY(4)).toBeLessThan(drawnY(0)); // apex is HIGHER on screen (y grows downward)
    expect(drawnY(7)).toBe(drawnY(0)); // landed back on the exact ground line
    expect(drawnY(20)).toBe(drawnY(0)); // and stays there through the grounded recovery
    // The lift is a real, visible displacement rather than a sub-pixel nudge.
    expect(drawnY(0) - drawnY(4)).toBeGreaterThan(5);
  });

  it("keeps an unknown move id grounded and still (M7 totality)", () => {
    for (const id of ["kokoro-nage", ""]) {
      const tape = moveLoopTape(id);

      expect(tape.every((t) => t.a.y === 0 && t.a.posture === GROUND)).toBe(
        true,
      );
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
