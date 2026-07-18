import { describe, expect, it } from "vitest";

import { brandsFor, createStage, glyphSvg } from "./figures";
import { scene, type Viewport } from "./scene";
import type {
  Fighter,
  ReplayFrame,
  ReplayTape,
  ReplayTick,
} from "./replay-contract";
import { BRAND_GLYPH, GROK_CANVAS_INK } from "../../shared/lib/brand";

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
  guardBand: 0,
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

    const stage = createStage(VIEWPORT, ["generic", "generic"]);

    stage.apply(scene(tape, 0, VIEWPORT));

    expect(stage.a.root.x).toBe(300);
    expect(stage.a.root.y).toBe(420);
    expect(stage.b.root.x).toBe(900);
    expect(stage.b.root.y).toBe(540);
  });

  it("moves a figure across the screen as the playhead advances", () => {
    const tape: ReplayTape = [
      tickOf(0, { x: 150_000 }, { x: 450_000 }),
      tickOf(30, { x: 300_000 }, { x: 300_000 }),
    ];

    const stage = createStage(VIEWPORT, ["generic", "generic"]);

    stage.apply(scene(tape, 0, VIEWPORT));
    const startX = stage.a.root.x;

    stage.apply(scene(tape, 1, VIEWPORT));

    expect(startX).toBe(300);
    expect(stage.a.root.x).toBe(600);
  });

  it("flips a figure horizontally to reflect its facing", () => {
    const tape: ReplayTape = [tickOf(0, { facing: -1 }, { facing: 1 })];
    const stage = createStage(VIEWPORT, ["generic", "generic"]);

    stage.apply(scene(tape, 0, VIEWPORT));

    expect(stage.a.root.scale.x).toBe(-1);
    expect(stage.b.root.scale.x).toBe(1);
  });

  it("writes the tick and both scores into the HUD text", () => {
    const tape: ReplayTape = [
      { tick: 12, a: frame({ points: 3 }), b: frame({ points: 1 }) },
    ];

    const stage = createStage(VIEWPORT, ["generic", "generic"]);

    stage.apply(scene(tape, 0, VIEWPORT));

    expect(stage.hud.text).toContain("tick 12");
    // Score ORDER (challenger : King) — asserting "3 : 1" (not just both digits) catches a
    // scoreA/scoreB swap, which a bare toContain("3")+toContain("1") would miss.
    expect(stage.hud.text).toMatch(/3\s*:\s*1/);
  });

  it("lowers the head joint display object for a crouching fighter", () => {
    // Applying a crouch scene moves the persistent head joint down (scene-graph state, not pixels).
    const stage = createStage(VIEWPORT, ["generic", "generic"]);

    stage.apply(scene([tickOf(0, { posture: 0 }, {})], 0, VIEWPORT));
    const standHeadY = stage.a.head.y;

    stage.apply(scene([tickOf(0, { posture: 1 }, {})], 0, VIEWPORT));

    expect(standHeadY).toBe(-76);
    expect(stage.a.head.y).toBe(-58);
    expect(stage.a.head.y).toBeGreaterThan(standHeadY); // crouch head sits lower
  });

  it("tucks the foot joint display objects for an airborne fighter", () => {
    const stage = createStage(VIEWPORT, ["generic", "generic"]);

    stage.apply(scene([tickOf(0, { posture: 0 }, {})], 0, VIEWPORT));
    const standFootY = stage.a.footL.y;

    stage.apply(scene([tickOf(0, { posture: 2 }, {})], 0, VIEWPORT));

    expect(standFootY).toBe(0);
    expect(stage.a.footL.y).toBe(-18);
    expect(stage.a.footR.y).toBe(-18);
    expect(stage.a.footL.y).toBeLessThan(standFootY); // tucked up off the ground
  });

  it("extends the striking arm's hand joint for an attacking fighter", () => {
    // Applying a strike scene moves the persistent front-hand joint forward + up to the band
    // height (scene-graph state, not pixels).
    const stage = createStage(VIEWPORT, ["generic", "generic"]);

    stage.apply(scene([tickOf(0, { attacking: false }, {})], 0, VIEWPORT));
    const neutralHandX = stage.a.handR.x;

    stage.apply(
      scene([tickOf(0, { attacking: true, attackBand: 2 }, {})], 0, VIEWPORT),
    );

    expect(neutralHandX).toBe(18);
    expect(stage.a.handR.x).toBe(40);
    expect(stage.a.handR.y).toBe(-46);
    expect(stage.a.handR.x).toBeGreaterThan(neutralHandX); // reached forward
  });

  it("raises the guard arm's hand joint for a guarding fighter", () => {
    // Applying a guard scene swings the persistent rear-hand joint forward + up to the band height.
    const stage = createStage(VIEWPORT, ["generic", "generic"]);

    stage.apply(scene([tickOf(0, { guardBand: 0 }, {})], 0, VIEWPORT));
    const neutralGuardX = stage.a.handL.x;

    stage.apply(scene([tickOf(0, { guardBand: 2 }, {})], 0, VIEWPORT));

    expect(neutralGuardX).toBe(-18);
    expect(stage.a.handL.x).toBe(8);
    expect(stage.a.handL.y).toBe(-46);
    expect(stage.a.handL.x).toBeGreaterThan(neutralGuardX); // swung forward into a guard
  });

  it("reaches both hands forward into a grab for a throwing fighter", () => {
    const stage = createStage(VIEWPORT, ["generic", "generic"]);

    stage.apply(scene([tickOf(0, { throwing: false }, {})], 0, VIEWPORT));
    const neutralL = stage.a.handL.x;
    const neutralR = stage.a.handR.x;

    stage.apply(scene([tickOf(0, { throwing: true }, {})], 0, VIEWPORT));

    expect(neutralL).toBe(-18);
    expect(neutralR).toBe(18);
    expect(stage.a.handL.x).toBe(28);
    expect(stage.a.handR.x).toBe(36);
    expect(stage.a.handL.x).toBeGreaterThan(neutralL); // rear hand swung forward
    expect(stage.a.handR.x).toBeGreaterThan(neutralR); // front hand reached further forward
  });

  it("marks the scoring fighter's HUD score with a pop glyph", () => {
    // A scores at tick 1 (points 0 → 3); at that playhead A's score carries the colourblind-safe
    // marker (a glyph, not hue), while B's stays plain.
    const stage = createStage(VIEWPORT, ["generic", "generic"]);

    const tape: ReplayTape = [
      tickOf(0, { points: 0 }, { points: 0 }),
      tickOf(1, { points: 3 }, { points: 0 }),
    ];

    stage.apply(scene(tape, 1, VIEWPORT));

    expect(stage.hud.text).toContain("★3");
    expect(stage.hud.text).not.toContain("★0"); // B did not score — no marker
  });

  it("marks only the fighter who scored, leaving the other plain", () => {
    const stage = createStage(VIEWPORT, ["generic", "generic"]);

    const tape: ReplayTape = [
      tickOf(0, { points: 0 }, { points: 0 }),
      tickOf(1, { points: 0 }, { points: 2 }),
    ];

    stage.apply(scene(tape, 1, VIEWPORT));

    // B scored → the marker sits on B's score; A's stays a bare digit.
    expect(stage.hud.text).toMatch(/0 : ★2/);
  });

  it("leaves both scores plain when nobody scored in the window", () => {
    // Flat scores across two ticks: no strike, no marker (kills an "always mark" mutant).
    const stage = createStage(VIEWPORT, ["generic", "generic"]);

    const tape: ReplayTape = [
      tickOf(0, { points: 3 }, { points: 1 }),
      tickOf(1, { points: 3 }, { points: 1 }),
    ];

    stage.apply(scene(tape, 1, VIEWPORT));

    expect(stage.hud.text).toMatch(/^tick 1 +3 : 1$/);
    expect(stage.hud.text).not.toContain("★");
  });

  it("lays the joint display objects prone for a knocked-down fighter", () => {
    // Applying a knockdown scene drops the head to the ground line and swings the body horizontal
    // (scene-graph state, not pixels) — the prone override.
    const stage = createStage(VIEWPORT, ["generic", "generic"]);

    stage.apply(scene([tickOf(0, { knockdown: false }, {})], 0, VIEWPORT));
    const standHeadY = stage.a.head.y;

    stage.apply(scene([tickOf(0, { knockdown: true }, {})], 0, VIEWPORT));

    expect(standHeadY).toBe(-76);
    expect(stage.a.head.x).toBe(-40);
    expect(stage.a.head.y).toBe(-10);
    expect(stage.a.head.y).toBeGreaterThan(standHeadY); // head dropped toward the ground
    expect(stage.a.footL.x).toBe(36); // the body extends horizontally to the far end
  });
});

