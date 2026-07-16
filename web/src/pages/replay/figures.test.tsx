import { describe, expect, it } from "vitest";

import { createStage } from "./figures";
import { scene, type Viewport } from "./scene";
import type { ReplayFrame, ReplayTape, ReplayTick } from "./replay-contract";

// The draw layer is verified by DISPLAY-OBJECT assertions (the plan's Pixi strategy): build the
// scene-graph stage — no renderer, no Application — apply a Scene, and assert the figures'
// positions / flip and the HUD text. Same 1200×600 viewport as scene.test so the pixels line up.
const VIEWPORT: Viewport = { width: 1200, height: 600 };

const frame = (overrides: Partial<ReplayFrame> = {}): ReplayFrame => ({
  x: 150_000,
  y: 0,
  facing: 1,
  posture: 0,
  attacking: false,
  attackBand: 0,
  throwing: false,
  knockdown: false,
  points: 0,
  stamina: 100,
  ...overrides,
});

const tickOf = (
  tick: number,
  a: Partial<ReplayFrame>,
  b: Partial<ReplayFrame>,
): ReplayTick => ({ tick, a: frame(a), b: frame(b) });

describe("figures — the Pixi draw layer applies a Scene to display objects", () => {
  it("positions the two figures at their scene pixels (x and y)", () => {
    // Distinct per-fighter y (a airborne, b grounded) pins the y wiring and catches an a/b swap.
    const tape: ReplayTape = [
      tickOf(0, { x: 150_000, y: 60_000 }, { x: 450_000, y: 0 }),
    ];

    const stage = createStage(VIEWPORT);

    stage.apply(scene(tape, 0, VIEWPORT));

    expect(stage.a.x).toBe(300);
    expect(stage.a.y).toBe(420);
    expect(stage.b.x).toBe(900);
    expect(stage.b.y).toBe(540);
  });

  it("moves a figure across the screen as the playhead advances", () => {
    const tape: ReplayTape = [
      tickOf(0, { x: 150_000 }, { x: 450_000 }),
      tickOf(30, { x: 300_000 }, { x: 300_000 }),
    ];

    const stage = createStage(VIEWPORT);

    stage.apply(scene(tape, 0, VIEWPORT));
    const startX = stage.a.x;

    stage.apply(scene(tape, 1, VIEWPORT));

    expect(startX).toBe(300);
    expect(stage.a.x).toBe(600);
  });

  it("flips a figure horizontally to reflect its facing", () => {
    const tape: ReplayTape = [tickOf(0, { facing: -1 }, { facing: 1 })];
    const stage = createStage(VIEWPORT);

    stage.apply(scene(tape, 0, VIEWPORT));

    expect(stage.a.scale.x).toBe(-1);
    expect(stage.b.scale.x).toBe(1);
  });

  it("writes the tick and both scores into the HUD text", () => {
    const tape: ReplayTape = [
      { tick: 12, a: frame({ points: 3 }), b: frame({ points: 1 }) },
    ];

    const stage = createStage(VIEWPORT);

    stage.apply(scene(tape, 0, VIEWPORT));

    expect(stage.hud.text).toContain("tick 12");
    // Score ORDER (challenger : King) — asserting "3 : 1" (not just both digits) catches a
    // scoreA/scoreB swap, which a bare toContain("3")+toContain("1") would miss.
    expect(stage.hud.text).toMatch(/3\s*:\s*1/);
  });
});
