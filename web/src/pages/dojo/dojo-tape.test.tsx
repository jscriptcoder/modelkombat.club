import { describe, expect, it } from "vitest";

import { createStage } from "../replay/figures";
import { BODY_HEIGHT_SUB, scene, type Viewport } from "../replay/scene";
import type { ReplayFrame } from "../replay/replay-contract";
import { buildDojoTape, DEFAULT_CHALLENGER, DEFAULT_KING } from "./dojo-tape";
import { DEFAULT_GAP, REACH_PRESETS } from "./reach-presets";

// Story 3 — world scale. Pose joints render at ×(BODY_HEIGHT_SUB · pxPerSubunit / 76), rounded;
// recomputed from the documented knob + fixed 1200-wide viewport so a scale mutant is caught.
const s = (n: number) =>
  Math.round((n * BODY_HEIGHT_SUB * (1200 / 600_000)) / 76);

// The dojo's synthetic-tape builder centers two hand-posed fighters on the ring so the pose lab
// renders them through the SAME scene()/createStage pipeline that /watch ships — "what you tune is
// what ships". Pure maths, exhaustively asserted: web/ is not Stryker-reachable, so exact cases stand
// in for mutation coverage.

// A neutral render frame (mirrors scene.test) — override only the fields a case exercises.
const frame = (overrides: Partial<ReplayFrame> = {}): ReplayFrame => ({
  x: 0,
  y: 0,
  facing: 1,
  posture: 0,
  attacking: false,
  attackBand: 0,
  guardBand: 0,
  throwing: false,
  knockdown: false,
  points: 0,
  stamina: 100,
  ...overrides,
});

// WORLD_WIDTH / 2 — the ring midpoint the pair is centered on (mirrors scene.ts's world bound).
const WORLD_MID = 300_000;

describe("buildDojoTape — centers two posed fighters on the ring", () => {
  it("places the challenger left and the king right, exactly `gap` sub-units apart, centered", () => {
    const tape = buildDojoTape({
      a: frame({ facing: 1 }),
      b: frame({ facing: -1 }),
      gap: 240_000,
    });

    // One static tick, numbered 0 (a still pose, not an animation).
    expect(tape).toHaveLength(1);
    expect(tape[0].tick).toBe(0);

    // a left of b, exactly `gap` apart, centered on the world midpoint.
    expect(tape[0].a.x).toBe(180_000); // 300000 − 240000/2
    expect(tape[0].b.x).toBe(420_000); // 300000 + 240000/2
    expect(tape[0].b.x - tape[0].a.x).toBe(240_000); // separation == gap
    expect((tape[0].a.x + tape[0].b.x) / 2).toBe(WORLD_MID); // centered on the ring
    expect(tape[0].a.x).toBeLessThan(tape[0].b.x); // challenger is the LEFT fighter
  });

  it("varies the separation with the gap — a narrower gap pulls the pair together symmetrically", () => {
    const near = buildDojoTape({ a: frame(), b: frame(), gap: 100_000 });

    expect(near[0].a.x).toBe(250_000); // 300000 − 50000
    expect(near[0].b.x).toBe(350_000); // 300000 + 50000
    expect(near[0].b.x - near[0].a.x).toBe(100_000);
  });

  it("collapses both fighters onto the midpoint at gap 0", () => {
    const tape = buildDojoTape({ a: frame(), b: frame(), gap: 0 });

    expect(tape[0].a.x).toBe(WORLD_MID);
    expect(tape[0].b.x).toBe(WORLD_MID);
  });

  it("owns the placement — an incoming frame's own x is replaced by the ring centering", () => {
    // The builder derives position from the gap; a control-supplied frame x must NOT leak through.
    const tape = buildDojoTape({
      a: frame({ x: 999 }),
      b: frame({ x: 12_345 }),
      gap: 240_000,
    });

    expect(tape[0].a.x).toBe(180_000);
    expect(tape[0].b.x).toBe(420_000);
  });

  it("preserves every other pose field of the incoming frames unchanged (only x is set)", () => {
    const a = frame({
      facing: 1,
      posture: 1,
      attacking: true,
      attackBand: 3,
      guardBand: 2,
      points: 5,
      stamina: 40,
    });

    const b = frame({ facing: -1, throwing: true, knockdown: true, y: 60_000 });

    const tape = buildDojoTape({ a, b, gap: 200_000 });

    expect(tape[0].a).toEqual({ ...a, x: 200_000 }); // 300000 − 100000
    expect(tape[0].b).toEqual({ ...b, x: 400_000 }); // 300000 + 100000
  });
});

// S2 · Slice 2 — a committed technique plays through its real engine duration. The single static
// tick becomes a span of `startup + active + recovery` ticks, each stamped with the phase the engine
// would be in, so the pose lab shows the technique as a MOVEMENT rather than a frozen contact frame.
const committed = (move: string, overrides: Partial<ReplayFrame> = {}) =>
  frame({
    attacking: true,
    attackMove: move,
    attackBand: 2,
    attackReach: 270_000,
    ...overrides,
  });