describe("figures — the head is the fighter's brand glyph (no disc)", () => {
  it("tags each fighter's head with its resolved brand", () => {
    const stage = createStage(VIEWPORT, ["claude", "generic"]);

    expect(stage.a.head.label).toBe("claude");
    expect(stage.b.head.label).toBe("generic");
  });

  it("carries each of the five marks independently on the challenger head", () => {
    for (const brand of [
      "claude",
      "openai",
      "gemini",
      "grok",
      "generic",
    ] as const) {
      const stage = createStage(VIEWPORT, [brand, "generic"]);

      expect(stage.a.head.label).toBe(brand);
    }
  });

  it("parses each brand's svg into a non-empty glyph (no blank heads)", () => {
    // The glyph is opaque to display-object assertions, but its bounds are not: a head with a
    // measurable footprint proves Graphics.svg() produced real geometry for every brand — guarding
    // the failure mode where an unsupported element would parse to nothing.
    for (const brand of [
      "claude",
      "openai",
      "gemini",
      "grok",
      "generic",
    ] as const) {
      const stage = createStage(VIEWPORT, [brand, "generic"]);

      expect(stage.a.head.getLocalBounds().width).toBeGreaterThan(0);
      expect(stage.a.head.getLocalBounds().height).toBeGreaterThan(0);
    }
  });

  it("counter-flips the head so the glyph stays upright when the fighter faces left", () => {
    const stage = createStage(VIEWPORT, ["claude", "generic"]);

    stage.apply(scene([tickOf(0, { facing: -1 }, { facing: 1 })], 0, VIEWPORT));

    // The root mirrors the whole figure; the head cancels it, so the glyph reads upright.
    expect(stage.a.root.scale.x).toBe(-1);
    expect(stage.a.head.scale.x).toBe(-1);
    // A right-facing fighter needs no flip on either node.
    expect(stage.b.root.scale.x).toBe(1);
    expect(stage.b.head.scale.x).toBe(1);
  });
});

