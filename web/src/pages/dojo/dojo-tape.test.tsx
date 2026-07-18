import { describe, expect, it } from "vitest";

import { createStage } from "../replay/figures";
import { BODY_HEIGHT_SUB, scene, type Viewport } from "../replay/scene";
import type { ReplayFrame } from "../replay/replay-contract";
import { buildDojoTape, DEFAULT_CHALLENGER, DEFAULT_KING } from "./dojo-tape";
import { DEFAULT_GAP } from "./reach-presets";

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

describe("the default dojo scene — challenger mid-strike vs an idle king, facing off at gyaku reach", () => {
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

    stage.apply(scene(tape, 0, VIEWPORT));

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

    // The default poses render through the pipeline: the challenger's front hand is thrown to the
    // mid-band strike reach (x 40, world-scaled); the idle king's stays at its neutral stance (x 18).
    expect(stage.a.handR.x).toBe(s(40));
    expect(stage.b.handR.x).toBe(s(18));
  });
});