describe("buildDojoTape — a committed technique spans its real engine duration (S2 · Slice 2)", () => {
  it("spans mae-geri's full 9/3/16 engine timing — 28 ticks", () => {
    const tape = buildDojoTape({
      a: committed("mae-geri"),
      b: frame(),
      gap: 240_000,
    });

    expect(tape).toHaveLength(28);
  });

  it("stamps the engine's phase on every tick — startup 0-8, active 9-11, recovery 12-27", () => {
    const tape = buildDojoTape({
      a: committed("mae-geri"),
      b: frame(),
      gap: 240_000,
    });

    // Exhaustive, so either boundary shifting by one tick fails here (9 startup, 3 active, 16
    // recovery — mae-geri's engine timing, in order).
    expect(tape.map((t) => t.a.attackPhase)).toEqual([
      ...Array<number>(9).fill(1),
      ...Array<number>(3).fill(2),
      ...Array<number>(16).fill(3),
    ]);
  });

  it("spans the LONGER technique when the two figures differ, phasing each from its own timing", () => {
    // Both figures are posable independently (M10 free combos), so they can carry different moves.
    // ushiro-geri is 13/3/22 = 38 ticks; gyaku-zuki is 7/3/14 = 24.
    const tape = buildDojoTape({
      a: committed("ushiro-geri"),
      b: committed("gyaku-zuki"),
      gap: 240_000,
    });

    expect(tape).toHaveLength(38); // the longer of the two, so both play out in full

    // At the SAME tick the two are in different phases — each read off its own timing, not a
    // shared clock: the slow back kick is still winding up while the punch is already at contact.
    expect(tape[7].a.attackPhase).toBe(1);
    expect(tape[7].b.attackPhase).toBe(2);
  });

  it("spans the KING's technique when the king is the one holding the longer move", () => {
    // The mirror image of the case above. Both figures are posable, so either can own the span —
    // asserting only the challenger's side would let "the tape ignores figure b" pass unnoticed.
    const tape = buildDojoTape({
      a: committed("gyaku-zuki"), // 24 ticks
      b: committed("ushiro-geri"), // 38 ticks — the longer
      gap: 240_000,
    });

    expect(tape).toHaveLength(38);
    expect(tape[30].b.attackPhase).toBe(3); // the king is still recovering...
    expect(tape[30].a.attacking).toBe(false); // ...long after the challenger's punch is spent
  });

  it("drops a figure to idle once its own technique has run out, while the longer one plays on", () => {
    const tape = buildDojoTape({
      a: committed("ushiro-geri"),
      b: committed("gyaku-zuki"),
      gap: 240_000,
    });

    // gyaku-zuki's last tick (index 23) is still recovery; index 24 is past its end.
    expect(tape[23].b.attacking).toBe(true);
    expect(tape[23].b.attackPhase).toBe(3);

    // Spent: the engine would have this fighter idle again, so the tape says so rather than holding
    // the last recovery frame.
    expect(tape[24].b.attacking).toBe(false);
    expect(tape[24].b.attackPhase).toBe(0);

    // ...while the longer technique keeps playing to its own end.
    expect(tape[24].a.attacking).toBe(true);
    expect(tape[37].a.attackPhase).toBe(3);
  });

  // M7 totality: the lab must stay usable for every pose a developer can dial in, including ones the
  // timing mirror knows nothing about. No blank tape, no throw, no phase invented out of thin air.
  it("collapses to a single static tick when neither figure is committed", () => {
    const tape = buildDojoTape({ a: frame(), b: frame(), gap: 240_000 });

    expect(tape).toHaveLength(1);
    expect(tape[0].tick).toBe(0);
    expect(tape[0].a.attackPhase).toBeUndefined(); // nothing committed ⇒ nothing to phase
  });

  it("leaves a figure committed to an unknown move exactly as posed — no duration, no phase", () => {
    // An id with no entry in the timing mirror (a future move, a typo in a hand-edited control).
    const posed = committed("kokoro-nage");

    const tape = buildDojoTape({ a: posed, b: frame(), gap: 240_000 });

    expect(tape).toHaveLength(1); // contributes no duration
    expect(tape[0].a).toEqual({ ...posed, x: 180_000 }); // and is otherwise untouched
    expect(tape[0].a.attacking).toBe(true); // still renders its strike, pre-S2 style
  });

  it("gives every move in the arsenal a playable span — none collapses or runs backwards", () => {
    // Guards the whole table at once: a dropped/zeroed timing field would show up as a 1-tick span.
    const spans = REACH_PRESETS.map(
      (p) =>
        buildDojoTape({ a: committed(p.move), b: frame(), gap: 240_000 })
          .length,
    );

    expect(spans).toEqual([24, 27, 23, 22, 22, 22, 24, 21, 25, 28, 32, 35, 38]);
    expect(Math.min(...spans)).toBeGreaterThan(1);
  });
});