const fighter = (model: string): Fighter => ({ name: "f", model });

describe("brandsFor — a fighter pair's authoring brands (challenger, King)", () => {
  it("maps each fighter's model to its brand, in challenger-then-King order", () => {
    expect(brandsFor([fighter("Claude Opus 4.8"), fighter("gpt-5")])).toEqual([
      "claude",
      "openai",
    ]);
  });

  it("keeps the pair order so the mark lands on its author (no a/b swap)", () => {
    expect(brandsFor([fighter("grok-2"), fighter("gemini-2.5-pro")])).toEqual([
      "grok",
      "gemini",
    ]);
  });

  it("falls back to generic for an empty or unknown model", () => {
    expect(brandsFor([fighter(""), fighter("who-knows")])).toEqual([
      "generic",
      "generic",
    ]);
  });
});

describe("glyphSvg — canvas-ready brand-glyph markup for Pixi's Graphics.svg()", () => {
  it("wraps the shared glyph geometry in a 24-unit-viewBox svg element", () => {
    expect(glyphSvg("claude")).toContain('viewBox="0 0 24 24"');
    expect(glyphSvg("claude")).toContain(BRAND_GLYPH.claude);
  });

  it("inks Grok's currentColor to an explicit canvas colour (Pixi has no currentColor)", () => {
    const grok = glyphSvg("grok");

    expect(grok).not.toContain("currentColor");
    expect(grok).toContain(GROK_CANVAS_INK);
  });

  it("passes a hued brand's baked colour straight through", () => {
    expect(glyphSvg("gemini")).toContain("#4285f4");
  });
});
