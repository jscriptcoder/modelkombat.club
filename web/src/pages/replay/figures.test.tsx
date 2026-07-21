import { describe, expect, it } from "vitest";

import {
  BONES,
  brandsFor,
  createContactSheet,
  createStage,
  glyphSvg,
} from "./figures";
import { BODY_HEIGHT_SUB, scene, type Figure, type Viewport } from "./scene";
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

// Story 3 — world scale. The joint display objects carry the scene's world-scaled pose, so the
// reference-frame constants (STAND head at −76, feet at 0, …) render at ×(BODY_HEIGHT_SUB ·
// pxPerSubunit / 76). The scale is uniform, so one `s(n)` scales either axis; recomputed here from
// the documented knob + fixed viewport (not the production scale fn) so a scale mutant is caught.
const BODY_SCALE = (BODY_HEIGHT_SUB * (1200 / 600_000)) / 76;
const s = (n: number) => Math.round(n * BODY_SCALE);

// World sub-units → reference LOCAL px, and the reach-to-target LANDING (scene.ts reachTargetX):
// recomputed from the imported knob so the reach anchors below re-flow on a BODY_HEIGHT_SUB re-tune,
// exactly as scene.test's own helpers do. REF = 76 (STAND head→foot span), half-width 10, floor 24.
const subToLocal = (subunits: number) => (subunits * 76) / BODY_HEIGHT_SUB;

const landingLocal = (gap: number, reach: number) => {
  const cap = subToLocal(reach);
  const floor = Math.min(24, cap);

  return Math.max(floor, Math.min(subToLocal(gap) - 10, cap));
};

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

    expect(standHeadY).toBe(s(-76));
    expect(stage.a.head.y).toBe(s(-58));
    expect(stage.a.head.y).toBeGreaterThan(standHeadY); // crouch head sits lower
  });

  it("tucks the foot joint display objects for an airborne fighter", () => {
    const stage = createStage(VIEWPORT, ["generic", "generic"]);

    stage.apply(scene([tickOf(0, { posture: 0 }, {})], 0, VIEWPORT));
    const standFootY = stage.a.footL.y;

    stage.apply(scene([tickOf(0, { posture: 2 }, {})], 0, VIEWPORT));

    expect(standFootY).toBe(s(0));
    expect(stage.a.footL.y).toBe(s(-18));
    expect(stage.a.footR.y).toBe(s(-18));
    expect(stage.a.footL.y).toBeLessThan(standFootY); // tucked up off the ground
  });

  it("extends the striking arm's hand joint for an attacking fighter", () => {
    // Applying a strike scene moves the persistent front-hand joint forward + up toward the band
    // height (scene-graph state, not pixels). A gyaku-reach strike at gyaku distance lands the hand
    // on the opponent's near edge (landingLocal); the reach maths itself lives in scene.test.
    const stage = createStage(VIEWPORT, ["generic", "generic"]);

    stage.apply(scene([tickOf(0, { attacking: false }, {})], 0, VIEWPORT));
    const neutralHandX = stage.a.handR.x;

    stage.apply(
      scene(
        [
          tickOf(
            0,
            {
              attacking: true,
              attackBand: 2,
              attackReach: 240_000,
              x: 150_000,
            },
            { x: 390_000 },
          ),
        ],
        0,
        VIEWPORT,
      ),
    );

    expect(neutralHandX).toBe(s(18));
    expect(stage.a.handR.x).toBe(s(landingLocal(240_000, 240_000)));
    expect(stage.a.handR.y).toBe(s(-46));
    expect(stage.a.handR.x).toBeGreaterThan(neutralHandX); // reached forward
  });

  it("raises the guard arm's hand joint for a guarding fighter", () => {
    // Applying a guard scene swings the persistent rear-hand joint forward + up to the band height.
    const stage = createStage(VIEWPORT, ["generic", "generic"]);

    stage.apply(scene([tickOf(0, { guardBand: 0 }, {})], 0, VIEWPORT));
    const neutralGuardX = stage.a.handL.x;

    stage.apply(scene([tickOf(0, { guardBand: 2 }, {})], 0, VIEWPORT));

    expect(neutralGuardX).toBe(s(-18));
    expect(stage.a.handL.x).toBe(s(8));
    expect(stage.a.handL.y).toBe(s(-46));
    expect(stage.a.handL.x).toBeGreaterThan(neutralGuardX); // swung forward into a guard
  });

  it("reaches both hands forward into a grab for a throwing fighter", () => {
    // A throwing fighter reaches BOTH grab hands to the opponent's near edge (M8): an in-range throw
    // (gap 120k at reach 120k) lands the lead hand ON the near edge (landingLocal) and the rear hand a
    // GRAB_SPREAD (8) behind — proven through the persistent hand joints the draw layer swings.
    const stage = createStage(VIEWPORT, ["generic", "generic"]);

    stage.apply(scene([tickOf(0, { throwing: false }, {})], 0, VIEWPORT));
    const neutralL = stage.a.handL.x;
    const neutralR = stage.a.handR.x;

    stage.apply(
      scene(
        [
          tickOf(
            0,
            {
              throwing: true,
              attackMove: "throw",
              attackReach: 120_000,
              x: 150_000,
            },
            { x: 270_000 },
          ),
        ],
        0,
        VIEWPORT,
      ),
    );

    expect(neutralL).toBe(s(-18));
    expect(neutralR).toBe(s(18));
    expect(stage.a.handR.x).toBe(s(landingLocal(120_000, 120_000))); // front hand on the opponent's near edge
    expect(stage.a.handL.x).toBe(s(landingLocal(120_000, 120_000) - 8)); // rear hand on the grab, a spread behind the lead
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

    expect(standHeadY).toBe(s(-76));
    expect(stage.a.head.x).toBe(s(-40));
    expect(stage.a.head.y).toBe(s(-10));
    expect(stage.a.head.y).toBeGreaterThan(standHeadY); // head dropped toward the ground
    expect(stage.a.footL.x).toBe(s(36)); // the body extends horizontally to the far end
  });
});

