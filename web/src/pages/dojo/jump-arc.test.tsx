import { describe, expect, it } from "vitest";

import {
  GRAVITY,
  JUMP_IMPULSE,
  JUMP_X_SPEED,
  jumpArc,
  jumpTravelAt,
} from "./jump-arc";

// jump-arc.ts mirrors the engine's jump physics (src/engine/rules.ts) the same way reach-presets.ts
// mirrors move reaches: web/src cannot import src/, so the three constants are transcribed and the
// arc is INTEGRATED from them here rather than stored as a literal sequence. web/ is not
// Stryker-reachable, so these value-by-value assertions stand in for mutation coverage.
//
// "Integrated, not a table" is the one property no assertion here can prove on its own — with the
// real constants both implementations agree. It is proven by the manual mutator scan instead: perturb
// GRAVITY or JUMP_IMPULSE and the documented sequence below must break. A stored array would survive.

describe("jump physics — the engine's constants, transcribed value-by-value", () => {
  it("mirrors jumpImpulse / gravity / jumpXSpeed", () => {
    expect([JUMP_IMPULSE, GRAVITY, JUMP_X_SPEED]).toEqual([
      12_000, 4_000, 10_000,
    ]);
  });
});

describe("jumpArc — the deterministic integer parabola one jump traces", () => {
  it("reproduces the arc rules.ts documents", () => {
    // rules.ts: "jumpImpulse 12000 / gravity 4000 yields the deterministic integer parabola
    // 12000, 20000, 24000, 24000, 20000, 12000, 0". That prose lists the ticks AFTER launch; the arc
    // here leads with the grounded launch tick so a tape can index it by tick directly.
    expect(jumpArc().slice(1)).toEqual([
      12_000, 20_000, 24_000, 24_000, 20_000, 12_000, 0,
    ]);
    expect(jumpArc()).toEqual([
      0, 12_000, 20_000, 24_000, 24_000, 20_000, 12_000, 0,
    ]);
  });

  it("launches and lands on the ground with a single held apex between", () => {
    const arc = jumpArc();

    expect(arc[0]).toBe(0); // grounded at launch
    expect(arc[arc.length - 1]).toBe(0); // back to EXACTLY 0 — never below, never short
    expect(Math.min(...arc)).toBe(0); // the jumper never sinks through the floor
    expect(Math.max(...arc)).toBe(24_000); // the apex
    expect(arc.filter((y) => y === 24_000)).toHaveLength(2); // held for two ticks
    expect(arc.filter((y) => y > 0)).toHaveLength(6); // six airborne ticks
  });

  it("rises and falls symmetrically about the apex", () => {
    // A constant-gravity parabola launched from and returning to the ground is its own mirror image.
    // An arc truncated a tick early, or one that never quite lands, breaks the symmetry.
    const arc = jumpArc();

    expect(arc).toEqual([...arc].reverse());
  });
});

describe("jumpTravelAt — how far a jump-IN has closed by a given tick", () => {
  it("closes jumpXSpeed per AIRBORNE tick, then freezes on touchdown", () => {
    // The leap carries the jumper forward only while its feet are off the ground; once it lands the
    // preview holds position rather than sliding on forever.
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 20].map(jumpTravelAt)).toEqual([
      0, 10_000, 20_000, 30_000, 40_000, 50_000, 60_000, 60_000, 60_000, 60_000,
    ]);
  });

  it("closes over the whole flight the ~60000 rules.ts credits the leap with", () => {
    // rules.ts: "Over the ~6 airborne ticks it closes ~60000, enough to bring the moderate-reach
    // tobi-geri (250000) into range". The mirror has to land on that number or the jump-in stops
    // being the thing that supplies the closing.
    expect(jumpTravelAt(Number.MAX_SAFE_INTEGER)).toBe(60_000);
  });
});