describe("the default dojo scene — challenger mid-band mae-geri vs an idle king, facing off at gyaku distance", () => {
  const defaultTape = () =>
    buildDojoTape({ a: DEFAULT_CHALLENGER, b: DEFAULT_KING, gap: DEFAULT_GAP });

  it("defaults the pair to gyaku-zuki reach (240k) apart", () => {
    expect(DEFAULT_GAP).toBe(240_000);
    expect(defaultTape()[0].b.x - defaultTape()[0].a.x).toBe(240_000);
  });

  it("poses the challenger throwing a clean, standing mid-band strike, facing right", () => {
    const a = defaultTape()[0].a;

    expect(a.attacking).toBe(true);
    expect(a.attackBand).toBe(2); // mid band
    expect(a.attackReach).toBe(270_000); // mae-geri reach
    expect(a.attackMove).toBe("mae-geri"); // the first move with a pose of its own (S1)
    expect(a.facing).toBe(1); // faces the king on its right
    expect(a.posture).toBe(0); // a standing strike — not a crouch
    expect(a.guardBand).toBe(0); // not guarding
    expect(a.knockdown).toBe(false);
    expect(a.throwing).toBe(false);
  });

  it("poses the king fully idle, standing, facing left toward the incoming challenger", () => {
    const b = defaultTape()[0].b;

    expect(b.attacking).toBe(false);
    expect(b.attackBand).toBe(0); // no strike queued
    expect(b.attackReach).toBe(0); // idle — no committed reach
    expect(b.facing).toBe(-1); // faces the challenger on its left
    expect(b.posture).toBe(0); // standing
    expect(b.guardBand).toBe(0); // not guarding
    expect(b.throwing).toBe(false);
    expect(b.knockdown).toBe(false);
  });
});

describe("the default dojo scene renders two fighters through the real scene()/createStage pipeline", () => {
  const VIEWPORT: Viewport = { width: 1200, height: 600 };

  it("mounts two figure roots, positioned apart and facing off, via the shipped projection", () => {
    const tape = buildDojoTape({
      a: DEFAULT_CHALLENGER,
      b: DEFAULT_KING,
      gap: DEFAULT_GAP,
    });

    const stage = createStage(VIEWPORT, ["generic", "generic"]);

    // Tick 8 is mae-geri's LAST startup tick: S8 eases the wind-up from the stance (tick 0) to the
    // authored chamber, reaching it here at the startup→active boundary.
    stage.apply(scene(tape, 8, VIEWPORT));

    // Two distinct roots; centered pair at pxPerSubunit 0.002 → 180000·0.002=360, 420000·0.002=840.
    expect(stage.a.root.x).toBe(360);
    expect(stage.b.root.x).toBe(840);
    expect(stage.a.root.x).toBeLessThan(stage.b.root.x);

    // Both grounded on the ring floor (the ground line sits at 90% of height 600 = 540).
    expect(stage.a.root.y).toBe(540);
    expect(stage.b.root.y).toBe(540);

    // Facing each other: the challenger flips right (+1), the king flips left (−1).
    expect(stage.a.root.scale.x).toBe(1);
    expect(stage.b.root.scale.x).toBe(-1);

    // The default poses render through the pipeline: the challenger throws a mae-geri, so its FOOT is
    // the driven limb while its hand stays at the stance (x 18) — the whole point of the per-move
    // descriptor. By the last startup tick the eased wind-up has reached the authored chamber (x 4),
    // drawn back under the hip rather than out at the target. The idle king keeps both at stance.
    expect(stage.a.footR.x).toBe(s(4));
    expect(stage.a.handR.x).toBe(s(18));
    expect(stage.b.handR.x).toBe(s(18));
    expect(stage.b.footR.x).toBe(s(14));
  });

  it("drives the technique through the real pipeline — the foot eases stance → chamber, then reaches the target at contact", () => {
    // The end-to-end proof of the slice: ONE tape, rendered at three playheads, through the shipped
    // scene()/createStage. Since S8 the dojo shows a MOVEMENT: the foot begins at the stance (the
    // wind-up's start), eases BACK under the hip to the authored chamber by the last startup tick,
    // then drives FORWARD to the target as the contact window opens.
    const tape = buildDojoTape({
      a: DEFAULT_CHALLENGER,
      b: DEFAULT_KING,
      gap: DEFAULT_GAP,
    });

    const stage = createStage(VIEWPORT, ["generic", "generic"]);

    stage.apply(scene(tape, 0, VIEWPORT)); // first startup tick — the wind-up begins at the stance
    const stanced = stage.a.footR.x;

    stage.apply(scene(tape, 8, VIEWPORT)); // last startup tick — eased back to the chamber
    const chambered = stage.a.footR.x;

    stage.apply(scene(tape, 9, VIEWPORT)); // first active tick — mae-geri's contact
    const extended = stage.a.footR.x;

    expect(stanced).toBe(s(14)); // the wind-up starts at the stance foot
    expect(chambered).toBe(s(4)); // drawn back under the hip by the end of the wind-up
    expect(extended).toBe(s(66)); // out on the king's near edge
    expect(chambered).toBeLessThan(stanced); // the wind-up draws the foot BACK
    expect(extended).toBeGreaterThan(chambered); // then the kick travels FORWARD to its target

    // ...and the support foot never moves while it does (M8.2 support integrity).
    expect(stage.a.footL.x).toBe(s(-14));
  });
});