describe("figures — the arm bends at the elbow joint (Story 4 · Slice 1)", () => {
  it("places both fighters' elbow joint nodes at the scene's scaled elbow", () => {
    const stage = createStage(VIEWPORT, ["generic", "generic"]);
    const sc = scene([tickOf(0, {}, {})], 0, VIEWPORT);

    stage.apply(sc);

    // The persistent elbow joints carry the scene's derived elbow (this is the wiring — scene.test
    // pins the geometry). Reading the scene value catches an "elbow placed at the hand" mutant, and
    // asserting both L and R (distinct x-signs) catches an L/R swap.
    expect(stage.a.elbowR.x).toBe(sc.a.pose.elbowR.x);
    expect(stage.a.elbowR.y).toBe(sc.a.pose.elbowR.y);
    expect(stage.a.elbowL.x).toBe(sc.a.pose.elbowL.x);
    expect(stage.a.elbowL.y).toBe(sc.a.pose.elbowL.y);
    expect(stage.b.elbowR.x).toBe(sc.b.pose.elbowR.x);
    expect(stage.b.elbowL.x).toBe(sc.b.pose.elbowL.x);
    // The elbow is genuinely its own joint, not the hand it connects to.
    expect(stage.a.elbowR.x).not.toBe(stage.a.handR.x);
  });
});

describe("figures — the leg bends at the knee joint (Story 4 · Slice 2)", () => {
  it("places both fighters' knee joint nodes at the scene's scaled knee", () => {
    const stage = createStage(VIEWPORT, ["generic", "generic"]);
    const sc = scene([tickOf(0, {}, {})], 0, VIEWPORT);

    stage.apply(sc);

    // The persistent knee joints carry the scene's derived knee (this is the wiring — scene.test
    // pins the geometry). Reading the scene value catches a "knee placed at the foot" mutant, and
    // asserting both L and R (distinct x-signs) catches an L/R swap.
    expect(stage.a.kneeR.x).toBe(sc.a.pose.kneeR.x);
    expect(stage.a.kneeR.y).toBe(sc.a.pose.kneeR.y);
    expect(stage.a.kneeL.x).toBe(sc.a.pose.kneeL.x);
    expect(stage.a.kneeL.y).toBe(sc.a.pose.kneeL.y);
    expect(stage.b.kneeR.x).toBe(sc.b.pose.kneeR.x);
    expect(stage.b.kneeL.x).toBe(sc.b.pose.kneeL.x);
    // The knee is genuinely its own joint, not the foot it connects to.
    expect(stage.a.kneeR.x).not.toBe(stage.a.footR.x);
  });
});

describe("figures — the arms hang from a shoulder girdle (S4 · Slice 4)", () => {
  it("places both fighters' shoulder joint nodes at the scene's girdle ends", () => {
    const stage = createStage(VIEWPORT, ["generic", "generic"]);
    const sc = scene([tickOf(0, {}, {})], 0, VIEWPORT);

    stage.apply(sc);

    // The wiring, same discipline as the elbow and knee joints — scene.test pins the geometry.
    // Asserting both ends (distinct x-signs about the midpoint) catches an L/R swap, and comparing
    // against the midpoint catches a girdle that was derived but never wired through to the draw
    // layer, which would leave both arms visibly hanging off the spine as before.
    expect(stage.a.shoulderL.x).toBe(sc.a.pose.shoulderL.x);
    expect(stage.a.shoulderL.y).toBe(sc.a.pose.shoulderL.y);
    expect(stage.a.shoulderR.x).toBe(sc.a.pose.shoulderR.x);
    expect(stage.a.shoulderR.y).toBe(sc.a.pose.shoulderR.y);
    expect(stage.b.shoulderL.x).toBe(sc.b.pose.shoulderL.x);
    expect(stage.b.shoulderR.x).toBe(sc.b.pose.shoulderR.x);
    // Each end is genuinely its own joint, off the midpoint the spine still terminates at.
    expect(stage.a.shoulderL.x).toBeLessThan(stage.a.shoulder.x);
    expect(stage.a.shoulderR.x).toBeGreaterThan(stage.a.shoulder.x);
  });
});

describe("figures — the drawn skeleton hangs off the girdle (S4 · Slice 4)", () => {
  // The bones are stroked into a `Graphics` path, which display-object assertions cannot see, so
  // re-rooting an arm to the midpoint or dropping the girdle bar is invisible to every other test in
  // this file — both survived the mutation scan while being plainly visible on screen. Asserting the
  // wiring table directly is what closes that gap.
  const joins = (a: string, b: string) =>
    BONES.some(
      ([from, to]) => (from === a && to === b) || (from === b && to === a),
    );

  it("joins the two girdle ends and hangs each arm off its own end", () => {
    expect(joins("shoulderL", "shoulderR")).toBe(true);
    expect(joins("shoulderL", "elbowL")).toBe(true);
    expect(joins("shoulderR", "elbowR")).toBe(true);
  });

  it("keeps the spine on the midpoint and hangs no arm from it", () => {
    // `shoulder` is the girdle's midpoint: the spine's top, and nothing else. An arm still drawn from
    // it would start 7px away from the elbow it derives against — a visibly broken limb.
    expect(joins("hip", "shoulder")).toBe(true);
    expect(joins("shoulder", "elbowL")).toBe(false);
    expect(joins("shoulder", "elbowR")).toBe(false);
  });

  it("leaves every bone connected to a real skeleton joint", () => {
    // A typo'd key would silently stroke from `undefined` and blank the whole figure.
    const sc = scene([tickOf(0, {}, {})], 0, VIEWPORT);

    for (const [from, to] of BONES) {
      expect(sc.a.pose[from]).toBeDefined();
      expect(sc.a.pose[to]).toBeDefined();
    }
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

// Story 3 · Slice 2 — the head glyph scales to 0.3× the world-scaled body height, so the brand mark
// grows WITH the big body instead of staying a fixed dot. The 24-unit glyph geometry is scaled by
// (0.3 · BODY_HEIGHT_SUB · pxPerSubunit) / 24; recomputed here from the documented ratio + knob +
// literal viewport (NOT the production helper) so a ratio / size / viewport-dependence mutant is
// caught. Same operation order as production so the floats are bit-identical under `toBe`.
const HEAD_HEIGHT_RATIO = 0.3;

const headGlyphScale = (width: number): number =>
  (HEAD_HEIGHT_RATIO * (BODY_HEIGHT_SUB * (width / 600_000))) / 24;

describe("figures — the head glyph scales to 0.3× the body height (Story 3 · Slice 2)", () => {
  it("sizes the head glyph to 0.3× the world-scaled body height, not a fixed dot", () => {
    const stage = createStage(VIEWPORT, ["claude", "generic"]);

    // The glyph is the head container's sole child; its uniform scale expresses head px box / 24.
    const glyphA = stage.a.head.children[0];
    const glyphB = stage.b.head.children[0];

    // 1200-wide viewport: 0.3 × (210k × 0.002 = 420px body) = 126px head → scale 126/24 = 5.25.
    expect(glyphA.scale.x).toBe(5.25);
    expect(glyphA.scale.x).toBe(headGlyphScale(1200));
    expect(glyphA.scale.y).toBe(headGlyphScale(1200)); // uniform on both axes
    expect(glyphB.scale.x).toBe(5.25); // BOTH fighters sized, not just the challenger

    // The head box is exactly 0.3 × the rendered STAND body span (s(76) = 420px) — a fixed
    // proportion of the SAME height knob the body scales from, so the two grow together.
    expect(glyphA.scale.x * 24).toBe(0.3 * s(76));
  });

  it("grows the head glyph with the viewport (scales by pxPerSubunit, not a fixed px box)", () => {
    const wide = createStage({ width: 2400, height: 600 }, [
      "claude",
      "generic",
    ]);

    const narrow = createStage({ width: 600, height: 600 }, [
      "claude",
      "generic",
    ]);

    // Doubling the viewport doubles the head box (5.25 → 10.5); halving halves it (5.25 → 2.625).
    expect(wide.a.head.children[0].scale.x).toBe(10.5);
    expect(wide.a.head.children[0].scale.x).toBe(headGlyphScale(2400));
    expect(narrow.a.head.children[0].scale.x).toBe(2.625);
    expect(narrow.a.head.children[0].scale.x).toBe(headGlyphScale(600));

    // Linear in viewport width — a fixed-px head (dropping pxPerSubunit) would be equal, not 2×.
    expect(wide.a.head.children[0].scale.x).toBe(2 * headGlyphScale(1200));
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

// S7 — the contact sheet: many figures laid out in a labelled grid on ONE canvas. Same draw-layer
// discipline as createStage — build the scene-graph (no renderer, no Application), assert the display
// objects: each cell's label text, the pose drawn into its joints, and the grid slot it lands in.
const posedFigure = (): Figure =>
  scene(
    [
      tickOf(
        0,
        { attacking: true, attackBand: 2, attackReach: 240_000, x: 150_000 },
        { x: 390_000 },
      ),
    ],
    0,
    VIEWPORT,
  ).a;

const CELL_INPUT = (id: string) => ({ id, placement: posedFigure() });

const SHEET_LAYOUT = { cols: 2, cellWidth: 300, cellHeight: 320, headPx: 40 };

describe("createContactSheet — a labelled grid of figures on one canvas (S7)", () => {
  it("labels each cell with its own move id", () => {
    const sheet = createContactSheet(
      [CELL_INPUT("empi"), CELL_INPUT("mawashi-geri"), CELL_INPUT("throw")],
      SHEET_LAYOUT,
    );

    // Per-cell id — not a constant, not off-by-one. A shared label or a shifted index shows here.
    expect(sheet.cells.map((c) => c.label.text)).toEqual([
      "empi",
      "mawashi-geri",
      "throw",
    ]);
  });

  it("draws each cell's pose into its figure joints", () => {
    // The placement's pose is applied to the persistent joint nodes (the wiring — the geometry is
    // pinned in scene.test). A cell that ignored its placement would leave the joints at the origin.
    const placement = posedFigure();
    const sheet = createContactSheet([{ id: "empi", placement }], SHEET_LAYOUT);

    expect(sheet.cells[0].nodes.footR.x).toBe(placement.pose.footR.x);
    expect(sheet.cells[0].nodes.handR.x).toBe(placement.pose.handR.x);
  });

  it("lays the cells out in a grid — columns advance, then wrap to the next row", () => {
    const sheet = createContactSheet(
      [CELL_INPUT("a"), CELL_INPUT("b"), CELL_INPUT("c")],
      SHEET_LAYOUT,
    );

    const [c0, c1, c2] = sheet.cells;

    // cols = 2: cell 1 sits to the RIGHT of cell 0 on the same row; cell 2 wraps DOWN to the next row,
    // back at column 0. Catches a stacked-at-origin layout, a transposed grid, and an off-by-one wrap.
    expect(c1.nodes.root.x).toBeGreaterThan(c0.nodes.root.x);
    expect(c1.nodes.root.y).toBe(c0.nodes.root.y);
    expect(c2.nodes.root.y).toBeGreaterThan(c0.nodes.root.y);
    expect(c2.nodes.root.x).toBe(c0.nodes.root.x);
  });

  it("mounts one figure per cell — the attacker alone, no opponent", () => {
    // createStage draws a PAIR (a + b); a contact-sheet cell shows the attacker only. One figure root
    // plus one label per cell ⇒ exactly two display objects per cell on the sheet root.
    const cells = [CELL_INPUT("a"), CELL_INPUT("b"), CELL_INPUT("c")];
    const sheet = createContactSheet(cells, SHEET_LAYOUT);

    expect(sheet.root.children.length).toBe(2 * cells.length);
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

  it("keeps Grok's ring hollow — no colour-filled group for Pixi to flood the ring with", () => {
    // Grok is a hollow ring + a filled slash. Pixi's Graphics.svg() inherits a <g fill> onto its
    // children and overrides a child's own fill="none" (Story 2 gotcha), so a COLOUR fill on the
    // wrapping group floods the fill=none ring into a solid disc on the canvas (correct in the DOM,
    // wrong in Pixi). Guard: the group Pixi parses carries no colour fill — fill="none" (or none at
    // all) — while the slash <path> sets its own fill. Assert on glyphSvg (the exact post-ink string
    // Pixi receives), so the group's fill is either absent or "none", never the ink colour.
    const grok = glyphSvg("grok");
    const groupFill = grok.match(/<g[^>]*\bfill="([^"]*)"/);

    expect(groupFill?.[1] ?? "none").toBe("none");
    // The slash is still explicitly inked (a filled streak), and the ring is a stroked circle.
    expect(grok).toContain(`<path`);
    expect(grok).toContain(`stroke="${GROK_CANVAS_INK}"`);
  });
});

describe("figures — the impact flash draws where a fighter scored (Slice 2)", () => {
  // Challenger `a` lands an in-range mid gyaku and scores at `scoreAt`, then goes idle — the same
  // shape scene.test uses, so the flash rides scene()'s `contact` mark.
  const aStrike = (points: number): Partial<ReplayFrame> => ({
    attacking: true,
    attackBand: 2,
    attackReach: 240_000,
    attackPhase: 2,
    x: 150_000,
    facing: 1,
    points,
  });

  const scoreThenIdle = (scoreAt: number, len: number): ReplayTape =>
    Array.from({ length: len }, (_, i) =>
      i < scoreAt
        ? tickOf(i, aStrike(0), { x: 390_000 })
        : i === scoreAt
          ? tickOf(i, aStrike(3), { x: 390_000 })
          : tickOf(i, { x: 150_000, facing: 1, points: 3 }, { x: 390_000 }),
    );

  it("shows the flash at the scene's contact point when a fighter scores", () => {
    const tape = scoreThenIdle(3, 6);
    const stage = createStage(VIEWPORT, ["generic", "generic"]);
    const sc = scene(tape, 3, VIEWPORT);

    stage.apply(sc);

    expect(sc.contact.a).not.toBeNull();
    expect(stage.flashes.a.visible).toBe(true);
    expect({ x: stage.flashes.a.x, y: stage.flashes.a.y }).toEqual({
      x: sc.contact.a?.x,
      y: sc.contact.a?.y,
    });
    // The opponent did not score, so their flash stays hidden.
    expect(stage.flashes.b.visible).toBe(false);
  });

  it("fades the flash as it ages — a later tick draws it dimmer", () => {
    const tape = scoreThenIdle(3, 20);
    const stage = createStage(VIEWPORT, ["generic", "generic"]);

    stage.apply(scene(tape, 3, VIEWPORT)); // age 0
    const fresh = stage.flashes.a.alpha;

    stage.apply(scene(tape, 13, VIEWPORT)); // age 10, still inside the window
    const aged = stage.flashes.a.alpha;

    expect(fresh).toBeGreaterThan(aged);
    expect(aged).toBeGreaterThan(0);
  });

  it("clears the flash when the scene carries no contact for that side", () => {
    const tape = scoreThenIdle(3, 6);
    const stage = createStage(VIEWPORT, ["generic", "generic"]);

    stage.apply(scene(tape, 3, VIEWPORT)); // scored → shown
    expect(stage.flashes.a.visible).toBe(true);

    stage.apply(scene(tape, 1, VIEWPORT)); // before the score → cleared
    expect(stage.flashes.a.visible).toBe(false);
  });

  it("draws both flashes on a same-tick trade, each at its own scorer's point", () => {
    const bStrike = (points: number): Partial<ReplayFrame> => ({
      attacking: true,
      attackBand: 2,
      attackReach: 240_000,
      attackPhase: 2,
      x: 390_000,
      facing: -1,
      points,
    });

    const tape: ReplayTape = [
      tickOf(0, aStrike(0), bStrike(0)),
      tickOf(1, aStrike(0), bStrike(0)),
      tickOf(2, aStrike(3), bStrike(3)),
    ];

    const stage = createStage(VIEWPORT, ["generic", "generic"]);
    const sc = scene(tape, 2, VIEWPORT);

    stage.apply(sc);

    expect(stage.flashes.a.visible).toBe(true);
    expect(stage.flashes.b.visible).toBe(true);
    expect(stage.flashes.a.x).toBe(sc.contact.a?.x);
    expect(stage.flashes.b.x).toBe(sc.contact.b?.x);
  });
});
