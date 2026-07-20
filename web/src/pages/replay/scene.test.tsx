import { describe, expect, it } from "vitest";

import {
  BODY_HEIGHT_SUB,
  scene,
  SHOULDER_HALF_WIDTH,
  type Joint,
  type Scene,
  type Viewport,
} from "./scene";
import { DESCRIBED_MOVES } from "./move-descriptors";
import { REACH_PRESETS } from "../dojo/reach-presets";
import type { ReplayFrame, ReplayTape, ReplayTick } from "./replay-contract";

// A 1200×600 viewport makes the world→screen maths land on whole pixels: the world is 600000
// sub-units wide (mirrors the engine ring), so pxPerSubunit = 1200 / 600000 = 0.002. The opening
// stances (challenger 150000, King 450000) therefore map to 300 and 900; the ground line sits at
// 90% of height = 540. Every expected number below is derived from those two facts.
const VIEWPORT: Viewport = { width: 1200, height: 600 };

// Story 3 — world scale. The body is authored in a reference frame whose head-to-foot span is 76px
// (STAND: head at −76, feet at 0); the projection scales it so that span becomes the height knob
// projected to screen, i.e. BODY_HEIGHT_SUB · pxPerSubunit. At the test viewport that is
// 240000 · 0.002 = 480px, so every reference coordinate renders at ×(480/76), rounded to whole px.
// BODY_SCALE is recomputed here from the documented knob + fixed viewport (NOT from the production
// scale fn), so a scale-formula mutant makes production disagree with these `scaled(...)` expectations
// while a deliberate knob re-tune re-flows them (only the literal-480 magnitude tests above pin the
// knob itself).
const BODY_SCALE = (BODY_HEIGHT_SUB * (1200 / 600_000)) / 76;

const scaled = (joint: { x: number; y: number }) => ({
  x: Math.round(joint.x * BODY_SCALE),
  y: Math.round(joint.y * BODY_SCALE),
});

// A complete render frame with neutral defaults — override only the fields a case exercises.
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

describe("scene — the pure tape → screen projection", () => {
  it("maps each fighter's world X to a screen pixel at the opening tick", () => {
    const tape: ReplayTape = [
      tickOf(0, { x: 150_000, facing: 1 }, { x: 450_000, facing: 1 }),
    ];

    const result: Scene = scene(tape, 0, VIEWPORT);

    expect(result.a.x).toBe(300);
    expect(result.b.x).toBe(900);
  });

  it("passes each fighter's facing through unchanged", () => {
    // A crossed tick: the challenger has moved to the King's right, so it now faces LEFT (-1)
    // while the King faces right (+1). scene must report the frame's facing verbatim — the Pixi
    // layer turns it into a horizontal flip.
    const tape: ReplayTape = [
      tickOf(40, { x: 450_000, facing: -1 }, { x: 150_000, facing: 1 }),
    ];

    const result = scene(tape, 0, VIEWPORT);

    expect(result.a.facing).toBe(-1);
    expect(result.b.facing).toBe(1);
    // ...and the crossed positions still map (a now right of b).
    expect(result.a.x).toBe(900);
    expect(result.b.x).toBe(300);
  });

  it("stands a grounded fighter on the ground line and lifts an airborne one", () => {
    // worldY 0 → the ground line (540); worldY 60000 → 540 − 60000·0.002 = 420 (up the screen).
    const tape: ReplayTape = [tickOf(5, { y: 60_000 }, { y: 0 })];

    const result = scene(tape, 0, VIEWPORT);

    expect(result.a.y).toBe(420);
    expect(result.b.y).toBe(540);
  });

  it("reads the HUD tick and both scores from the playhead frame", () => {
    const tape: ReplayTape = [
      tickOf(0, {}, {}),
      { tick: 12, a: frame({ points: 3 }), b: frame({ points: 1 }) },
    ];

    const result = scene(tape, 1, VIEWPORT);

    expect(result.hud).toEqual(
      expect.objectContaining({ tick: 12, scoreA: 3, scoreB: 1 }),
    );
  });

  it("clamps a playhead past the last tick to the final frame", () => {
    const tape: ReplayTape = [
      tickOf(0, { x: 150_000 }, { x: 450_000 }),
      {
        tick: 20,
        a: frame({ x: 300_000, points: 5 }),
        b: frame({ x: 300_000, points: 2 }),
      },
    ];

    const result = scene(tape, 99, VIEWPORT);

    expect(result.hud).toEqual(
      expect.objectContaining({ tick: 20, scoreA: 5, scoreB: 2 }),
    );
    expect(result.a.x).toBe(600); // 300000 · 0.002
  });

  it("clamps a negative playhead to the first frame", () => {
    const tape: ReplayTape = [
      tickOf(0, { x: 150_000 }, { x: 450_000 }),
      { tick: 20, a: frame({ x: 300_000 }), b: frame({ x: 300_000 }) },
    ];

    const result = scene(tape, -3, VIEWPORT);

    expect(result.hud.tick).toBe(0);
    expect(result.a.x).toBe(300);
  });
});

describe("scene — world-scaled body (Story 3)", () => {
  // The body is defined in world sub-units and projected by the SAME pxPerSubunit that positions
  // the fighter, so it grows with the ring instead of staying a fixed ~76px. At the test viewport
  // (1200 wide, pxPerSubunit = 1200/600000 = 0.002) the height knob BODY_HEIGHT_SUB = 240000
  // sub-units projects to 240000 · 0.002 = 480px tall. Every expected number below is derived from
  // those documented facts, not from the production scale — so a scale mutant is caught.
  const poseAt = (posture: number, viewport: Viewport = VIEWPORT) =>
    scene([tickOf(0, { posture }, {})], 0, viewport).a.pose;

  it("scales a standing body to the world height knob, not a fixed ~76px", () => {
    const pose = poseAt(0);

    // Head-to-foot span is the projected knob height (240000 · 0.002 = 480), a big fighter.
    expect(pose.footL.y - pose.head.y).toBe(480);
    expect(pose.head).toEqual({ x: 0, y: -480 });
    // Feet stay planted on the local ground line (y 0) at any scale.
    expect(pose.footL.y).toBe(0);
    expect(pose.footR.y).toBe(0);
  });

  it("scales the body linearly with pxPerSubunit — double the viewport, double the body", () => {
    const small = poseAt(0, { width: 1200, height: 600 });
    const big = poseAt(0, { width: 2400, height: 600 });

    const spanOf = (p: typeof small) => p.footL.y - p.head.y;

    expect(spanOf(small)).toBe(480); // 240000 · (1200/600000)
    expect(spanOf(big)).toBe(960); // 240000 · (2400/600000) — exactly twice
  });
});

describe("scene — stance geometry by posture", () => {
  // The pose is a skeleton of local joints (feet at the local ground line y=0, up is negative),
  // carried on `Figure.pose`. The container position/facing (S1) still places the whole figure;
  // these joints add the body articulation the draw layer strokes.
  const poseAt = (posture: number) =>
    scene([tickOf(0, { posture }, {})], 0, VIEWPORT).a.pose;

  it("stands upright at posture 0 — head at the top, feet on the local ground line", () => {
    const pose = poseAt(0);

    expect(pose.head).toEqual(scaled({ x: 0, y: -76 }));
    expect(pose.shoulder).toEqual(scaled({ x: 0, y: -64 }));
    expect(pose.hip).toEqual(scaled({ x: 0, y: -34 }));
    expect(pose.footL).toEqual(scaled({ x: -14, y: 0 }));
    expect(pose.footR).toEqual(scaled({ x: 14, y: 0 }));
  });

  it("crouches lower than a stand — the upper body drops while the feet stay planted", () => {
    const stand = poseAt(0);
    const crouch = poseAt(1);

    // Every upper joint sits lower on screen (larger local y, since up is negative).
    expect(crouch.head.y).toBeGreaterThan(stand.head.y);
    expect(crouch.shoulder.y).toBeGreaterThan(stand.shoulder.y);
    expect(crouch.hip.y).toBeGreaterThan(stand.hip.y);
    // Exact drop distances (pins the geometry against off-by mutants), now world-scaled.
    expect(crouch.head).toEqual(scaled({ x: 0, y: -58 }));
    expect(crouch.hip).toEqual(scaled({ x: 0, y: -22 }));
    // Feet stay on the ground line (y 0), planted a touch wider.
    expect(crouch.footL).toEqual(scaled({ x: -16, y: 0 }));
    expect(crouch.footR).toEqual(scaled({ x: 16, y: 0 }));
  });

  it("tucks the legs for an airborne fighter while the upper body holds", () => {
    const stand = poseAt(0);
    const air = poseAt(2);

    // Feet lift toward the hip (tucked), distinct from the planted stand feet.
    expect(air.footL.y).toBeLessThan(stand.footL.y);
    expect(air.footR.y).toBeLessThan(stand.footR.y);
    expect(air.footL).toEqual(scaled({ x: -10, y: -18 }));
    expect(air.footR).toEqual(scaled({ x: 10, y: -18 }));
    // The upper body is unchanged from the stand — only the legs tuck.
    expect(air.head).toEqual(stand.head);
    expect(air.hip).toEqual(stand.hip);
  });

  it("falls back to the standing stance for an unrecognized posture code", () => {
    // Our engine only emits 0/1/2, but the derivation is total: an odd code renders a safe stand.
    const odd = poseAt(9);

    expect(odd).toEqual(poseAt(0));
    expect(odd.head).toEqual(scaled({ x: 0, y: -76 })); // a real stand, not an empty/garbage pose
  });
});

describe("scene — strike reach-to-target", () => {
  // A committed strike AIMS its front arm (handR) at the OPPONENT's near body edge, clamped to the
  // move's true reach — not a fixed forward stub (Story 5). The reach is viewport-independent in
  // LOCAL px: the reference body is 76px tall (STAND: head −76, feet 0) and that height is projected
  // to BODY_HEIGHT_SUB (240k) world sub-units, so one sub-unit is exactly 76/240000 local px — a
  // world gap of 240k is one body height (76 local px) between centres. The near edge is one body
  // half-width (10) nearer, so an in-range gyaku strike lands at 76 − 10 = 66; the reach clamps to
  // [STRIKE_FLOOR_X (24), attackReach·(76/240000)]. The y is the band height (low −24 / mid −46 /
  // high −68), unchanged. Every expected x below is that physical anchor, recomputed independently
  // of the production formula. Reach is a fixed LOCAL direction (+x forward); the container flip
  // (S1 facing) turns it on-screen — the geometry never reads facing itself.
  const STRIKE_FLOOR_X = 24; // point-blank floor (a minimal forward technique), mirrors scene.ts
  const NEUTRAL_HAND = { x: 18, y: -44 }; // the STAND front hand (the no-reach fallback)

  // Striker `a` faces right at x 150000; the opponent `b` sits `gap` sub-units away (front = +gap,
  // behind = −gap) with the striker committing a `band` strike of world `reach`. Returns a's pose.
  const poseStriking = ({
    gap,
    band = 2,
    reach = 240_000,
    extra = {},
  }: {
    gap: number;
    band?: number;
    reach?: number;
    extra?: Partial<ReplayFrame>;
  }) =>
    scene(
      [
        tickOf(
          0,
          {
            attacking: true,
            attackBand: band,
            attackReach: reach,
            x: 150_000,
            facing: 1,
            ...extra,
          },
          { x: 150_000 + gap },
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

  it("lands the front hand on the opponent's near edge when in range", () => {
    // gyaku gap (240k) at gyaku reach (240k): the centres are 76 local px apart (one body height),
    // the near edge one BODY_HALF_WIDTH nearer ⇒ the fist lands at 76 − 10 = 66 local px forward.
    const handR = poseStriking({ gap: 240_000, band: 2 }).handR;

    expect(handR).toEqual(scaled({ x: 66, y: -46 }));
    // ...and it lands ON the near edge, short of the opponent's centre (76), not through it.
    expect(handR.x).toBeLessThan(scaled({ x: 76, y: 0 }).x);
  });

  it("aims by the facing — a left-facing striker lands on an opponent to its LEFT", () => {
    // Reach is a fixed LOCAL +x direction; the striker's facing decides which way that maps in the
    // world. A left-facer (facing −1) with the opponent one gyaku gap to its LEFT reaches the SAME
    // local landing (66) — the container flip turns it leftward on screen. Kills a "drop facing" or
    // facing-sign mutant that all the facing-right cases miss.
    const pose = scene(
      [
        tickOf(
          0,
          {
            attacking: true,
            attackBand: 2,
            attackReach: 240_000,
            x: 400_000,
            facing: -1,
          },
          { x: 160_000 }, // 240k to the striker's left = in front of a left-facer
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

    expect(pose.handR).toEqual(scaled({ x: 66, y: -46 }));
  });

  it("keeps the striking hand at its stance pose when attackReach is exactly 0 (idle value)", () => {
    // reach 0 is the idle sentinel — a committed strike carrying it (⇒ no reach) keeps the stance
    // hand, distinct from a positive reach. Pins the `> 0` boundary (kills a `>= 0` mutant that would
    // let a 0-reach strike solve to the shoulder).
    expect(poseStriking({ gap: 240_000, reach: 0 }).handR).toEqual(
      scaled(NEUTRAL_HAND),
    );
  });

  it("keeps the striking hand at its stance pose for a non-numeric (NaN) reach (defensive)", () => {
    // A NaN from a malformed wire is rejected like an absent reach — the guard never lets a NaN reach
    // the maths and produce a NaN joint (M7).
    expect(poseStriking({ gap: 240_000, reach: NaN }).handR).toEqual(
      scaled(NEUTRAL_HAND),
    );
  });

  it("carries the strike to whichever band it targets — low, mid, high", () => {
    // The reach x is the same in-range landing (66); the y is the band ladder, ascending up-screen.
    expect(poseStriking({ gap: 240_000, band: 1 }).handR).toEqual(
      scaled({ x: 66, y: -24 }),
    );
    expect(poseStriking({ gap: 240_000, band: 2 }).handR).toEqual(
      scaled({ x: 66, y: -46 }),
    );
    expect(poseStriking({ gap: 240_000, band: 3 }).handR).toEqual(
      scaled({ x: 66, y: -68 }),
    );
  });

  it("stops the hand short at the reach cap when the opponent is beyond reach (a whiff)", () => {
    // Opponent at ushiro distance (330k) but only a gyaku reach (240k): the near edge is 94.5 local
    // px away, past the cap of 240k·(76/240000) = 76 — the hand stops at 76, short of the surface.
    const handR = poseStriking({ gap: 330_000, band: 2, reach: 240_000 }).handR;

    expect(handR).toEqual(scaled({ x: 76, y: -46 }));
    // The in-range landing would have been 66; a whiff extends FURTHER (to the cap) yet still short.
    expect(handR.x).toBeGreaterThan(poseStriking({ gap: 240_000 }).handR.x);
  });

  it("shows the forward floor when the fighters overlap — never reaches backward", () => {
    // gap 0: the near edge is behind the shoulder (−10 local px). The clamp floors the reach at the
    // point-blank STRIKE_FLOOR_X ⇒ a minimal forward technique, never a backward (−x) arm.
    const handR = poseStriking({ gap: 0, band: 2 }).handR;

    expect(handR).toEqual(scaled({ x: STRIKE_FLOOR_X, y: -46 }));
    expect(handR.x).toBeGreaterThan(0);
  });

  it("shows the forward floor when the opponent is behind the facing (never NaN, never backward)", () => {
    // Striker faces RIGHT but the opponent is to its LEFT: the in-front distance is negative, so the
    // reach floors forward — the hand never swings toward −x, and the maths never divides to a NaN.
    const handR = poseStriking({ gap: -100_000, band: 2 }).handR;

    expect(handR).toEqual(scaled({ x: STRIKE_FLOOR_X, y: -46 }));
    expect(Number.isNaN(handR.x)).toBe(false);
  });

  it("never reaches past its own attackReach cap, even point-blank (short move)", () => {
    // A reach whose whole projection (60000·76/240000 = 19 local px) is SHORTER than the floor:
    // point-blank, the hand stops at the cap (19), not the floor (24) — reach bounds the floor.
    const handR = poseStriking({ gap: 0, band: 2, reach: 60_000 }).handR;

    expect(handR).toEqual(scaled({ x: 19, y: -46 }));
    expect(handR.x).toBeLessThan(scaled({ x: STRIKE_FLOOR_X, y: 0 }).x);
  });

  it("keeps the striking hand at its stance pose when attackReach is absent (defensive → 0)", () => {
    // A malformed wire frame with NO attackReach field at all ⇒ treated as 0 ⇒ no reach ⇒ the hand
    // stays at the stance neutral pose, exactly as an idle fighter (M7). The frame factory omits
    // attackReach, so this is the genuinely-absent wire (in range at 240k, so a reach WOULD land).
    const pose = scene(
      [
        tickOf(
          0,
          { attacking: true, attackBand: 2, x: 150_000, facing: 1 },
          { x: 390_000 },
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

    expect(pose.handR).toEqual(scaled(NEUTRAL_HAND));
  });

  it("keeps the striking hand at its stance pose when attackReach is negative (defensive → 0)", () => {
    expect(poseStriking({ gap: 240_000, reach: -5 }).handR).toEqual(
      scaled(NEUTRAL_HAND),
    );
  });

  it("leaves the front hand neutral when not attacking, even with a stale band and reach", () => {
    // The `attacking` flag is the gate, not the band: an idle fighter carrying a non-zero band +
    // reach must not throw a phantom strike (kills the "drop the attacking gate" mutant).
    const pose = scene(
      [
        tickOf(
          0,
          { attacking: false, attackBand: 2, attackReach: 240_000 },
          { x: 390_000 },
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

    expect(pose.handR).toEqual(scaled(NEUTRAL_HAND));
  });

  it("does not extend when attacking with a zero band", () => {
    expect(poseStriking({ gap: 240_000, band: 0 }).handR).toEqual(
      scaled(NEUTRAL_HAND),
    );
  });

  it("does not extend for an out-of-range attack band (total fallback)", () => {
    expect(poseStriking({ gap: 240_000, band: 9 }).handR).toEqual(
      scaled(NEUTRAL_HAND),
    );
  });

  it("draws both the airborne stance and the strike for an air attack", () => {
    const pose = poseStriking({ gap: 240_000, band: 2, extra: { posture: 2 } });

    // The air stance still tucks the legs...
    expect(pose.footL).toEqual(scaled({ x: -10, y: -18 }));
    expect(pose.footR).toEqual(scaled({ x: 10, y: -18 }));
    // ...while the strike lands the front hand on the near edge on the same tick.
    expect(pose.handR).toEqual(scaled({ x: 66, y: -46 }));
  });

  it("is a pure function of the frame — a backward scrub re-lands the same hand", () => {
    const tape: ReplayTape = [
      tickOf(
        0,
        { attacking: true, attackBand: 2, attackReach: 240_000, x: 150_000 },
        { x: 390_000 },
      ),
      tickOf(1, {}, {}),
    ];

    const atStrike = scene(tape, 0, VIEWPORT).a.pose.handR;

    scene(tape, 1, VIEWPORT); // advance...
    const backAgain = scene(tape, 0, VIEWPORT).a.pose.handR; // ...then scrub back

    expect(backAgain).toEqual(atStrike);
    expect(backAgain).toEqual(scaled({ x: 66, y: -46 }));
  });

  // ─── M2 lean: a committed strike leans the upper body INTO the reach ──────────────────────────────
  // The arm doesn't reach alone: the upper body (head + shoulder) shifts FORWARD a capped amount toward
  // the target — a lunge — so a long reach reads as a committed step-in, not one over-stretched arm,
  // while the hand keeps its target (the arm "telescopes" for the remainder). The lean is a viewer-only
  // cosmetic: the fighter's ROOT x (its truthful world position from the tape) never moves — only the
  // local pose leans. The lower body (hip + both feet) stays planted; the girdle ROTATES into the
  // strike — the driving shoulder swings forward the full lean while the midpoint + head follow HALF
  // (S4 · Slice 5) — so the driven arm's elbow re-derives off its moved shoulder. The shift is a fixed
  // LOCAL +x direction (the container flip carries facing) and a pure function of the frame. Lean = the
  // derived shortfall past the arm's straight reach, capped (S4 · Slice 3); LEAN_CAP is that
  // driving-shoulder cap, and these midpoint assertions carry half of it.
  const LEAN_CAP = 16;

  it("shifts the striking head + shoulder forward while the hand keeps its target (telescope)", () => {
    // In-range front-hand strike: the hand still lands at 66, but the upper body rotates INTO it — the
    // driving shoulder swings the capped 16 forward while the midpoint + head follow HALF that (8,
    // S4 · Slice 5) — so the arm spans a natural distance instead of stretching from a planted shoulder.
    const pose = poseStriking({ gap: 240_000, band: 2 });

    expect(pose.shoulder).toEqual(scaled({ x: LEAN_CAP / 2, y: -64 }));
    expect(pose.head).toEqual(scaled({ x: LEAN_CAP / 2, y: -76 }));
    expect(pose.handR).toEqual(scaled({ x: 66, y: -46 })); // target unchanged — the arm telescopes
  });

  it("keeps the LOWER body planted while the upper body leans", () => {
    // Only the upper body leans (M2): the hip and both feet are untouched — the lunge pivots from a
    // planted base. This also pinned the rear hand as untouched, which S4 · Slice 3 deliberately
    // changed: that hand hangs off the shoulder the lean moves, so leaving it planted stretched the
    // resting arm past its own bones. It now rides, and where it lands is asserted in that block.
    const pose = poseStriking({ gap: 240_000, band: 2 });

    expect(pose.hip).toEqual(scaled({ x: 0, y: -34 }));
    expect(pose.footL).toEqual(scaled({ x: -14, y: 0 }));
    expect(pose.footR).toEqual(scaled({ x: 14, y: 0 }));
  });

  it("leans further the further it must reach, capped — and not at all point-blank", () => {
    // Point-blank the hand floors at 24, which at the mid band is 30 from the shoulder — inside the
    // arm's own 31.3 reach, so there is nothing for the body to cover. The old proportional rule leaned
    // 12 here regardless (min(16, 24 × 0.5)); S4 · Slice 3 made the lean the DERIVED shortfall, so a
    // punch the arm can already land no longer lunges. The monotone, bounded claim is unchanged.
    const pointBlank = poseStriking({ gap: 0, band: 2 });
    // A whiff extends the hand to its 76px cap — 78 from the shoulder, far past the arm — so the body
    // covers the maximum it is allowed to.
    const whiff = poseStriking({ gap: 330_000, band: 2 });

    expect(pointBlank.shoulder).toEqual(scaled({ x: 0, y: -64 }));
    expect(whiff.shoulder).toEqual(scaled({ x: LEAN_CAP / 2, y: -64 }));
    // The shorter reach leans less than the longer (capped) one — a monotone, bounded lunge.
    expect(pointBlank.shoulder.x).toBeLessThan(whiff.shoulder.x);
  });

  it("does not lean when the fighter is not committing a strike", () => {
    // An idle fighter (no reach to draw) keeps its upright stance — the lean is strike-only, gated on
    // the same "is there a strike hand" condition as the reach itself.
    const idle = scene([tickOf(0, {}, {})], 0, VIEWPORT).a.pose;

    expect(idle.shoulder).toEqual(scaled({ x: 0, y: -64 }));
    expect(idle.head).toEqual(scaled({ x: 0, y: -76 }));
  });

  it("leans by the facing-local forward direction — a left-facer leans the same local +x", () => {
    // The lean is a fixed LOCAL +x shift (the container flip turns it on screen), so a left-facing
    // striker's midpoint leans to the same local x as a right-facer. Kills a "lean by facing sign" mutant.
    const pose = scene(
      [
        tickOf(
          0,
          {
            attacking: true,
            attackBand: 2,
            attackReach: 240_000,
            x: 400_000,
            facing: -1,
          },
          { x: 160_000 }, // one gyaku gap to the striker's LEFT = in front of a left-facer
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

    expect(pose.shoulder).toEqual(scaled({ x: LEAN_CAP / 2, y: -64 }));
  });

  it("keeps the fighter's root x truthful — the lean shifts the pose, not the world position", () => {
    // M2's headline guarantee: the forward lean is cosmetic. A striker and an idle fighter at the SAME
    // world x render at the SAME root x; only the leaning striker's local pose differs.
    const striking = scene(
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

    const idle = scene([tickOf(0, { x: 150_000 }, {})], 0, VIEWPORT).a;

    expect(striking.x).toBe(300); // 150000 × 0.002 — the truthful world position
    expect(striking.x).toBe(idle.x); // the lean did not move the root
    expect(striking.pose.shoulder.x).not.toBe(idle.pose.shoulder.x); // ...only the pose leaned
  });

  it("leans as a pure function of the frame — a backward scrub re-leans the same shoulder", () => {
    const tape: ReplayTape = [
      tickOf(
        0,
        { attacking: true, attackBand: 2, attackReach: 240_000, x: 150_000 },
        { x: 390_000 },
      ),
      tickOf(1, {}, {}),
    ];

    const atStrike = scene(tape, 0, VIEWPORT).a.pose.shoulder;

    scene(tape, 1, VIEWPORT); // advance...
    const backAgain = scene(tape, 0, VIEWPORT).a.pose.shoulder; // ...then scrub back

    expect(backAgain).toEqual(atStrike);
    expect(backAgain).toEqual(scaled({ x: LEAN_CAP / 2, y: -64 }));
  });
});

describe("scene — guard raised to the incoming band", () => {
  // A guarding fighter raises its guard arm (handL, the free rear hand) to the incoming band
  // height — the same low/mid/high ladder as a strike, but a MODEST forward reach (x 8, protective)
  // vs the strike's committed x 40. `guardBand` is itself the gate: 0 = not guarding, so no separate
  // flag. Neutral rear hand: { x: -18, y: -44 } (the STAND handL).
  const NEUTRAL_GUARD_HAND = { x: -18, y: -44 };

  const poseGuarding = (guardBand: number, extra: Partial<ReplayFrame> = {}) =>
    scene([tickOf(0, { guardBand, ...extra }, {})], 0, VIEWPORT).a.pose;

  it("raises the guard arm to the low band height", () => {
    expect(poseGuarding(1).handL).toEqual(scaled({ x: 8, y: -24 }));
  });

  it("raises the guard arm to the mid band height", () => {
    expect(poseGuarding(2).handL).toEqual(scaled({ x: 8, y: -46 }));
  });

  it("raises the guard arm to the high band height", () => {
    expect(poseGuarding(3).handL).toEqual(scaled({ x: 8, y: -68 }));
  });

  it("stacks the three guard bands as distinct heights ascending up the screen", () => {
    const low = poseGuarding(1).handL.y;
    const mid = poseGuarding(2).handL.y;
    const high = poseGuarding(3).handL.y;

    expect(low).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(high);
  });

  it("leaves the guard arm neutral when not guarding (guardBand 0)", () => {
    expect(poseGuarding(0).handL).toEqual(scaled(NEUTRAL_GUARD_HAND));
  });

  it("leaves the guard arm neutral for an out-of-range guard band", () => {
    expect(poseGuarding(9).handL).toEqual(scaled(NEUTRAL_GUARD_HAND));
  });

  it("guards independently of stance — the guard composes with a crouch", () => {
    // Guard height is driven by guardBand, not posture: a crouching fighter can still raise a guard.
    const pose = poseGuarding(2, { posture: 1 });

    // Guard raised to mid...
    expect(pose.handL).toEqual(scaled({ x: 8, y: -46 }));
    // ...while the CROUCH stance survives (feet planted a touch wider, head dropped).
    expect(pose.footL).toEqual(scaled({ x: -16, y: 0 }));
    expect(pose.head).toEqual(scaled({ x: 0, y: -58 }));
  });
});

describe("scene — throw grab reaches the opponent (M8)", () => {
  // A throwing fighter reaches BOTH grab hands to the OPPONENT's near body edge at chest height, using
  // the frame's attackReach (= the engine's throw.reach) — the SAME reach-to-target solve as a strike
  // (M8), so a grab lands on the opponent instead of grabbing air. The front hand (handR) leads ONTO
  // the near edge; the rear hand (handL) closes a hand's-width (GRAB_SPREAD 8) behind it, so two arms
  // read as a two-handed grab. Chest height is a fixed GRAB_Y (−44), no band. The reach is viewport-
  // independent LOCAL px (one sub-unit = 76/240000), the near edge one BODY_HALF_WIDTH (10) short of
  // the opponent's centre, the reach clamped to [STRIKE_FLOOR_X (24), attackReach·(76/240000)] —
  // identical machinery to the strike, so a whiff stops short and an overlap floors forward. Every
  // expected x is that physical anchor, recomputed independently of the production formula. Reach is a
  // fixed LOCAL +x direction; the container flip (S1 facing) turns it on-screen.
  const GRAB_Y = -44;
  const GRAB_SPREAD = 8;
  const STRIKE_FLOOR_X = 24; // point-blank floor, shared with the strike
  const NEUTRAL_HANDS = { handL: { x: -18, y: -44 }, handR: { x: 18, y: -44 } }; // the STAND hands

  // Thrower `a` faces right at x 150000; the opponent `b` sits `gap` sub-units away (front = +gap,
  // behind = −gap) with the thrower committing a throw of world `reach` (≈ the engine's throw.reach).
  // Returns a's pose.
  const poseThrowing = ({
    gap = 120_000,
    reach = 120_000,
    extra = {},
  }: {
    gap?: number;
    reach?: number;
    extra?: Partial<ReplayFrame>;
  } = {}) =>
    scene(
      [
        tickOf(
          0,
          {
            throwing: true,
            attackReach: reach,
            x: 150_000,
            facing: 1,
            ...extra,
          },
          { x: 150_000 + gap },
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

  it("lands both grab hands on the opponent's near edge when in range", () => {
    // Throw gap (120k) at throw reach (120k): the centres are 38 local px apart, the near edge one
    // BODY_HALF_WIDTH nearer ⇒ the lead hand lands at 38 − 10 = 28; the rear hand closes 8 behind.
    const pose = poseThrowing({ gap: 120_000, reach: 120_000 });

    expect(pose.handR).toEqual(scaled({ x: 28, y: GRAB_Y })); // lead hand ON the near edge
    expect(pose.handL).toEqual(scaled({ x: 28 - GRAB_SPREAD, y: GRAB_Y })); // rear hand a spread behind
    // ...and the lead hand lands SHORT of the opponent's centre (38), not through it.
    expect(pose.handR.x).toBeLessThan(scaled({ x: 38, y: 0 }).x);
  });

  it("aims by the facing — a left-facing thrower grabs an opponent to its LEFT", () => {
    // The grab reach is a fixed LOCAL +x direction; the thrower's facing decides which way it maps in
    // the world. A left-facer (facing −1) with the opponent one gyaku gap (240k) to its LEFT reaches
    // the SAME local landing (66) as a right-facer — the container flip turns it leftward. Kills a
    // facing-sign / "drop facing" mutant.
    const pose = scene(
      [
        tickOf(
          0,
          { throwing: true, attackReach: 240_000, x: 400_000, facing: -1 },
          { x: 160_000 }, // 240k to the thrower's left = in front of a left-facer
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

    expect(pose.handR).toEqual(scaled({ x: 66, y: GRAB_Y }));
    expect(pose.handL).toEqual(scaled({ x: 66 - GRAB_SPREAD, y: GRAB_Y }));
  });

  it("stops both hands short at the reach cap when the opponent is beyond reach (a whiff)", () => {
    // Opponent at a gyaku distance (240k) but only a throw reach (120k): the near edge is 66 local px
    // away, past the cap of 120k·(76/240000) = 38 — both hands stop at 38, short of the surface.
    const pose = poseThrowing({ gap: 240_000, reach: 120_000 });

    expect(pose.handR).toEqual(scaled({ x: 38, y: GRAB_Y }));
    expect(pose.handL).toEqual(scaled({ x: 38 - GRAB_SPREAD, y: GRAB_Y }));
    // The in-range lead landing would be 28; a whiff extends FURTHER (to the cap) yet still short.
    expect(pose.handR.x).toBeGreaterThan(
      poseThrowing({ gap: 120_000, reach: 120_000 }).handR.x,
    );
  });

  it("shows the forward floor when the fighters overlap — never grabs backward", () => {
    // gap 0: the near edge is behind the shoulder (−10 local px). The clamp floors both hands at the
    // point-blank STRIKE_FLOOR_X ⇒ a minimal forward grab, never a backward (−x) reach.
    const pose = poseThrowing({ gap: 0, reach: 120_000 });

    expect(pose.handR).toEqual(scaled({ x: STRIKE_FLOOR_X, y: GRAB_Y }));
    expect(pose.handL).toEqual(
      scaled({ x: STRIKE_FLOOR_X - GRAB_SPREAD, y: GRAB_Y }),
    );
    expect(pose.handR.x).toBeGreaterThan(0);
    expect(pose.handL.x).toBeGreaterThan(0);
  });

  it("shows the forward floor when the opponent is behind the facing (never NaN, never backward)", () => {
    // Thrower faces RIGHT but the opponent is to its LEFT: the in-front distance is negative, so both
    // hands floor forward — the grab never swings toward −x, and the maths never divides to a NaN.
    const pose = poseThrowing({ gap: -100_000, reach: 120_000 });

    expect(pose.handR).toEqual(scaled({ x: STRIKE_FLOOR_X, y: GRAB_Y }));
    expect(Number.isNaN(pose.handR.x)).toBe(false);
    expect(pose.handR.x).toBeGreaterThan(0);
  });

  it("keeps the hands at their neutral stance when not throwing", () => {
    // The `throwing` flag is the gate: an idle fighter carrying a stale reach must not throw a phantom
    // grab (kills the "drop the throwing gate" mutant).
    const pose = scene(
      [tickOf(0, { throwing: false, attackReach: 120_000 }, { x: 270_000 })],
      0,
      VIEWPORT,
    ).a.pose;

    expect(pose.handL).toEqual(scaled(NEUTRAL_HANDS.handL));
    expect(pose.handR).toEqual(scaled(NEUTRAL_HANDS.handR));
  });

  it("keeps the hands at their stance when attackReach is exactly 0 (idle value)", () => {
    // reach 0 is the idle sentinel — a throw carrying it (⇒ no reach) keeps the stance hands, the M7
    // idle fallback (as the strike does). Pins the `> 0` boundary (kills a `>= 0` mutant).
    const pose = poseThrowing({ gap: 120_000, reach: 0 });

    expect(pose.handL).toEqual(scaled(NEUTRAL_HANDS.handL));
    expect(pose.handR).toEqual(scaled(NEUTRAL_HANDS.handR));
  });

  it("keeps the hands at their stance for a NaN or absent reach (defensive → M7)", () => {
    // A NaN or an absent attackReach from a malformed wire is rejected like reach 0 — the guard never
    // lets it reach the maths and produce a NaN joint. Absent: the frame factory omits attackReach.
    const nan = poseThrowing({ gap: 120_000, reach: NaN });

    const absent = scene(
      [tickOf(0, { throwing: true, x: 150_000 }, { x: 270_000 })],
      0,
      VIEWPORT,
    ).a.pose;

    expect(nan.handR).toEqual(scaled(NEUTRAL_HANDS.handR));
    expect(absent.handR).toEqual(scaled(NEUTRAL_HANDS.handR));
    expect(absent.handL).toEqual(scaled(NEUTRAL_HANDS.handL));
  });

  it("keeps the hands at their stance for a negative reach (defensive → M7)", () => {
    const pose = poseThrowing({ gap: 120_000, reach: -5 });

    expect(pose.handR).toEqual(scaled(NEUTRAL_HANDS.handR));
    expect(pose.handL).toEqual(scaled(NEUTRAL_HANDS.handL));
  });

  it("shows a grab distinct from a strike — the rear hand comes forward too", () => {
    // A strike leaves the rear hand back at the stance (x < 0); a grab brings BOTH hands forward.
    const grab = poseThrowing({ gap: 120_000, reach: 120_000 });

    const strike = scene(
      [
        tickOf(
          0,
          { attacking: true, attackBand: 2, attackReach: 120_000, x: 150_000 },
          { x: 270_000 },
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

    expect(strike.handL.x).toBeLessThan(0);
    expect(grab.handL.x).toBeGreaterThan(0);
  });

  it("wins over a strike and a guard — the grab is applied last", () => {
    // A frame both throwing AND striking AND guarding (the engine never emits this, but /dojo can):
    // the grab overrides BOTH hands, so both land at the grab height (−44), not the strike band (−46)
    // or the guard reach. Pins the throw's last-applied precedence.
    const pose = poseThrowing({
      gap: 120_000,
      reach: 120_000,
      extra: { attacking: true, attackBand: 2, guardBand: 3 },
    });

    expect(pose.handR).toEqual(scaled({ x: 28, y: GRAB_Y })); // grab, not the strike (would be y −46)
    expect(pose.handL).toEqual(scaled({ x: 28 - GRAB_SPREAD, y: GRAB_Y })); // grab, not the guard
  });

  it("composes with the crouch stance — the grab reaches while the crouch feet stay planted", () => {
    const pose = poseThrowing({
      gap: 120_000,
      reach: 120_000,
      extra: { posture: 1 },
    });

    // Both hands reach the grab...
    expect(pose.handR).toEqual(scaled({ x: 28, y: GRAB_Y }));
    expect(pose.handL).toEqual(scaled({ x: 28 - GRAB_SPREAD, y: GRAB_Y }));
    // ...while the CROUCH stance survives (feet planted a touch wider).
    expect(pose.footL).toEqual(scaled({ x: -16, y: 0 }));
  });

  it("is a pure function of the frame — a backward scrub re-lands the same grab", () => {
    const tape: ReplayTape = [
      tickOf(
        0,
        { throwing: true, attackReach: 120_000, x: 150_000 },
        { x: 270_000 },
      ),
      tickOf(1, {}, {}),
    ];

    const atThrow = scene(tape, 0, VIEWPORT).a.pose.handR;

    scene(tape, 1, VIEWPORT); // advance...
    const backAgain = scene(tape, 0, VIEWPORT).a.pose.handR; // ...then scrub back

    expect(backAgain).toEqual(atThrow);
    expect(backAgain).toEqual(scaled({ x: 28, y: GRAB_Y }));
  });
});

describe("scene — knockdown prone pose and wake-up", () => {
  // A knocked-down fighter is drawn PRONE: the whole body laid horizontal near the ground line —
  // the spine flat at y -10, the head at one end (x -40) and the feet at the far end (x 36). This
  // is a FULL-BODY override applied FIRST (an early return in poseFor), so it supersedes every
  // stance and action layer — a downed fighter is never also striking or throwing. When the flag
  // clears the next tick the fighter returns to its stance: the wake-up.
  const PRONE = {
    head: { x: -40, y: -10 },
    shoulder: { x: -24, y: -10 },
    hip: { x: 6, y: -10 },
    handL: { x: -20, y: -2 },
    handR: { x: -20, y: -18 },
    footL: { x: 36, y: -6 },
    footR: { x: 36, y: -14 },
    // A downed body reshapes everything, so PRONE AUTHORS its own mid-joints (Story 4) rather than
    // running the upright bend rule — the arms lie splayed by the shoulder, the legs straight toward
    // the feet end (each knee the midpoint of hip→foot, not the upright forward bow).
    elbowL: { x: -22, y: -6 },
    elbowR: { x: -22, y: -14 },
    kneeL: { x: 21, y: -8 },
    kneeR: { x: 21, y: -12 },
    // ...and from S4 · Slice 4, its own shoulder girdle — COLLAPSED onto the one authored shoulder
    // point (M12g). A downed body has no girdle to twist, and spreading one here would be the only
    // way this slice could change a knockdown, so the coincidence is the assertion.
    shoulderL: { x: -24, y: -10 },
    shoulderR: { x: -24, y: -10 },
  };

  // The prone body world-scaled the same way as every other pose (each authored joint ×BODY_SCALE).
  // Kept as an EXHAUSTIVE expectation rather than an objectContaining: "a knockdown renders exactly
  // as it did before" is the guarantee, so a joint appearing that this list does not name should
  // fail here — which is precisely what caught the girdle when it was first derived unconditionally.
  const SCALED_PRONE = {
    head: scaled(PRONE.head),
    shoulder: scaled(PRONE.shoulder),
    hip: scaled(PRONE.hip),
    handL: scaled(PRONE.handL),
    handR: scaled(PRONE.handR),
    footL: scaled(PRONE.footL),
    footR: scaled(PRONE.footR),
    shoulderL: scaled(PRONE.shoulderL),
    shoulderR: scaled(PRONE.shoulderR),
    elbowL: scaled(PRONE.elbowL),
    elbowR: scaled(PRONE.elbowR),
    kneeL: scaled(PRONE.kneeL),
    kneeR: scaled(PRONE.kneeR),
  };

  const poseDowned = (extra: Partial<ReplayFrame> = {}) =>
    scene([tickOf(0, { knockdown: true, ...extra }, {})], 0, VIEWPORT).a.pose;

  it("lays the whole body prone when knocked down", () => {
    expect(poseDowned()).toEqual(SCALED_PRONE);
  });

  it("lowers and rotates the body versus a standing fighter", () => {
    const stand = scene([tickOf(0, {}, {})], 0, VIEWPORT).a.pose;
    const prone = poseDowned();

    // The head drops toward the ground (larger y = lower on screen) instead of standing tall.
    expect(prone.head.y).toBeGreaterThan(stand.head.y);
    // The spine goes horizontal — head and hip share a y (a flat body) where a stand separates them.
    expect(prone.head.y).toBe(prone.hip.y);
    expect(stand.head.y).not.toBe(stand.hip.y);
    // ...and the head is displaced along x (rotated off the vertical axis a stand holds at x 0).
    expect(prone.head.x).not.toBe(prone.hip.x);
    expect(stand.head.x).toBe(stand.hip.x);
  });

  it("overrides a strike — a downed fighter is not also striking", () => {
    // knockdown:true with a live, IN-RANGE attack on the same tick still renders prone; the front
    // hand stays prone, NOT reached toward the opponent (kills a "compose knockdown with the action
    // layers" mutant). The attack carries a real reach + an in-range opponent, so a composed strike
    // WOULD land forward — proving the early return, not an absent reach, is what suppresses it.
    const pose = scene(
      [
        tickOf(
          0,
          {
            knockdown: true,
            attacking: true,
            attackBand: 3,
            attackReach: 240_000,
            x: 150_000,
          },
          { x: 390_000 },
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

    expect(pose).toEqual(SCALED_PRONE);
    expect(pose.handR).toEqual(scaled(PRONE.handR)); // the prone hand, not a forward strike landing
  });

  it("overrides a throw — prone wins over the grab that is otherwise applied last", () => {
    // knockdown:true with a live, IN-RANGE throw on the same tick still renders prone (the early
    // return), NOT a forward grab. The throw carries a real reach + an in-range opponent, so a composed
    // grab WOULD land forward — proving the early return, not an absent reach, is what suppresses it.
    const pose = scene(
      [
        tickOf(
          0,
          {
            knockdown: true,
            throwing: true,
            attackReach: 120_000,
            x: 150_000,
          },
          { x: 270_000 },
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

    expect(pose).toEqual(SCALED_PRONE);
    expect(pose.handL).toEqual(scaled(PRONE.handL)); // the prone hand, not a forward grab
  });

  it("wakes up — returns to the standing stance the tick knockdown clears", () => {
    const tape: ReplayTape = [
      tickOf(0, { knockdown: true }, {}),
      tickOf(1, { knockdown: false }, {}),
    ];

    const downed = scene(tape, 0, VIEWPORT).a.pose;
    const woken = scene(tape, 1, VIEWPORT).a.pose;

    expect(downed.head).toEqual(scaled({ x: -40, y: -10 })); // prone at the knockdown tick
    expect(woken.head).toEqual(scaled({ x: 0, y: -76 })); // upright stand the next tick — wake-up
  });

  it("leaves a standing fighter unaffected when not knocked down", () => {
    // knockdown is the gate — an idle fighter is a normal stand (kills an "always prone" mutant).
    const pose = scene([tickOf(0, { knockdown: false }, {})], 0, VIEWPORT).a
      .pose;

    expect(pose.head).toEqual(scaled({ x: 0, y: -76 }));
    expect(pose.footL).toEqual(scaled({ x: -14, y: 0 }));
  });
});

describe("scene — arms bend at the elbow (Story 4 · Slice 1)", () => {
  // The arm is a 2-bone limb shoulder→elbow→hand. The elbow is DERIVED from the two endpoints (no
  // authored constant): both bones hold a FIXED length, so the elbow sits on the perpendicular
  // bisector of shoulder→hand, offset toward the BACK (−x local) by however much the bones' slack
  // allows. poseFor never reads facing — the container flip (applyFigure) carries it — so the bow is
  // a fixed local direction that reads correctly for both facings. Lengths are authored in local px,
  // so Story 3's scalePose scales them with the body. bendBack is recomputed here from the documented
  // rule (NOT the production fn) so a formula / sign / magnitude mutant makes production disagree
  // with these expectations.
  //
  // S2 · Slice 3 changed this rule: the offset was a CONSTANT 8px, which made the bones stretch with
  // the endpoint span. The bone length is now the invariant and the offset is solved from it. The two
  // agree exactly at the STAND span — which is why the stance expectations below are untouched — and
  // diverge for every pose that moves an endpoint.
  const ELBOW_BEND = 8;
  const ARM_BONE = Math.hypot(Math.hypot(18, 20) / 2, ELBOW_BEND);

  const bendBack = (
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const offset = Math.sqrt(Math.max(0, ARM_BONE ** 2 - (len / 2) ** 2));
    const perpX = -dy / len;
    const perpY = dx / len;
    const flip = perpX > 0 ? -1 : 1; // force the bow backward (−x local)

    return {
      x: (from.x + to.x) / 2 + perpX * flip * offset,
      y: (from.y + to.y) / 2 + perpY * flip * offset,
    };
  };

  const scaledElbow = (
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) => scaled(bendBack(from, to));

  // S4 · Slice 4 moved each arm's ROOT: an arm now hangs from its own end of the shoulder girdle
  // rather than from the midpoint `shoulder`. The rule these tests assert is unchanged — an elbow
  // bows back off the straight root→hand line — so only the root they measure from moves. Written
  // against the imported constant, so re-tuning the girdle re-flows these expectations rather than
  // breaking them; the girdle's MAGNITUDE is pinned by its own literal-floor test in the slice-4
  // block, which is what keeps a zero-width mutant from surviving here.
  const armRoot = (
    shoulder: { x: number; y: number },
    side: "L" | "R",
  ): { x: number; y: number } => ({
    x: shoulder.x + (side === "R" ? SHOULDER_HALF_WIDTH : -SHOULDER_HALF_WIDTH),
    y: shoulder.y,
  });

  const poseAt = (posture: number) =>
    scene([tickOf(0, { posture }, {})], 0, VIEWPORT).a.pose;

  it("bends the front arm — the elbow sits off the straight shoulder→hand line", () => {
    const pose = poseAt(0);

    // STAND: front shoulder (7,-64) → front hand (18,-44).
    expect(pose.elbowR).toEqual(
      scaledElbow(armRoot({ x: 0, y: -64 }, "R"), { x: 18, y: -44 }),
    );
    // ...and it bows BACKWARD: the elbow sits behind the straight-line midpoint of that span — a
    // formula-independent check that kills a bow-sign flip.
    expect(pose.elbowR.x).toBeLessThan(
      scaled({ x: (armRoot({ x: 0, y: -64 }, "R").x + 18) / 2, y: 0 }).x,
    );
  });

  it("bends the rear arm at the elbow too", () => {
    // STAND: rear shoulder (-7,-64) → rear hand (-18,-44).
    expect(poseAt(0).elbowL).toEqual(
      scaledElbow(armRoot({ x: 0, y: -64 }, "L"), { x: -18, y: -44 }),
    );
  });

  it("re-derives the elbow from a thrown strike hand (the bend follows the technique)", () => {
    // A mid strike lands handR on the opponent's near edge (66,-46) at gyaku distance AND rotates the
    // girdle: the driving FRONT shoulder swings the capped 16 forward to x 23 (stance +7 plus the lean,
    // S4 · Slice 5), and the elbow re-derives from there → the moved hand.
    const pose = scene(
      [
        tickOf(
          0,
          { attacking: true, attackBand: 2, attackReach: 240_000, x: 150_000 },
          { x: 390_000 },
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

    expect(pose.elbowR).toEqual(
      scaledElbow({ x: 23, y: -64 }, { x: 66, y: -46 }),
    );
    // ...distinct from the resting-stance elbow (proves it tracked the hand, not a fixed value).
    expect(pose.elbowR).not.toEqual(
      scaledElbow(armRoot({ x: 0, y: -64 }, "R"), { x: 18, y: -44 }),
    );
  });

  it("derives bent elbows for the crouch and air stances (stance-agnostic)", () => {
    // CROUCH: shoulder (0,-46) → handR (18,-30). AIR upper body = STAND. The girdle is derived from
    // whichever stance is in play, so both get one without either authoring it.
    expect(poseAt(1).elbowR).toEqual(
      scaledElbow(armRoot({ x: 0, y: -46 }, "R"), { x: 18, y: -30 }),
    );
    expect(poseAt(2).elbowR).toEqual(
      scaledElbow(armRoot({ x: 0, y: -64 }, "R"), { x: 18, y: -44 }),
    );
  });

  it("bows the elbow correctly for a high strike, where the hand rises above the shoulder", () => {
    // A high-band strike lifts handR ABOVE the shoulder (y −68 vs the driving shoulder's −64), which
    // flips which perpendicular side counts as "backward" — this exercises the opposite bow-direction
    // branch from the resting/mid-strike arms (where the hand hangs below the shoulder). The hand lands
    // on the near edge (66,−68) at gyaku distance and the driving FRONT shoulder swings to x 23 (S4 ·
    // Slice 5).
    const pose = scene(
      [
        tickOf(
          0,
          { attacking: true, attackBand: 3, attackReach: 240_000, x: 150_000 },
          { x: 390_000 },
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

    expect(pose.elbowR).toEqual(
      scaledElbow({ x: 23, y: -64 }, { x: 66, y: -68 }),
    );
  });

  it("authors its own elbows when prone — not the upright derivation", () => {
    // PRONE authors all its joints (a downed body reshapes everything); the elbow is NOT the value
    // the upright bend rule would derive from the prone shoulder/hand.
    const prone = scene([tickOf(0, { knockdown: true }, {})], 0, VIEWPORT).a
      .pose;

    expect(prone.elbowL).toEqual(scaled({ x: -22, y: -6 }));
    expect(prone.elbowR).toEqual(scaled({ x: -22, y: -14 }));
    expect(prone.elbowR).not.toEqual(
      scaledElbow({ x: -24, y: -10 }, { x: -20, y: -18 }),
    );
  });

  it("is a pure function of the frame — a backward scrub re-derives the same elbow", () => {
    const tape: ReplayTape = [
      tickOf(
        0,
        { attacking: true, attackBand: 2, attackReach: 240_000, x: 150_000 },
        { x: 390_000 },
      ),
      tickOf(1, {}, {}),
    ];

    const atStrike = scene(tape, 0, VIEWPORT).a.pose.elbowR;

    scene(tape, 1, VIEWPORT); // advance...
    const backAgain = scene(tape, 0, VIEWPORT).a.pose.elbowR; // ...then scrub back

    expect(backAgain).toEqual(atStrike);
  });
});

describe("scene — legs bend at the knee (Story 4 · Slice 2)", () => {
  // The leg is a 2-bone limb hip→knee→foot, mirroring the arm: both bones hold a FIXED length and the
  // knee is solved on the perpendicular bisector of hip→foot, offset toward the FRONT (+x local) — a
  // knee bows forward where an elbow bows back. poseFor never reads facing (the container flip carries
  // it), so the bow is a fixed local direction that reads correctly for both facings; lengths are
  // authored in local px so Story 3's scalePose scales them with the body. bendForward is recomputed
  // here from the documented rule (NOT the production fn) so a formula / sign / magnitude mutant makes
  // production disagree with these expectations. See the arm block above for what S2 · Slice 3 changed.
  const KNEE_BEND = 8;
  const LEG_BONE = Math.hypot(Math.hypot(14, 34) / 2, KNEE_BEND);

  const bendForward = (
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const offset = Math.sqrt(Math.max(0, LEG_BONE ** 2 - (len / 2) ** 2));
    const perpX = -dy / len;
    const perpY = dx / len;
    const flip = perpX < 0 ? -1 : 1; // force the bow FORWARD (+x local)

    return {
      x: (from.x + to.x) / 2 + perpX * flip * offset,
      y: (from.y + to.y) / 2 + perpY * flip * offset,
    };
  };

  const scaledKnee = (
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) => scaled(bendForward(from, to));

  const poseAt = (posture: number) =>
    scene([tickOf(0, { posture }, {})], 0, VIEWPORT).a.pose;

  it("bends the front leg — the knee sits off the straight hip→foot line", () => {
    const pose = poseAt(0);

    // STAND: hip (0,-34) → front foot (14,0).
    expect(pose.kneeR).toEqual(scaledKnee({ x: 0, y: -34 }, { x: 14, y: 0 }));
    // ...and it bows FORWARD: the knee sits ahead of the straight-line midpoint (x 7 local) — a
    // formula-independent check that kills a bow-sign flip.
    expect(pose.kneeR.x).toBeGreaterThan(scaled({ x: 7, y: 0 }).x);
  });

  it("bends the rear leg at the knee too", () => {
    // STAND: hip (0,-34) → rear foot (-14,0).
    expect(poseAt(0).kneeL).toEqual(
      scaledKnee({ x: 0, y: -34 }, { x: -14, y: 0 }),
    );
  });

  it("derives bent knees for the crouch and air stances (stance-agnostic)", () => {
    // CROUCH: hip (0,-22) → footR (16,0). AIR: hip (0,-34) → footR (10,-18) (tucked leg).
    expect(poseAt(1).kneeR).toEqual(
      scaledKnee({ x: 0, y: -22 }, { x: 16, y: 0 }),
    );
    expect(poseAt(2).kneeR).toEqual(
      scaledKnee({ x: 0, y: -34 }, { x: 10, y: -18 }),
    );
  });

  it("authors its own knees when prone — not the upright derivation", () => {
    // PRONE authors all 11 joints (a downed body reshapes everything); the knee is NOT the value the
    // upright forward-bend rule would derive from the prone hip/foot.
    const prone = scene([tickOf(0, { knockdown: true }, {})], 0, VIEWPORT).a
      .pose;

    expect(prone.kneeL).toEqual(scaled({ x: 21, y: -8 }));
    expect(prone.kneeR).toEqual(scaled({ x: 21, y: -12 }));
    expect(prone.kneeR).not.toEqual(
      scaledKnee({ x: 6, y: -10 }, { x: 36, y: -14 }),
    );
  });

  it("is a pure function of the frame — a backward scrub re-derives the same knee", () => {
    const tape: ReplayTape = [
      tickOf(0, { posture: 1 }, {}), // crouch
      tickOf(1, {}, {}), // stand
    ];

    const atCrouch = scene(tape, 0, VIEWPORT).a.pose.kneeR;

    scene(tape, 1, VIEWPORT); // advance...
    const backAgain = scene(tape, 0, VIEWPORT).a.pose.kneeR; // ...then scrub back

    expect(backAgain).toEqual(atCrouch);
  });
});

describe("scene — score pop over a lookback window", () => {
  // When a fighter's points rise, their HUD score flag lights up for a lookback window of N ticks
  // ending at the playhead (default 30 ≈ 0.5 s at 60 fps). The flag is a PURE scan of the tape at
  // the given playhead — no cross-frame state — so it is identical on replay and correct after a
  // restart or a backward scrub. A rise is a STRICT increase between consecutive ticks. N defaults
  // to 30, so the boundary case below reads the window as [t, t+29] with t+30 just past it.

  // A tape of `length` ticks where `who` scores a single point at tick `t` (points 0 before, 1 from
  // t on) — so a strict rise occurs exactly at index t (needs t ≥ 1 to have a prior tick).
  const tapeScoringAt = (
    t: number,
    length: number,
    who: "a" | "b" = "a",
  ): ReplayTape =>
    Array.from({ length }, (_, i) => {
      const pts = i >= t ? 1 : 0;

      return who === "a"
        ? tickOf(i, { points: pts }, {})
        : tickOf(i, {}, { points: pts });
    });

  it("pops the scorer's flag across the window and not outside it", () => {
    const tape = tapeScoringAt(5, 40); // A's points rise at tick 5
    const popAt = (p: number) => scene(tape, p, VIEWPORT).hud.scoredA;

    expect(popAt(4)).toBe(false); // the tick before the score — no pop yet
    expect(popAt(5)).toBe(true); // the scoring tick
    expect(popAt(34)).toBe(true); // last tick of the window (t + N − 1 = 5 + 29)
    expect(popAt(35)).toBe(false); // one past the window (t + N) — the pop has expired
  });

  it("never pops at playhead 0 — there is no prior tick to compare", () => {
    const tape = tapeScoringAt(1, 10); // A scores at the earliest possible tick
    const first = scene(tape, 0, VIEWPORT).hud;

    expect(first.scoredA).toBe(false);
    expect(first.scoredB).toBe(false);
    // ...but the score is real — it pops the very next tick.
    expect(scene(tape, 1, VIEWPORT).hud.scoredA).toBe(true);
  });

  it("pops only the fighter who scored", () => {
    const tape = tapeScoringAt(3, 20, "b"); // only B scores, at tick 3
    const hud = scene(tape, 5, VIEWPORT).hud; // a playhead inside B's window

    expect(hud.scoredB).toBe(true);
    expect(hud.scoredA).toBe(false);
  });

  it("does not pop on a flat stretch — equal scores are not an increase", () => {
    // Both hold steady scores across the whole tape: no strict rise anywhere (kills a `>=` mutant).
    const tape: ReplayTape = Array.from({ length: 20 }, (_, i) =>
      tickOf(i, { points: 2 }, { points: 1 }),
    );

    const hud = scene(tape, 10, VIEWPORT).hud;

    expect(hud.scoredA).toBe(false);
    expect(hud.scoredB).toBe(false);
  });

  it("is deterministic — a backward jump re-derives the same flag", () => {
    // Purity guard: the pop depends only on (tape, playhead), never on what was rendered before.
    const tape = tapeScoringAt(5, 40);
    const forward = scene(tape, 10, VIEWPORT).hud.scoredA;

    scene(tape, 39, VIEWPORT); // jump to the end...
    const backAgain = scene(tape, 10, VIEWPORT).hud.scoredA; // ...then scrub back

    expect(forward).toBe(true);
    expect(backAgain).toBe(true);
  });

  it("pops a score at tick 1 without reading a negative index", () => {
    // The window's low end is guarded so an early playhead never reaches before the tape start.
    const tape = tapeScoringAt(1, 10);

    expect(scene(tape, 1, VIEWPORT).hud.scoredA).toBe(true);
    expect(scene(tape, 2, VIEWPORT).hud.scoredA).toBe(true); // still inside the window
  });
});

describe("scene — per-move pose descriptors: a kick drives the foot (S1)", () => {
  // Until now every one of the 13 arsenal moves drew the same picture: the front HAND at a band
  // height. A descriptor lets a move name which endpoint its committed strike drives, so a
  // `mae-geri` reads as a kick. The solve itself is unchanged — the same reach-to-target that aims
  // a fist aims the foot, and the knee re-derives off the moved `hip → footR` for free.
  //
  // Local-px anchors (recomputed here, independent of the production formula): one sub-unit is
  // 76/240000 local px, so a 240k gap is 76 px between centres and the near edge sits one
  // BODY_HALF_WIDTH (10) nearer ⇒ 66. mae-geri's 270k reach caps at 270000·(76/240000) = 85.5, so
  // an in-range kick lands on the edge at 66, not the cap.
  const NEUTRAL_FOOT_R = { x: 14, y: 0 }; // STAND front foot — the no-descriptor fallback
  const NEUTRAL_FOOT_L = { x: -14, y: 0 }; // STAND rear foot — the support leg
  const NEUTRAL_HAND_R = { x: 18, y: -44 }; // STAND front hand

  const poseKicking = ({
    gap = 240_000,
    move = "mae-geri",
    band = 2,
    reach = 270_000,
    extra = {},
  }: {
    gap?: number;
    move?: string;
    band?: number;
    reach?: number;
    extra?: Partial<ReplayFrame>;
  } = {}) =>
    scene(
      [
        tickOf(
          0,
          {
            attacking: true,
            attackBand: band,
            attackReach: reach,
            attackMove: move,
            x: 150_000,
            facing: 1,
            ...extra,
          },
          { x: 150_000 + gap },
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

  it("drives the front FOOT to the opponent's near edge for a mae-geri, leaving the hand at stance", () => {
    const pose = poseKicking();

    expect(pose.footR).toEqual(scaled({ x: 66, y: -46 }));
    // The front hand is NOT the driven endpoint for a kick — it stays where the stance put it.
    expect(pose.handR).toEqual(scaled(NEUTRAL_HAND_R));
  });

  it("keeps the support leg planted while the kicking leg extends (M8.2)", () => {
    // The fighter neither slides nor floats: the rear foot holds the stance it started in.
    expect(poseKicking().footL).toEqual(scaled(NEUTRAL_FOOT_L));
  });

  it("tracks the real opponent distance — a nearer opponent is kicked at a nearer point (M8.5)", () => {
    // The solve is retained for the foot, not replaced by a constant forward stub. A 150k gap is
    // 47.5 px between centres ⇒ the edge sits at 37.5; a 240k gap ⇒ 66. Both are inside
    // mae-geri's 85.5 cap, so the two land at genuinely different points.
    expect(poseKicking({ gap: 150_000 }).footR).toEqual(
      scaled({ x: 37.5, y: -46 }),
    );
    expect(poseKicking({ gap: 240_000 }).footR).toEqual(
      scaled({ x: 66, y: -46 }),
    );
  });

  it("stops the kicking foot at the move's reach cap when the opponent is beyond it (a whiff)", () => {
    // A 400k gap is 126.7 px between centres — past mae-geri's 85.5 cap, so the foot stops at the
    // cap rather than stretching to the edge. Pins that the foot obeys the SAME clamp as a fist.
    expect(poseKicking({ gap: 400_000 }).footR).toEqual(
      scaled({ x: 85.5, y: -46 }),
    );
  });

  const crossOf = (pose: ReturnType<typeof poseKicking>) =>
    (pose.footR.x - pose.hip.x) * (pose.kneeR.y - pose.hip.y) -
    (pose.footR.y - pose.hip.y) * (pose.kneeR.x - pose.hip.x);

  it("bends the knee off the straight hip → foot line, so the kicking leg reads jointed (M8.6)", () => {
    // Non-collinearity via the cross product of (hip → footR) against (hip → kneeR): exactly 0 would
    // mean the knee sits ON the straight line, i.e. a rigid stick. Measured at a gap the leg can
    // actually reach (120k), because S2 · Slice 3 made the bend a CONSEQUENCE of fixed bone lengths
    // rather than a constant — a leg only has slack to bend while its target is inside its reach.
    expect(crossOf(poseKicking({ gap: 120_000 }))).not.toBe(0);
  });

  it("straightens the leg once the kick is at full extension (S2 · Slice 3)", () => {
    // The other side of that rule, pinned so it reads as a decision rather than a regression. At the
    // workhorse distance the target is beyond the leg's reach even after the hip steps, so both bones
    // line up: a fully committed kick IS a straight line, and forcing a bow into one would be
    // anatomically wrong. The knee therefore sits on the hip → foot midpoint.
    const pose = poseKicking({ gap: 240_000 });
    const midX = (pose.hip.x + pose.footR.x) / 2;
    const midY = (pose.hip.y + pose.footR.y) / 2;

    // Within a pixel: the joints are rounded independently after scaling.
    expect(Math.hypot(pose.kneeR.x - midX, pose.kneeR.y - midY)).toBeLessThan(
      1,
    );
  });

  it("keeps the upper body upright in a kick, while a punch still leans into its reach (M9)", () => {
    // The M2 lean was authored for PUNCHES, where pitching the torso into the reach is right. S2 ·
    // Slice 2's eye check found it inherited wrongly by kicks: on a mae-geri the torso pitches
    // forward over a rising leg, so the figure reads as FALLING INTO the kick rather than kicking.
    // Real front kicks counterbalance — so the lean is now a property of the driving limb, not of
    // "a strike happened". A kick stays upright; a hand technique is untouched.
    const kick = poseKicking();
    const punch = poseKicking({ move: "gyaku-zuki" });

    expect(kick.head).toEqual(scaled({ x: 0, y: -76 }));
    expect(kick.shoulder).toEqual(scaled({ x: 0, y: -64 }));

    // The punch still leans: the driving shoulder caps at 16, so its midpoint + head carry half (8,
    // S4 · Slice 5). A kick stays fully upright either way.
    expect(punch.head).toEqual(scaled({ x: 8, y: -76 }));
    expect(punch.shoulder).toEqual(scaled({ x: 8, y: -64 }));
  });

  it("steps the kicking hip forward even though the upper body stays upright", () => {
    // The two mechanisms are independent: the hip steps because the leg cannot span the distance
    // (S2 · Slice 3), and that is true whether or not the torso leans. A kick that neither leaned
    // nor stepped would be back to a leg stretching across the whole gap on its own.
    const pose = poseKicking();

    expect(pose.hip.x).toBeGreaterThan(scaled({ x: 0, y: -34 }).x);
    expect(pose.hip.y).toBe(scaled({ x: 0, y: -34 }).y);
  });

  it("falls back to today's generic hand pose for a move with no descriptor yet (M7)", () => {
    // The other 12 moves, an id the table has never heard of, an empty id, and an ABSENT field
    // (the loader casts the wire wholesale, so the key may simply not be there) all draw the hand.
    const generic = [
      { attackMove: "kizami-zuki" }, // a real move, no descriptor yet
      { attackMove: "no-such-move" }, // unknown id
      { attackMove: "" }, // the engine's "nothing committed" sentinel
      { attackMove: undefined }, // field absent from the wire
    ];

    generic.forEach((extra) => {
      const pose = poseKicking({ extra });

      expect(pose.handR).toEqual(scaled({ x: 66, y: -46 })); // the hand drives
      expect(pose.footR).toEqual(scaled(NEUTRAL_FOOT_R)); // the foot stays home
    });
  });

  it("draws no kick at all when the fighter is not attacking, even carrying a stale move id", () => {
    // The descriptor selects WHICH endpoint a committed strike drives; it never makes an idle
    // fighter strike. Both endpoints keep the stance (M7 totality).
    const pose = poseKicking({ extra: { attacking: false } });

    expect(pose.footR).toEqual(scaled(NEUTRAL_FOOT_R));
    expect(pose.handR).toEqual(scaled(NEUTRAL_HAND_R));
  });

  it("carries the kick to whichever band it targets, and draws none for an unmapped band", () => {
    expect(poseKicking({ band: 1 }).footR).toEqual(scaled({ x: 66, y: -24 }));
    expect(poseKicking({ band: 3 }).footR).toEqual(scaled({ x: 66, y: -68 }));
    // Band 0 / out-of-range ⇒ no strike to draw ⇒ the foot keeps its stance.
    expect(poseKicking({ band: 0 }).footR).toEqual(scaled(NEUTRAL_FOOT_R));
    expect(poseKicking({ band: 9 }).footR).toEqual(scaled(NEUTRAL_FOOT_R));
  });

  it("is a pure function of the frame — a backward scrub re-lands the same foot", () => {
    const tape: ReplayTape = [
      tickOf(
        0,
        {
          attacking: true,
          attackBand: 2,
          attackReach: 270_000,
          attackMove: "mae-geri",
          x: 150_000,
          facing: 1,
        },
        { x: 390_000 },
      ),
      tickOf(1, { x: 150_000, facing: 1 }, { x: 390_000 }),
    ];

    const first = scene(tape, 0, VIEWPORT).a.pose.footR;

    scene(tape, 1, VIEWPORT);

    expect(scene(tape, 0, VIEWPORT).a.pose.footR).toEqual(first);
  });
});

describe("scene — a technique winds up and recovers (S2 · Slice 1)", () => {
  // Until now a committed move drew ONE pose for its whole duration — startup, active and recovery
  // alike — so a gyaku-zuki held full extension for 24 ticks (~0.4s). `attackPhase` (shipped on the
  // tape in S0) now selects the shape: a chamber while winding up and recovering, the solved
  // extension only at contact. The solve is retained at phase 2 (M3, non-negotiable).
  const CHAMBER = 1;
  const CONTACT = 2;
  const RECOVER = 3;

  // A committed mid-band mae-geri at a 240k gap — the same geometry the S1 block uses, so the
  // phase-2 endpoint is the familiar edge-solve at x 66.
  const poseAtPhase = (extra: Partial<ReplayFrame> = {}) =>
    scene(
      [
        tickOf(
          0,
          {
            attacking: true,
            attackBand: 2,
            attackReach: 270_000,
            attackMove: "mae-geri",
            x: 150_000,
            facing: 1,
            ...extra,
          },
          { x: 390_000 },
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

  const footAt = (attackPhase: number | undefined) =>
    poseAtPhase({ attackPhase }).footR;

  it("chambers the kicking foot during startup, then drives it forward at contact", () => {
    const chambered = footAt(CHAMBER);
    const extended = footAt(CONTACT);

    // A wind-up is a different SHAPE, not a shorter reach (M3) — scaling the extension down reads
    // as a weak kick rather than a chamber.
    expect(chambered).not.toEqual(extended);
    // M8.4 direction: the technique EXTENDS from its chamber. If this ever inverts, the kick is
    // retracting into contact.
    expect(chambered.x).toBeLessThan(extended.x);
    // Lifted off the ground — a chambered leg is knee-up, not a foot resting in stance.
    expect(chambered.y).toBeLessThan(0);
  });

  it("returns to the chamber during recovery (M3 default, no per-move override yet)", () => {
    // M3 defaults recovery to the chamber point; whether mae-geri needs its OWN recovery pose is an
    // eye question deferred to slice 2's visual sign-off. Phase 1 === phase 3 is therefore BY
    // DESIGN, which is why M8.3 was relaxed to "phase 2 differs from 1 and 3" (see the plan).
    expect(footAt(RECOVER)).toEqual(footAt(CHAMBER));
    expect(footAt(RECOVER)).not.toEqual(footAt(CONTACT));
  });

  it("still tracks the real opponent distance at contact — the solve survives phasing (M8.5)", () => {
    // The standing guard against M3 quietly regressing into a fixed authored extension. A 150k gap
    // puts the near edge at 37.5 local px, a 240k gap at 66 — both inside mae-geri's 85.5 cap.
    const near = poseAtPhase({ attackPhase: CONTACT, x: 240_000 }).footR;
    const far = poseAtPhase({ attackPhase: CONTACT, x: 150_000 }).footR;

    expect(near.x).not.toBe(far.x);
  });

  it("winds a move with NO authored chamber up through its stance instead (M7, reading A)", () => {
    // The other 12 moves are unauthored, so their driven endpoint simply returns to the stance while
    // winding up and recovering — an arm dropping back to guard between strikes. Not a degraded
    // state: it is still a wind-up, just not a bespoke one, and it is what makes THIS slice fix all
    // 13 moves rather than only mae-geri.
    const NEUTRAL_HAND_R = { x: 18, y: -44 }; // STAND front hand
    // kizami-zuki (the jab) is the stand-in for "real move, still unauthored" — gyaku-zuki held this
    // role until S4 · Slice 1 gave it a descriptor. Its 210k reach caps at 66.5px, so the in-range
    // edge at 66 is unchanged and the contact expectation below still reads the same number.
    const unauthored = { attackMove: "kizami-zuki", attackReach: 210_000 };

    expect(poseAtPhase({ ...unauthored, attackPhase: CHAMBER }).handR).toEqual(
      scaled(NEUTRAL_HAND_R),
    );
    expect(poseAtPhase({ ...unauthored, attackPhase: RECOVER }).handR).toEqual(
      scaled(NEUTRAL_HAND_R),
    );
    // ...and it still punches at contact.
    expect(poseAtPhase({ ...unauthored, attackPhase: CONTACT }).handR).toEqual(
      scaled({ x: 66, y: -46 }),
    );
  });

  it("draws the extension for any phase code that is not a chamber phase (M7 totality)", () => {
    // An absent field (the loader casts the wire wholesale), the `0` = nothing-committed sentinel,
    // and any out-of-range or nonsense code all fall back to the extension — today's look — so no
    // tape can regress into a blank or frozen figure. A non-numeric value is total by construction:
    // `isChamberPhase` compares with `===` against numeric literals.
    const extended = scaled({ x: 66, y: -46 });

    [undefined, 0, 7, -1, NaN].forEach((attackPhase) =>
      expect(footAt(attackPhase)).toEqual(extended),
    );
  });

  it("never chambers a fighter who has no strike to draw, whatever phase the tape claims", () => {
    // `attackPhase` selects WHERE a committed strike is drawn; it must never conjure one. A fighter
    // who is idle, aiming at an unmapped band, or carrying a defensively-rejected reach keeps the
    // stance through every phase — even holding a stale move id. Without this the wind-up branch
    // reaches the chamber before anything has checked there is a strike at all.
    const NEUTRAL_FOOT_R = { x: 14, y: 0 }; // STAND front foot

    const noStrike = [
      { attacking: false }, // idle, stale id still on the frame
      { attackBand: 0 }, // the "no band" sentinel
      { attackBand: 9 }, // out of range
      { attackReach: 0 }, // reach defensively rejected
    ];

    noStrike.forEach((extra) =>
      [CHAMBER, CONTACT, RECOVER].forEach((attackPhase) =>
        expect(poseAtPhase({ ...extra, attackPhase }).footR).toEqual(
          scaled(NEUTRAL_FOOT_R),
        ),
      ),
    );
  });

  it("leans the upper body only at contact, never during the wind-up (M9)", () => {
    // A fighter leans INTO a technique as it extends; leaning forward while still chambered is
    // backwards. The driving shoulder caps at 16 at contact and the head carries half (8, S4 · Slice
    // 5); it is 0 either side of contact.
    //
    // Demonstrated on a PUNCH: S2 · Slice 3 made the lean a hand-technique property, so a kick is
    // upright at every phase and can no longer show the phase gate. `gyaku-zuki` drives the rear hand
    // — and it is the move that spends the most time on screen.
    const UPRIGHT_HEAD = { x: 0, y: -76 };

    const punchAt = (attackPhase: number) =>
      poseAtPhase({ attackPhase, attackMove: "gyaku-zuki" }).head;

    expect(punchAt(CHAMBER)).toEqual(scaled(UPRIGHT_HEAD));
    expect(punchAt(RECOVER)).toEqual(scaled(UPRIGHT_HEAD));
    expect(punchAt(CONTACT)).toEqual(scaled({ x: 8, y: -76 }));
  });

  it("keeps a kick upright at every phase — the lean belongs to hand techniques (M9)", () => {
    // The complement of the gate above, so "a kick never leans" is pinned as its own rule rather
    // than being a side effect of whichever phase a test happened to pick.
    [CHAMBER, CONTACT, RECOVER].forEach((attackPhase) =>
      expect(poseAtPhase({ attackPhase }).head).toEqual(
        scaled({ x: 0, y: -76 }),
      ),
    );
  });

  it("keeps the support leg planted through every phase (M8.2)", () => {
    const NEUTRAL_FOOT_L = { x: -14, y: 0 }; // STAND rear foot — the support leg

    // The fighter neither slides nor floats, whatever the kicking leg is doing — and still not once
    // S2 · Slice 3 let the HIP step into a long kick: capping that step keeps the support leg's own
    // stretch small enough that the rear foot stays put.
    [CHAMBER, CONTACT, RECOVER].forEach((attackPhase) =>
      expect(poseAtPhase({ attackPhase }).footL).toEqual(
        scaled(NEUTRAL_FOOT_L),
      ),
    );
  });

  it("bends the kicking leg while it is chambered, and straightens it at contact (M8.6)", () => {
    // Non-collinearity of hip → kneeR → footR via the cross product: exactly 0 means the knee sits ON
    // the straight line. A CHAMBERED leg is folded, so it bends for free — the mid-joints re-derive
    // from whatever endpoints the phase produced. At CONTACT the target is past what the leg can span
    // even after the hip steps, so the bones line up and the leg draws straight (S2 · Slice 3). Both
    // are the same rule — fixed bones, and the bend is whatever slack is left over.
    const crossAt = (attackPhase: number) => {
      const pose = poseAtPhase({ attackPhase });

      return (
        (pose.footR.x - pose.hip.x) * (pose.kneeR.y - pose.hip.y) -
        (pose.footR.y - pose.hip.y) * (pose.kneeR.x - pose.hip.x)
      );
    };

    expect(crossAt(CHAMBER)).not.toBe(0);
    expect(crossAt(RECOVER)).not.toBe(0);
    expect(crossAt(CONTACT)).toBe(0);
  });
});

describe("scene — limbs keep their bone lengths (S2 · Slice 3)", () => {
  // Until now `deriveBend` placed the mid-joint at the MIDPOINT of the two endpoints plus a fixed
  // 8px perpendicular, so the two bones it implied were √((span/2)² + 8²) — a function of how far
  // apart the endpoints happened to be. The bones therefore STRETCHED with the reach: mae-geri's
  // leg ran 10.2 → 34.5 local px across a single technique (a 3.4× swing) and the arm 1.77×, which
  // is what made the contact frame read as a rubber band rather than a limb. Bones are now FIXED
  // at their stance length and the mid-joint solves for them (2-bone IK).
  //
  // Asserted as a RATIO against the figure's own stance, never a literal coordinate, so the
  // descriptor table stays free to retune without touching a test (decision 9 / the M8 floor).
  const boneLength = (from: Joint, to: Joint) =>
    Math.hypot(to.x - from.x, to.y - from.y);

  // Every joint is rounded to a whole pixel AFTER scaling (≈6.32× at this viewport), so two
  // endpoints can each shift up to half a pixel and a measured bone can drift ~1.1% from its true
  // length. 2% therefore sits above the rounding floor while staying far below the defect being
  // killed, which is a 72% overrun at contact and a 240% swing across the technique.
  const BONE_TOLERANCE = 0.02;

  // A committed mid-band mae-geri `gap` sub-units from its opponent. The gap is the lever that
  // decides whether the target is inside the limb's straight-line reach.
  const poseOf = ({
    gap = 240_000,
    ...extra
  }: Partial<ReplayFrame> & { gap?: number } = {}) =>
    scene(
      [
        tickOf(
          0,
          {
            attacking: true,
            attackBand: 2,
            attackReach: 270_000,
            attackMove: "mae-geri",
            x: 150_000,
            facing: 1,
            ...extra,
          },
          { x: 150_000 + gap },
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

  // The same figure standing idle — the reference every bone is measured against.
  const stancePose = () => poseOf({ attacking: false });

  // How far a pose's bone has drifted from the same bone in stance. 0 means the fighter kept its
  // own anatomy; the old derivation drifted by 0.72 at contact.
  const boneDrift = (
    pose: ReturnType<typeof poseOf>,
    from: keyof ReturnType<typeof poseOf>,
    to: keyof ReturnType<typeof poseOf>,
  ) => {
    const stance = stancePose();

    return Math.abs(
      boneLength(pose[from], pose[to]) / boneLength(stance[from], stance[to]) -
        1,
    );
  };

  it("keeps the kicking leg's bones at stance length when the target is within reach", () => {
    // A 120k gap puts the near edge at 28 local px, so hip → foot spans ~30.5 against a leg that
    // straightens to ~40: comfortably reachable, so the knee alone absorbs the difference and
    // nothing else has to move. The bone belongs to the fighter, not to the distance it happens to
    // be reaching. Both bones, because a solve that fixes only the thigh would leave the shin to
    // take up the slack.
    const contact = poseOf({ gap: 120_000, attackPhase: 2 });

    expect(boneDrift(contact, "hip", "kneeR")).toBeLessThan(BONE_TOLERANCE);
    expect(boneDrift(contact, "kneeR", "footR")).toBeLessThan(BONE_TOLERANCE);
  });

  it("keeps the chamber's bones at stance length too — the wind-up is a bend, not a shrink", () => {
    // The other end of the swing, and the one the eye check flagged. A chambered foot sits ~12.6 px
    // from the hip, well inside the leg's reach, so a folded knee absorbs all of it. Before this the
    // implied bones SHRANK to 10.2 — the chambered leg read as a stump.
    const chambered = poseOf({ attackPhase: 1 });

    expect(boneDrift(chambered, "hip", "kneeR")).toBeLessThan(BONE_TOLERANCE);
    expect(boneDrift(chambered, "kneeR", "footR")).toBeLessThan(BONE_TOLERANCE);
  });

  it("steps the hip into a kick whose target is beyond the leg's reach", () => {
    // At the workhorse distance (gyaku-zuki's 240k reach, and the dojo's default gap) the fighter
    // stands about one body-height from its opponent while a leg spans roughly half that. No
    // human-proportioned figure reaches its own height, so the root closes part of the gap — a step
    // INTO the technique — and the limb stretches for the remainder.
    const stance = stancePose();
    const contact = poseOf({ gap: 240_000, attackPhase: 2 });

    expect(contact.hip.x).toBeGreaterThan(stance.hip.x);
  });

  it("leaves the hip planted when the kick can reach without stepping", () => {
    // The fighter steps only when the technique demands it: a close-range kick keeps its stance.
    expect(poseOf({ gap: 120_000, attackPhase: 2 }).hip).toEqual(
      stancePose().hip,
    );
  });

  it("bounds how far the kicking leg may stretch once the step is spent", () => {
    // The step is capped, so beyond it the limb still stretches — but boundedly. At the workhorse
    // distance the overrun falls from 0.72 (the defect this slice exists to kill) to under 0.3.
    const contact = poseOf({ gap: 240_000, attackPhase: 2 });

    expect(boneDrift(contact, "hip", "kneeR")).toBeLessThan(0.3);
  });

  it("still lands the kicking foot on its target once the leg is constrained", () => {
    // The S5 guarantee (#344-#347): a strike CONNECTS. Constraining the limb must not quietly undo
    // it — the foot lands on the opponent's near edge exactly as it did before this slice.
    expect(poseOf({ gap: 240_000, attackPhase: 2 }).footR).toEqual(
      scaled({ x: 66, y: -46 }),
    );
  });

  it("keeps the support foot planted while the hip steps (M8.2 holds)", () => {
    // Capping the step at 16px keeps the support leg's own stretch to ~1.13x — small enough that the
    // rear foot stays where the fighter put it. M8.2 therefore stands as written: the plan's tripwire
    // (hip travel forcing footL to slide) never fires, because the travel is bounded.
    expect(poseOf({ gap: 240_000, attackPhase: 2 }).footL).toEqual(
      stancePose().footL,
    );
  });
});

describe("scene — the reverse punch is thrown with the rear arm (S4 · Slice 1)", () => {
  // `gyaku-zuki` is the REVERSE punch — the rear hand travels. Until now it fell back to the generic
  // front-hand pose, so the workhorse technique (~80% of all committed screen time) and the jab
  // (`kizami-zuki`, genuinely a front-hand punch) drew the identical picture. A descriptor naming
  // `handL` as the driven endpoint is what separates them.
  //
  // Local-px anchors, recomputed here independently of the production formula: one sub-unit is
  // 76/240000 local px, so a 240k gap is 76px between centres and the near edge sits one
  // BODY_HALF_WIDTH (10) nearer ⇒ 66. gyaku-zuki's reach is also 240k ⇒ a 76px cap, so an in-range
  // punch lands on the edge at 66, not the cap. Its first legal band is high ⇒ y −68.
  const NEUTRAL_HAND_L = { x: -18, y: -44 }; // STAND rear hand — the guard arm
  const NEUTRAL_HAND_R = { x: 18, y: -44 }; // STAND front hand
  const GUARD_MID = { x: 8, y: -46 }; // a raised mid guard, for the precedence cases

  const posePunching = ({
    gap = 240_000,
    move = "gyaku-zuki",
    band = 3,
    reach = 240_000,
    attacking = true,
    extra = {},
  }: {
    gap?: number;
    move?: string;
    band?: number;
    reach?: number;
    attacking?: boolean;
    extra?: Partial<ReplayFrame>;
  } = {}) =>
    scene(
      [
        tickOf(
          0,
          {
            attacking,
            attackBand: band,
            attackReach: reach,
            attackMove: move,
            x: 150_000,
            facing: 1,
            ...extra,
          },
          { x: 150_000 + gap },
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

  it("drives the REAR hand to the opponent's near edge for a gyaku-zuki", () => {
    const pose = posePunching();

    expect(pose.handL).toEqual(scaled({ x: 66, y: -68 }));
    // The front hand is not the driven endpoint — only ONE hand reaches the target. This pinned the
    // front hand to its stance until S4 · Slice 2 pulled it back (hikite), so it now asserts the part
    // that is actually this slice's claim; where the other hand goes is slice 2's.
    expect(pose.handR).not.toEqual(scaled({ x: 66, y: -68 }));
  });

  it("lets the committed punch win the rear arm when the fighter is also guarding", () => {
    // The rear-hand precedence rule. `handL` is the guard arm precisely so a strike and a guard never
    // contend for the same limb — a premise a rear-hand strike breaks. The strike wins: it is the more
    // informative event, and the alternative draws a fighter with a raised guard and NO visible punch,
    // i.e. the move reads as unthrown. Engine-impossible (guard and attack are mutually exclusive in
    // the sim) but reachable in /dojo by design (M10 free combos), so the rule is exercised for real.
    const pose = posePunching({ extra: { guardBand: 2 } });

    expect(pose.handL).toEqual(scaled({ x: 66, y: -68 }));
  });

  it("keeps the guard on the rear arm when no strike is being drawn, even carrying a move id", () => {
    // The other half of the rule, and the one that stops it overreaching: the yield is gated on a LIVE
    // strike, not on the move id. A fighter idling with a stale `gyaku-zuki` in the frame must keep a
    // real guard — otherwise a leftover id silently strips the fighter's defence.
    const pose = posePunching({ attacking: false, extra: { guardBand: 2 } });

    expect(pose.handL).toEqual(scaled(GUARD_MID));
  });

  it("still drives the FRONT hand for a punch with no descriptor, leaving the rear arm at stance", () => {
    // M7 totality: the generic path is the status quo, not a degraded state. `kizami-zuki` (the jab)
    // has no descriptor, so it must draw exactly as every hand technique drew before this slice.
    // Its 210k reach caps at 66.5px, so the in-range edge at 66 is still what it lands on.
    const pose = posePunching({ move: "kizami-zuki", reach: 210_000 });

    expect(pose.handR).toEqual(scaled({ x: 66, y: -68 }));
    // The rear arm is not driven — it stays at its stance position. Asserted as an ABSOLUTE again
    // (S4 · Slice 5): the resting arm hangs off the rear shoulder, which a rotating girdle leaves put,
    // so the hand-ride S4 · Slice 3 introduced for the sliding shoulder is retired with the slide.
    expect(pose.handL).toEqual(scaled(NEUTRAL_HAND_L));
  });

  const crossOf = (pose: ReturnType<typeof posePunching>) =>
    (pose.handL.x - pose.shoulder.x) * (pose.elbowL.y - pose.shoulder.y) -
    (pose.handL.y - pose.shoulder.y) * (pose.elbowL.x - pose.shoulder.x);

  it("re-derives the rear elbow off the moved shoulder → hand, so the punching arm reads jointed", () => {
    // The bend rule runs on the FINAL endpoints, so a driven rear hand re-bends its own elbow for
    // free. Measured at a gap the arm can actually reach (120k ⇒ a 28px target), because S2 · Slice 3
    // made the bow a CONSEQUENCE of fixed bone lengths: a fully committed punch straightens, so
    // asserting a bend at the workhorse distance would be asserting the wrong anatomy.
    const punching = posePunching({ gap: 120_000 });

    expect(crossOf(punching)).not.toBe(0);
    // And it is genuinely re-derived rather than left at the stance bend.
    expect(punching.elbowL).not.toEqual(
      posePunching({ attacking: false }).elbowL,
    );
  });

  it("leaves the kick path undisturbed — a mae-geri still drives the foot", () => {
    // The endpoint routing grows from a binary (foot vs front hand) to a three-way. This pins that
    // widening it did not knock the kick into the wrong branch.
    const pose = posePunching({ move: "mae-geri", band: 2, reach: 270_000 });

    expect(pose.footR).toEqual(scaled({ x: 66, y: -46 }));
    expect(pose.handR).toEqual(scaled(NEUTRAL_HAND_R));
    expect(pose.handL).toEqual(scaled(NEUTRAL_HAND_L));
  });
});

describe("scene — the reverse punch chambers and pulls (S4 · Slice 2)", () => {
  // Two authored points, one technique. The CHAMBER is the rear fist waiting at the ribs while the
  // punch winds up and recovers (without it gyaku-zuki sits at stance and SNAPS to full extension —
  // the S2 defect returning for the move with ~80% of all screen time). The OFF HAND is `hikite`:
  // the front fist withdrawn to the hip as the punch lands.
  //
  // hikite exists because slice 1's rear-hand drive reads faintly on its own. Both arms hang off ONE
  // shared `shoulder` joint, so the EXTENDED arm lands in nearly the same place whichever hand
  // throws; only the resting arm differs. Pulling the off hand back is what makes the punching side
  // read, rather than leaving the distinction to a trailing arm nobody looks at.
  //
  // Both points are authored by eye and WILL be re-tuned, so these assert the RELATIONS that carry
  // the meaning (pulled back, distinct from extension, behind stance) rather than the literal
  // coordinates — the same discipline the mae-geri chamber follows above.
  const CHAMBER = 1;
  const CONTACT = 2;
  const RECOVER = 3;

  const STANCE_HAND_L = { x: -18, y: -44 };
  const STANCE_HAND_R = { x: 18, y: -44 };

  const poseAt = (
    attackPhase: number | undefined,
    extra: Partial<ReplayFrame> = {},
  ) =>
    scene(
      [
        tickOf(
          0,
          {
            attacking: true,
            attackBand: 3,
            attackReach: 240_000,
            attackMove: "gyaku-zuki",
            attackPhase,
            x: 150_000,
            facing: 1,
            ...extra,
          },
          { x: 390_000 },
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

  it("chambers the punching fist back at the ribs during startup, then drives it forward at contact", () => {
    const chambered = poseAt(CHAMBER).handL;
    const extended = poseAt(CONTACT).handL;

    // A wind-up is a different SHAPE, not a shorter reach (M3).
    expect(chambered).not.toEqual(extended);
    // The technique EXTENDS from its chamber — if this inverts, the punch retracts into contact.
    expect(chambered.x).toBeLessThan(extended.x);
    // And it waits BEHIND the stance hand: a chambered fist is drawn back, not merely held still.
    expect(chambered.x).toBeLessThan(scaled(STANCE_HAND_L).x);
  });

  it("returns the punching fist to that chamber during recovery", () => {
    expect(poseAt(RECOVER).handL).toEqual(poseAt(CHAMBER).handL);
    expect(poseAt(RECOVER).handL).not.toEqual(poseAt(CONTACT).handL);
  });

  it("leaves the contact geometry exactly where slice 1 put it", () => {
    // The load-bearing guard: hikite is COSMETIC, and where contact happens is what the engine
    // actually cares about. A 240k gap puts the near edge at 66 local px, inside gyaku-zuki's 76 cap,
    // and the first legal band is high ⇒ y −68. Asserted exactly (a SOLVED value, not an eye-tuned
    // one), so re-tuning either authored point can never quietly move the punch.
    expect(poseAt(CONTACT).handL).toEqual(scaled({ x: 66, y: -68 }));
  });

  it("pulls the front fist back toward the hip as the punch lands (hikite)", () => {
    const pulled = poseAt(CONTACT).handR;

    // Clearly BEHIND where the stance leaves it — this is the assertion that makes the punch read
    // from the punching side rather than from the trailing arm.
    expect(pulled.x).toBeLessThan(scaled(STANCE_HAND_R).x);
    // Drawn back past the body's centre line, i.e. genuinely withdrawn to the hip rather than merely
    // relaxed a little.
    expect(pulled.x).toBeLessThan(0);
    // The pulled hand and the chambered fist are DIFFERENT authored points, not one position reused
    // for both. Without this the two lookups can be crossed — the scan's "offHandFor wired to the
    // chamber field" mutant satisfies every relation above, because the chamber is also drawn back.
    expect(pulled).not.toEqual(poseAt(CHAMBER).handL);
  });

  it("does not pull the off hand for an idle fighter carrying a stale move id", () => {
    // The same trap slice 1's precedence rule guards for the guard arm: `hikite` must need a LIVE
    // strike, not merely a move id sitting in the frame, or a fighter who has finished punching
    // keeps a hand withdrawn at its hip. Found by the mutator scan, not by the TDD pass.
    const idle = poseAt(CONTACT, { attacking: false });

    expect(idle.handR).toEqual(scaled(STANCE_HAND_R));
  });

  it("holds the front hand forward while the punch is still winding up", () => {
    // hikite is gated to CONTACT, matching how the M2 lean is gated (M9): a fighter pulls the off
    // hand as the punch EXTENDS, not while chambering. Drawing both fists back during startup would
    // read as a fighter covering up, not as a wind-up — one fist chambered with the other hand
    // forward IS the pre-punch shape.
    expect(poseAt(CHAMBER).handR).toEqual(scaled(STANCE_HAND_R));
  });

  it("leaves the other hand at its stance shape for a move with no off hand authored (M7)", () => {
    // Totality: `offHand` is descriptor data, so every move that does not author one keeps the status
    // quo. kizami-zuki is a hand technique with no descriptor at all, so its rear hand must not be
    // dragged along by gyaku-zuki's authoring — it must sit where an unauthored hand sits.
    //
    // "Where an unauthored hand sits" is its ABSOLUTE stance point again (S4 · Slice 5): a resting hand
    // hangs off the rear shoulder, which a rotating girdle leaves put, so it neither rides nor pulls.
    // (Slice 3 briefly made this shoulder-relative for the sliding girdle; rotation retired that.)
    const jab = poseAt(CONTACT, {
      attackMove: "kizami-zuki",
      attackReach: 210_000,
    });

    expect(jab.handL).toEqual(scaled(STANCE_HAND_L));
  });

  // NO test here for "the front elbow re-derives off the pulled hand", though the slice's acceptance
  // criteria asked for one. Every candidate assertion passed BEFORE the off hand existed: comparing
  // contact against chamber detects the M2 LEAN (the shoulder shifts at contact and not while
  // winding up), not the pull, and the weaker forms — elbow behind the shoulder, the two bones equal
  // — already hold with the hand at stance. The property is guaranteed by construction: `offHand` is
  // written into the endpoints object and `deriveSkeleton` runs on the result, so there is no path
  // where the hand moves and the elbow does not. Slice 1's equivalent test was meaningful only
  // because its endpoint genuinely moved somewhere new. A test that cannot fail is worse than none.
});

describe("move descriptors — table integrity", () => {
  it("describes only real arsenal moves, so no descriptor is silently dead", () => {
    // A typo'd key ("maegeri") would never match a tape's `attackMove` and would fall back to the
    // generic pose forever, with nothing failing. REACH_PRESETS is the engine-mirror move list, so
    // every described id must appear in it. (Arsenal.tsx carries the same 13 ids but does not
    // export its array — it is presentation only, so the mirror is the authority here.)
    const known = new Set(REACH_PRESETS.map((p) => p.move));

    expect(DESCRIBED_MOVES.length).toBeGreaterThan(0);
    DESCRIBED_MOVES.forEach((move) => expect(known).toContain(move));
  });
});

describe("scene — a punch leans only as far as it must reach (S4 · Slice 3)", () => {
  // Two mechanisms answered the same question in two different ways. A KICK beyond the leg's reach
  // stepped the hip by the DERIVED shortfall (`rootTravel`: how far past the limb's straight reach the
  // target sits, capped). A PUNCH leaned the upper body by a HEURISTIC — half the hand's forward x,
  // capped — which never asked whether the arm could already reach. They agree at the workhorse
  // distance and diverge close in, where the heuristic lunges the torso forward for nothing.
  //
  // The lean is that same derived shortfall, and S4 · Slice 5 measures it from the DRIVING arm's own
  // shoulder (± HALF) rather than the shared midpoint, then advances the midpoint + head HALF of it as
  // the girdle rotates. Two consequences still pin the derived rule: a punch the arm can already reach
  // does not lean, and a punch to a LOW band leans MORE than the old heuristic gave, because the
  // heuristic read only the forward x and ignored the vertical drop to the target.
  //
  // The lean's OTHER slice-3 consequence — a resting hand riding the moving shoulder — is GONE: the
  // rotating girdle leaves the resting shoulder put, so a resting hand keeps its absolute stance point
  // and needs no ride (the slice-5 block pins that retirement). Authored destinations — the driven
  // hand, a raised guard — still say "put the fist HERE".

  // Recomputed from the documented STAND geometry rather than imported, so a production change to a
  // constant makes these expectations disagree — the same discipline as BODY_SCALE above. shoulder
  // {0,−64} → hand {18,−44} spans 26.91, so one bone is hypot(26.91/2, 8) = 15.65 and the arm
  // straightens at 31.31 local px.
  const ARM_REACH = 2 * Math.hypot(Math.hypot(18, 20) / 2, 8);
  const LEAN_CAP = 16;
  const HALF = SHOULDER_HALF_WIDTH;
  const SHOULDER = { x: 0, y: -64 };
  const ROOT_R = { x: HALF, y: -64 }; // the FRONT shoulder — a jab / generic driver
  const ROOT_L = { x: -HALF, y: -64 }; // the REAR shoulder — the gyaku driver
  const STANCE_HAND_L = { x: -18, y: -44 };

  // The driving shoulder's lean, written independently of production: how far past that arm's straight
  // reach the target sits, floored at 0 (already reachable ⇒ no lean) and capped. Measured from the
  // DRIVING arm's OWN shoulder root (M12d).
  const leanFor = (root: Joint, handX: number, bandY: number) =>
    Math.min(
      LEAN_CAP,
      Math.max(0, Math.hypot(handX - root.x, bandY - root.y) - ARM_REACH),
    );

  // The midpoint + head advance HALF the driving shoulder's lean — the girdle rotates (S4 · Slice 5).
  const midFor = (root: Joint, handX: number, bandY: number) =>
    leanFor(root, handX, bandY) / 2;

  const poseOf = ({
    gap = 240_000,
    band = 3,
    move = "gyaku-zuki",
    reach = 240_000,
    extra = {},
  }: {
    gap?: number;
    band?: number;
    move?: string;
    reach?: number;
    extra?: Partial<ReplayFrame>;
  } = {}) =>
    scene(
      [
        tickOf(
          0,
          {
            attacking: true,
            attackBand: band,
            attackReach: reach,
            attackMove: move,
            x: 150_000,
            facing: 1,
            ...extra,
          },
          { x: 150_000 + gap },
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

  it("does not lean at all when the arm can already reach the target", () => {
    // The headline change, shown on the FRONT arm (a jab): a 120k gap puts the near edge at 28px and a
    // high target 4px above the front shoulder, so the arm spans 21.4 against a 31.3 reach — it gets
    // there on its own, and the torso stays upright. The old heuristic lunged for it regardless. (At
    // this same gap a REVERSE punch's rear arm still falls short and leans — the per-arm point criterion
    // 3 of the slice-5 block pins; here it is the jab that proves "reachable ⇒ no lean".)
    const pose = poseOf({ move: "kizami-zuki", gap: 120_000 });

    expect(pose.shoulder).toEqual(
      scaled({ x: midFor(ROOT_R, 28, -68), y: -64 }),
    );
    expect(pose.head).toEqual(scaled({ x: midFor(ROOT_R, 28, -68), y: -76 }));
  });

  it("leans by the shortfall — not by half the reach — when the arm falls short", () => {
    // The uncapped middle of the range, where a derived lean and a proportional one disagree most
    // visibly. A reverse punch at a 130k gap / mid band puts the target 42.2 from the REAR shoulder:
    // 10.9 past the arm's reach, so the driving shoulder covers 10.9 and the midpoint carries half of
    // it. The heuristic would have covered its full 16px cap.
    const pose = poseOf({ move: "gyaku-zuki", gap: 130_000, band: 2 });

    expect(pose.shoulder).toEqual(
      scaled({ x: midFor(ROOT_L, 31.1666, -46), y: -64 }),
    );
    expect(pose.head).toEqual(
      scaled({ x: midFor(ROOT_L, 31.1666, -46), y: -76 }),
    );
    expect(leanFor(ROOT_L, 31.1666, -46)).toBeLessThan(LEAN_CAP);
  });

  it("reads the vertical drop to the target, not just the forward reach", () => {
    // The mutation-critical case. Two reverse punches with the SAME forward x to DIFFERENT bands are
    // different distances from the rear shoulder — a mid target sits 18px below it, a high target 4px
    // above — so they must lean differently. Under the old heuristic (a function of x alone) they
    // leaned identically. Without this, a production mutant that drops the vertical term survives every
    // other test in this block.
    const high = poseOf({ move: "gyaku-zuki", gap: 130_000, band: 3 });
    const mid = poseOf({ move: "gyaku-zuki", gap: 130_000, band: 2 });

    expect(mid.shoulder.x).toBeGreaterThan(high.shoulder.x);
    expect(high.shoulder).toEqual(
      scaled({ x: midFor(ROOT_L, 31.1666, -68), y: -64 }),
    );
    expect(mid.shoulder).toEqual(
      scaled({ x: midFor(ROOT_L, 31.1666, -46), y: -64 }),
    );
  });

  it("caps the lean, so the workhorse punch's torso leans a bounded, halved amount", () => {
    // The regression pin for the move this story authored. gyaku-zuki's reach and the dojo's default
    // gap are both 240k, so its hand solves to 66 and the rear-shoulder shortfall (41.8) saturates the
    // 16px cap — the DRIVING shoulder still steps the full 16, but the midpoint now carries half (8,
    // S4 · Slice 5). The driven hand is untouched by the lean whatever the torso does.
    const pose = poseOf({ move: "gyaku-zuki", gap: 240_000, band: 3 });

    expect(pose.shoulder).toEqual(scaled({ x: LEAN_CAP / 2, y: -64 }));
    expect(pose.handL).toEqual(scaled({ x: 66, y: -68 })); // the driven hand does NOT ride the lean
  });

  it("keeps the upper body upright while the punch is still chambering", () => {
    // M9's phase gate, re-pinned because this slice rewrites the expression it guards. A fighter leans
    // INTO a technique as it extends, never while winding up.
    const pose = poseOf({ gap: 240_000, extra: { attackPhase: 1 } });

    expect(pose.shoulder).toEqual(scaled(SHOULDER));
  });

  it("leaves a kick's hip step alone and still does not lean over it", () => {
    // The two mechanisms now share one function, so this pins that sharing it did not cross the wires:
    // a kick steps the HIP and keeps the torso upright (pitching forward over a rising leg reads as
    // falling into the kick), exactly as before.
    const kick = poseOf({ move: "mae-geri", band: 2, reach: 270_000 });

    expect(kick.shoulder).toEqual(scaled(SHOULDER));
    expect(kick.hip.x).toBeGreaterThan(scaled({ x: 0, y: -34 }).x);
  });

  it("leaves the resting hand at its stance position — the ride is retired", () => {
    // A jab drives handR, so handL just rests. S4 · Slice 3 carried it forward with the shoulder the
    // SLIDE moved (else the arm stretched); S4 · Slice 5 rotates instead, leaving the rear shoulder
    // put, so the resting hand sits at its absolute stance point again and the workaround is gone.
    const jab = poseOf({ move: "kizami-zuki", reach: 210_000 });

    expect(jab.handL).toEqual(scaled(STANCE_HAND_L));
  });

  it("keeps the resting arm's bones at their stance length instead of stretching them", () => {
    // The on-screen meaning of the point above, and the S2 · Slice 3 bone-length guarantee. Measured
    // from the arm's REAL root — the rear shoulder (shoulderL) it hangs off, not the girdle midpoint —
    // so a floored elbow (each bone silently grown to half an over-long span) would show as drift.
    // With the resting shoulder put and the hand at stance, the span stays inside reach and the bones
    // hold. Asserted as drift from the fighter's OWN stance bones, 2% tolerance (joints round to whole
    // px after a ~6.3× scale, so a measured bone can drift ~1%).
    const BONE_TOLERANCE = 0.02;

    const boneLength = (from: Joint, to: Joint) =>
      Math.hypot(to.x - from.x, to.y - from.y);

    const jab = poseOf({ move: "kizami-zuki", reach: 210_000 });

    const stance = poseOf({
      move: "kizami-zuki",
      reach: 210_000,
      extra: { attacking: false },
    });

    const drift = (from: "shoulderL" | "elbowL", to: "elbowL" | "handL") =>
      Math.abs(
        boneLength(jab[from], jab[to]) / boneLength(stance[from], stance[to]) -
          1,
      );

    expect(drift("shoulderL", "elbowL")).toBeLessThan(BONE_TOLERANCE);
    expect(drift("elbowL", "handL")).toBeLessThan(BONE_TOLERANCE);
  });

  // No test here for "an authored hikite pull does not ride the lean" (there was one through slice 4):
  // the pull hangs off the FRONT shoulder, which the rotation leaves put for a rear-hand punch, so
  // there is no lean under it to ride. That the pull is a destination drawn back near the hip and
  // inside its reach is pinned by the slice-2 block (behind stance) and criterion 4 of the slice-5
  // block (inside reach) — asserting a tuned coordinate again here would only re-pin an eye value.

  it("leaves a raised guard where the guard layer put it", () => {
    // Same rule, the other authored destination. A guard is placed at a fixed protective x; riding the
    // lean would push it forward of the guarding distance the layer chose. Engine-impossible alongside
    // a strike, /dojo-reachable by design (M10).
    const pose = poseOf({
      move: "kizami-zuki",
      reach: 210_000,
      extra: { guardBand: 2 },
    });

    expect(pose.handL).toEqual(scaled({ x: 8, y: -46 }));
  });

  // NO root-x test here, though the slice's acceptance criteria listed one. "The lean shifts the pose,
  // not the world position" is already pinned in the M2 lean block above, and the root x is computed in
  // `figure()` from the tape alone — `poseFor` is never given it and cannot reach it. A second copy
  // would assert the same guarantee against the same mechanism.
});

describe("scene — the fighter gets a shoulder girdle (S4 · Slice 4)", () => {
  // Slices 1–2 gave the reverse punch its own arm and its own chamber, and slice 3's eye-check then
  // measured what a spectator actually sees: the driven hands of a jab and a reverse punch land on
  // the IDENTICAL pixel (417,−429 at the workhorse distance), because both arms hang off one
  // `shoulder` joint and both solve toward the same target. The entire distinction lived in the
  // RESTING hand. A real body throws a reverse punch from the BACK shoulder — a girdle is what makes
  // the two arm LINES differ, which is the thing slices 1–2 could not produce (M12).
  //
  // `shoulder` is redefined as the girdle's MIDPOINT (the spine's top, the head's anchor), with
  // `shoulderL` / `shoulderR` derived at ± SHOULDER_HALF_WIDTH. The lean is deliberately NOT touched
  // here: it still moves the midpoint, so both ends travel together and the girdle stays rigid.
  // Slice 5 is what makes it rotate.

  // Recomputed from the documented STAND geometry rather than imported, same discipline as the
  // slice-3 block: shoulder {0,−64} → hand {18,−44} spans 26.91, so one bone is 15.65 and the arm
  // straightens at 31.31 local px. ARM_BONE must NOT be re-derived from the new, shorter span.
  const ARM_REACH = 2 * Math.hypot(Math.hypot(18, 20) / 2, 8);

  const dist = (a: Joint, b: Joint) => Math.hypot(b.x - a.x, b.y - a.y);

  // Joint coordinates round to whole pixels after a ~6.3× scale, so a distance between two of them
  // carries up to ~1px of rounding error. Every "these two lengths are equal" assertion below allows
  // for that and no more — a mutant that re-roots a limb moves it by tens of pixels.
  const PX = 1.5;

  const poseOf = ({
    gap = 240_000,
    band = 3,
    move = "gyaku-zuki",
    reach = 240_000,
    attacking = true,
    extra = {},
  }: {
    gap?: number;
    band?: number;
    move?: string;
    reach?: number;
    attacking?: boolean;
    extra?: Partial<ReplayFrame>;
  } = {}) =>
    scene(
      [
        tickOf(
          0,
          {
            attacking,
            attackBand: band,
            attackReach: reach,
            attackMove: move,
            x: 150_000,
            facing: 1,
            ...extra,
          },
          { x: 150_000 + gap },
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

  it("roots the rear arm at the rear shoulder, not at the midpoint", () => {
    // `deriveBend` puts a limb's mid-joint on the perpendicular bisector of its endpoints, so its two
    // bones are ALWAYS equal in length whatever the reach does — including when the arm straightens.
    // Measured from `shoulderL`, that equality holds only if the elbow was actually derived there: an
    // elbow still rooted at the midpoint sits 202 and 158 from the two ends, not 180 and 180.
    const pose = poseOf();

    expect(
      Math.abs(
        dist(pose.shoulderL, pose.elbowL) - dist(pose.elbowL, pose.handL),
      ),
    ).toBeLessThan(PX);
    // ...and it STARTS behind the midpoint. Shown on an IDLE pose, since a committed reverse punch
    // rotates the rear shoulder forward PAST the midpoint (S4 · Slice 5) — that swing is the point of
    // the next slice, not a contradiction of "the rear arm is rooted at the rear shoulder".
    const idle = poseOf({ attacking: false });

    expect(idle.shoulderL.x).toBeLessThan(idle.shoulder.x);
  });

  it("makes a reverse punch and a jab draw different arm lines", () => {
    // The payoff, and the reason this slice exists. Both punches still drive their hand to the same
    // pixel; what differs is where the arm STARTS. The rear arm spans 57.1 local px from a shoulder
    // at x 9, the front arm 43.2 from a shoulder at x 23 — a difference of 13.95, which is 2 × the
    // half-width shortened slightly by the 4px the hands sit below shoulder height.
    const reverse = poseOf({ move: "gyaku-zuki" });
    const jab = poseOf({ move: "kizami-zuki" });

    const reverseSpan = dist(reverse.shoulderL, reverse.handL);
    const jabSpan = dist(jab.shoulderR, jab.handR);

    expect(reverseSpan).toBeGreaterThan(jabSpan);
    expect(
      Math.abs(reverseSpan - jabSpan - 2 * SHOULDER_HALF_WIDTH * BODY_SCALE),
    ).toBeLessThan(3);
  });

  it("separates the two punches by a VISIBLE amount, not merely a positive one", () => {
    // The magnitude pin. Every other assertion in this block is written against the imported
    // SHOULDER_HALF_WIDTH so a deliberate re-tune re-flows them — which means a mutant setting that
    // constant to 0 would make production and expectation agree at zero and survive. This test uses a
    // LITERAL floor instead: the difference must clear 40 screen px on a 480px body (~8% of height).
    // Loose enough to survive re-tuning the girdle narrower, strict enough that no girdle fails it.
    const reverse = poseOf({ move: "gyaku-zuki" });
    const jab = poseOf({ move: "kizami-zuki" });

    expect(
      dist(reverse.shoulderL, reverse.handL) - dist(jab.shoulderR, jab.handR),
    ).toBeGreaterThan(40);
  });

  it("hangs the girdle horizontally and centred on the midpoint", () => {
    const pose = poseOf({ attacking: false });

    expect(pose.shoulderL.y).toBe(pose.shoulder.y);
    expect(pose.shoulderR.y).toBe(pose.shoulder.y);
    expect(pose.shoulder.x - pose.shoulderL.x).toBe(
      pose.shoulderR.x - pose.shoulder.x,
    );
  });

  it("keeps each arm's bones at their STANCE length when the girdle shortens the span", () => {
    // The girdle shrinks the idle arm's span from 26.91 to 22.83, so the elbow bows deeper (8.00 →
    // 10.71). That is a consequence of the shorter span, NOT of a shorter bone: ARM_BONE stays 15.65.
    // Re-deriving it from the new span would give 13.94 — an 11px error on screen — so this is the
    // assertion that pins M12b, that widening the shoulders does not shorten the arms.
    const pose = poseOf({ attacking: false });
    const bone = (ARM_REACH / 2) * BODY_SCALE;

    expect(Math.abs(dist(pose.shoulderR, pose.elbowR) - bone)).toBeLessThan(PX);
    expect(Math.abs(dist(pose.elbowR, pose.handR) - bone)).toBeLessThan(PX);
    expect(Math.abs(dist(pose.shoulderL, pose.elbowL) - bone)).toBeLessThan(PX);
  });

  it("collapses both shoulders onto the one authored point when the fighter is down", () => {
    // PRONE authors its own complete skeleton and wins by early return, so a knockdown must render
    // exactly as it did before the girdle existed (M12g). Any visible change here is a bug, not a
    // judgement call — a downed body has no girdle to twist.
    const pose = scene(
      [tickOf(0, { knockdown: true, x: 150_000, facing: 1 }, { x: 390_000 })],
      0,
      VIEWPORT,
    ).a.pose;

    expect(pose.shoulderL).toEqual(pose.shoulder);
    expect(pose.shoulderR).toEqual(pose.shoulder);
    expect(pose.shoulder).toEqual(scaled({ x: -24, y: -10 }));
    expect(pose.head).toEqual(scaled({ x: -40, y: -10 }));
    expect(pose.hip).toEqual(scaled({ x: 6, y: -10 }));
  });

  it("leaves the legs rooted at the single hip — there is no hip girdle", () => {
    // M12i: a girdle separates two moves only when they drive DIFFERENT limbs, and both kicks drive
    // footR, so splitting the hips buys nothing today. Same bone-equality probe as the rear arm — a
    // knee derived off some new hipR would not sit equidistant from the one `hip`.
    const pose = poseOf({ move: "mae-geri", band: 2 });

    expect(
      Math.abs(dist(pose.hip, pose.kneeR) - dist(pose.kneeR, pose.footR)),
    ).toBeLessThan(PX);
    expect(
      Math.abs(dist(pose.hip, pose.kneeL) - dist(pose.kneeL, pose.footL)),
    ).toBeLessThan(PX);
  });

  // Slice 4 shipped a bounded intermediate state here: the rigid girdle slid the FRONT shoulder to
  // x 23, stretching the authored `hikite` fist 8.7% past its reach (a test asserted that ≤10%
  // ceiling). S4 · Slice 5 rotates the girdle instead, returning the front shoulder to x 7 and pulling
  // the fist fully INSIDE its reach — so that ceiling test is superseded by criterion 4 of the slice-5
  // block, which pins the tightened "bones stay at stance length" guarantee. The stretch is gone, so
  // there is nothing bounded left to assert here.
});

describe("scene — the torso rotates into the punch (S4 · Slice 5)", () => {
  // Slice 4 gave the girdle two ends but kept it RIGID: the lean slid the midpoint forward and both
  // shoulders travelled with it. A reverse punch anatomically ROTATES — the rear shoulder comes
  // through while the front stays — so slice 5 drives only the STRIKING shoulder forward by the lean,
  // moves the midpoint and head HALF that far, and measures the shortfall from each arm's OWN root
  // (M12 d/e/f). The payoffs pinned below: the rear shoulder passes the front on a committed reverse
  // punch, a reverse punch leans more than a jab at mid range, and — the reason the whole girdle arc
  // exists — the front shoulder is back at its stance x, so hikite can be drawn to the hip without
  // stretching the arm. Slice 3's hand-ride goes with the slide that caused it.
  //
  // Recomputed from the documented geometry, independent of production: HALF is the girdle half-width,
  // the arm straightens at 2·ARM_BONE = 31.31 local px, and the lean caps at 16.
  const HALF = SHOULDER_HALF_WIDTH;
  const LEAN_CAP = 16;
  const ARM_REACH = 2 * Math.hypot(Math.hypot(18, 20) / 2, 8);
  const PX = 1.5;
  const dist = (a: Joint, b: Joint) => Math.hypot(b.x - a.x, b.y - a.y);

  const poseOf = ({
    gap = 240_000,
    band = 3,
    move = "gyaku-zuki",
    reach = 240_000,
    extra = {},
  }: {
    gap?: number;
    band?: number;
    move?: string;
    reach?: number;
    extra?: Partial<ReplayFrame>;
  } = {}) =>
    scene(
      [
        tickOf(
          0,
          {
            attacking: true,
            attackBand: band,
            attackReach: reach,
            attackMove: move,
            x: 150_000,
            facing: 1,
            ...extra,
          },
          { x: 150_000 + gap },
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

  it("drives the rear shoulder forward while the front shoulder stays — the torso twists, not slides", () => {
    // Criterion 1. gyaku-zuki drives handL, so the REAR shoulder (shoulderL) travels the full lean and
    // the FRONT one (shoulderR) does not move at all. A slide carries BOTH forward together, so the
    // resting shoulder staying at its stance +HALF is what separates rotate from slide — and at the
    // workhorse the driven rear shoulder (−7 + 16 = 9) comes AROUND past the front (7).
    const pose = poseOf({ move: "gyaku-zuki", gap: 240_000, band: 3 });

    expect(pose.shoulderR).toEqual(scaled({ x: HALF, y: -64 }));
    expect(pose.shoulderL.x).toBeGreaterThan(pose.shoulderR.x);
  });

  it("moves the head and midpoint half as far as the driving shoulder", () => {
    // Criterion 2. A rotation with a half-lunge, not a full one: the midpoint (`shoulder`) and head
    // travel lean/2 while the driving shoulder travels the full lean. Pinned both as the literal half
    // of the cap (8) and as the 2:1 ratio, so neither a full-lunge nor a no-lunge mutant survives.
    const pose = poseOf({ move: "gyaku-zuki", gap: 240_000, band: 3 });

    expect(pose.shoulder).toEqual(scaled({ x: LEAN_CAP / 2, y: -64 }));
    expect(pose.head).toEqual(scaled({ x: LEAN_CAP / 2, y: -76 }));

    const midTravel = pose.shoulder.x - scaled({ x: 0, y: -64 }).x;
    const driveTravel = pose.shoulderL.x - scaled({ x: -HALF, y: -64 }).x;

    expect(Math.abs(driveTravel - 2 * midTravel)).toBeLessThan(PX);
  });

  it("leans a reverse punch more than a jab at mid range, measuring each from its own shoulder", () => {
    // Criterion 3. The girdle's payoff where the arm-span axis is weakest. At a gap the FRONT arm can
    // already span, a jab stands upright while the rear arm still falls short, so a reverse punch to
    // the same spot leans in. Measured per-arm: a shared-root lean would move both identically.
    const reverse = poseOf({ move: "gyaku-zuki", gap: 120_000, band: 2 });
    const jab = poseOf({ move: "kizami-zuki", gap: 120_000, band: 2 });

    expect(jab.shoulder).toEqual(scaled({ x: 0, y: -64 })); // front arm reaches ⇒ upright
    expect(reverse.shoulder.x).toBeGreaterThan(jab.shoulder.x); // rear arm short ⇒ leans

    // The mirror, at the workhorse where both cap: a jab drives the FRONT shoulder and leaves the REAR
    // at stance — the opposite hand from the reverse punch in criterion 1.
    const jabHard = poseOf({
      move: "kizami-zuki",
      gap: 240_000,
      band: 3,
      reach: 210_000,
    });

    expect(jabHard.shoulderL).toEqual(scaled({ x: -HALF, y: -64 }));
  });

  it("keeps the pulled fist inside its reach with the front shoulder back at stance (hikite to the hip)", () => {
    // Criterion 4. The reason to rotate instead of slide: the front shoulder stays at +HALF, so
    // gyaku-zuki's withdrawn fist can sit back near the hip while its arm reads jointed rather than
    // stretched. Slice 4 slid that shoulder to 23 and the fist stretched 8.7% past reach; now the arm
    // keeps its stance bone length. The RELATION, not the tuned coordinate — decision 9.
    const pose = poseOf({ move: "gyaku-zuki", gap: 240_000, band: 3 });
    const bone = (ARM_REACH / 2) * BODY_SCALE;

    expect(Math.abs(dist(pose.shoulderR, pose.elbowR) - bone)).toBeLessThan(PX);
    expect(Math.abs(dist(pose.elbowR, pose.handR) - bone)).toBeLessThan(PX);
    // ...and the fist is genuinely withdrawn — behind the front shoulder it hangs from.
    expect(pose.handR.x).toBeLessThan(pose.shoulderR.x);
  });

  it("does not rotate the girdle for a kick or a throw — those never lean", () => {
    // Criterion 5. Rotation is a hand-strike property (the lean is already zero for a kick and for a
    // throw), so both keep a square, centred girdle. Status-quo guard: a mutant that rotated on every
    // committed action would splay these.
    const kick = poseOf({ move: "mae-geri", band: 2, reach: 270_000 });

    expect(kick.shoulderL).toEqual(scaled({ x: -HALF, y: -64 }));
    expect(kick.shoulderR).toEqual(scaled({ x: HALF, y: -64 }));

    const throwPose = scene(
      [
        tickOf(
          0,
          {
            throwing: true,
            attackMove: "throw",
            attackReach: 240_000,
            x: 150_000,
            facing: 1,
          },
          { x: 390_000 },
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

    expect(throwPose.shoulderL).toEqual(scaled({ x: -HALF, y: -64 }));
    expect(throwPose.shoulderR).toEqual(scaled({ x: HALF, y: -64 }));
  });

  it("retires the hand-ride — a jab's resting rear hand stays at its stance position", () => {
    // Criterion 6. Slice 3 carried a resting hand forward with the shoulder the slide moved. Rotation
    // leaves the resting shoulder put, so the workaround goes: the jab's rear hand sits at its absolute
    // stance point again, not stance + lean (under the slid code it rode to −18 + 16 = −2).
    const jab = poseOf({
      move: "kizami-zuki",
      gap: 240_000,
      band: 3,
      reach: 210_000,
    });

    expect(jab.handL).toEqual(scaled({ x: -18, y: -44 }));
  });
});

describe("scene — the roundhouse kicks with the rear leg (S4 · Slice 6)", () => {
  // mae-geri and mawashi-geri BOTH drive a foot, so under M3 (only the driven endpoint moves) they
  // solve to the identical pixel at the same band and gap — the same wall that made a reverse punch
  // and a jab one picture before the girdle. The girdle cannot help: it separates two moves only when
  // they drive DIFFERENT limbs (M12i). So the roundhouse takes the escape hatch decision 3 reserved —
  // it drives the REAR foot (footL). A front kick snaps the front leg straight out; a roundhouse
  // swings the rear leg across. "Different leg" is a thing a 2-D side view can actually show; a lateral
  // hip turn is not. Same solve (reachTargetX), same phase machinery — only the endpoint it lands on
  // differs, which is exactly the descriptor-plus-shared-solver bet.
  //
  // Local-px anchors, recomputed independent of production: one sub-unit is 76/240000 local px, so a
  // 240k gap is 76px between centres and the near edge sits one BODY_HALF_WIDTH (10) nearer ⇒ 66.
  // mawashi-geri's 300k reach caps at 300000·(76/240000) = 95, so an in-range kick lands on the edge.
  const NEUTRAL_FOOT_L = { x: -14, y: 0 }; // STAND rear foot — the DRIVEN leg here
  const NEUTRAL_FOOT_R = { x: 14, y: 0 }; // STAND front foot — the SUPPORT leg here

  const CHAMBER = 1;
  const CONTACT = 2;
  const RECOVER = 3;

  const poseRound = ({
    gap = 240_000,
    band = 2,
    reach = 300_000,
    extra = {},
  }: {
    gap?: number;
    band?: number;
    reach?: number;
    extra?: Partial<ReplayFrame>;
  } = {}) =>
    scene(
      [
        tickOf(
          0,
          {
            attacking: true,
            attackBand: band,
            attackReach: reach,
            attackMove: "mawashi-geri",
            x: 150_000,
            facing: 1,
            ...extra,
          },
          { x: 150_000 + gap },
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

  // A mae-geri companion at the SAME geometry — the front-leg kick the roundhouse must read apart from.
  const poseFront = ({ gap = 240_000, band = 2 } = {}) =>
    scene(
      [
        tickOf(
          0,
          {
            attacking: true,
            attackBand: band,
            attackReach: 270_000,
            attackMove: "mae-geri",
            x: 150_000,
            facing: 1,
          },
          { x: 150_000 + gap },
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

  it("drives the REAR foot to the opponent's near edge, leaving the front foot planted (M8.1/8.2)", () => {
    const pose = poseRound();

    // The kick lands on footL — the rear leg — at the near edge (66), where mae-geri lands its footR.
    expect(pose.footL).toEqual(scaled({ x: 66, y: -46 }));
    // The front foot is the SUPPORT leg now: it holds its stance. The fighter neither slides nor floats.
    expect(pose.footR).toEqual(scaled(NEUTRAL_FOOT_R));
  });

  it("moves a DIFFERENT leg than mae-geri at the same band and gap — the escape hatch (criterion 1)", () => {
    // The whole reason the roundhouse drives the rear leg: a front kick and a roundhouse solve to the
    // SAME target, so putting that target on the OTHER leg is what makes them two pictures instead of
    // one. mae-geri drives footR and rests footL; mawashi-geri drives footL and rests footR — the same
    // solved endpoint, on the swapped legs.
    const front = poseFront();
    const round = poseRound();

    // Same solved endpoint...
    expect(round.footL).toEqual(front.footR);
    // ...on the swapped legs: each move rests the leg the other drives.
    expect(round.footR).toEqual(scaled(NEUTRAL_FOOT_R));
    expect(front.footL).toEqual(scaled(NEUTRAL_FOOT_L));
    // ...and within the roundhouse the two feet land genuinely apart — one driven, one planted.
    expect(round.footR).not.toEqual(round.footL);
  });

  it("tracks the real opponent distance — the rear-leg solve is retained (M8.5)", () => {
    // Two gaps, two phase-2 endpoints: the roundhouse foot tracks true distance through the SAME
    // reachTargetX a fist uses, not a fixed authored extension. 150k ⇒ edge 37.5, 240k ⇒ 66, both
    // inside the 95 cap.
    expect(poseRound({ gap: 150_000 }).footL).toEqual(
      scaled({ x: 37.5, y: -46 }),
    );
    expect(poseRound({ gap: 240_000 }).footL).toEqual(
      scaled({ x: 66, y: -46 }),
    );
  });

  it("chambers the rear leg during startup, then whips it forward at contact (M8.3/8.4)", () => {
    const chambered = poseRound({ extra: { attackPhase: CHAMBER } }).footL;
    const extended = poseRound({ extra: { attackPhase: CONTACT } }).footL;

    // A wind-up is a different SHAPE, not a shorter reach (M3).
    expect(chambered).not.toEqual(extended);
    // M8.4 direction: the kick EXTENDS forward from its chamber, never retracts into contact.
    expect(chambered.x).toBeLessThan(extended.x);
    // Lifted off the ground — a chambered leg is cocked knee-up, not resting in stance.
    expect(chambered.y).toBeLessThan(0);
    // ...and distinct from where the leg rests: the chamber is an authored point, not the stance.
    expect(chambered).not.toEqual(scaled(NEUTRAL_FOOT_L));
  });

  it("keeps the support (front) leg planted through every phase (M8.2)", () => {
    [CHAMBER, CONTACT, RECOVER].forEach((attackPhase) =>
      expect(poseRound({ extra: { attackPhase } }).footR).toEqual(
        scaled(NEUTRAL_FOOT_R),
      ),
    );
  });

  it("is a kick, not a punch: it steps the hip and stays upright, with no torso rotation (M9)", () => {
    const pose = poseRound();

    // Upright: the head + girdle midpoint hold their stance x. A kick counterbalances — it does not
    // pitch the torso forward into the reach the way a punch leans.
    expect(pose.head).toEqual(scaled({ x: 0, y: -76 }));
    expect(pose.shoulder).toEqual(scaled({ x: 0, y: -64 }));
    // No rotation: the girdle stays SQUARE, both shoulders equidistant from the midpoint. A footL
    // strike must not accidentally swing the girdle the way a rear-HAND punch does.
    expect(pose.shoulderR.x - pose.shoulder.x).toBe(
      pose.shoulder.x - pose.shoulderL.x,
    );
    // But the hip STEPS forward — the leg cannot span the gap alone, so the kicking root closes part
    // of the shortfall, exactly as mae-geri's front-leg step does.
    expect(pose.hip.x).toBeGreaterThan(scaled({ x: 0, y: -34 }).x);
    expect(pose.hip.y).toBe(scaled({ x: 0, y: -34 }).y);
  });

  it("bends the rear knee off the straight hip → footL line, so the kicking leg reads jointed (M8.6)", () => {
    // Measured at a gap the leg can actually reach (120k), where fixed bone lengths leave slack to
    // bend; kneeL re-derives off the MOVED hip → footL for free (the bend rule runs on the final
    // endpoints). Non-collinearity via the cross product of (hip → footL) against (hip → kneeL).
    const pose = poseRound({ gap: 120_000 });

    const cross =
      (pose.footL.x - pose.hip.x) * (pose.kneeL.y - pose.hip.y) -
      (pose.footL.y - pose.hip.y) * (pose.kneeL.x - pose.hip.x);

    expect(cross).not.toBe(0);
  });

  it("does not disturb mae-geri — the front kick still drives the front leg (M7)", () => {
    // The new footL route is additive: mae-geri keeps driving footR to the edge and resting footL, so
    // adding the rear-leg branch left the proven front-kick path untouched.
    const front = poseFront();

    expect(front.footR).toEqual(scaled({ x: 66, y: -46 }));
    expect(front.footL).toEqual(scaled(NEUTRAL_FOOT_L));
  });
});

describe("scene — empi leads with the elbow (S5 · Slice 1)", () => {
  // Every strike so far drives an ENDPOINT (a hand, a foot) and lets deriveBend COMPUTE the mid-joint.
  // empi inverts that: the driven point is the ELBOW — a joint the bend rule currently computes — and
  // the fist TRAILS, folded back behind the elbow tip. This is the mechanism-carrier slice (M13): it
  // promotes a mid-joint to a first-class driven StrikeLimb end to end.
  //
  // The RED driver is the ROUTING. Today "empi" is undescribed, so limbFor falls to the generic front
  // hand — the FIST drives to the target and elbowR is only the derived shoulderR→handR bisector. The
  // inversion assertions (elbow AT the target, fist BEHIND it) fail for exactly that reason until the
  // elbowR route exists.
  //
  // Local-px anchors, recomputed independent of production (one sub-unit = 76/240000 local px):
  //  · CLOSE anchor — empi's REAL reach (95k) at a 120k gap: centres 38 local px apart, near edge one
  //    BODY_HALF_WIDTH (10) nearer ⇒ 28; empi's cap is 95000·(76/240000) = 30.08, so 28 lands in range.
  //    This is the in-character close-range picture the elbow strike actually draws (and where M13g's
  //    figure overlap lives — confirmed by eye in /dojo, not asserted here).
  //  · FAR anchor — a controlled 240k reach at a 240k gap ⇒ edge 66, the standard anchor the strike and
  //    throw blocks share. A HAND at this reach LEANS 16 (rootTravel over 2·ARM_BONE); a mid-joint must
  //    NOT (M13f: hold the root). Using the far anchor is what makes the lean gate load-bearing and the
  //    root-held test a real RED driver rather than a vacuum — the same reason the strike block probes
  //    reach with controlled values.
  const NEUTRAL_HAND_R = { x: 18, y: -44 }; // STAND front hand — the fist's stance, which it LEAVES
  const NEUTRAL_HAND_L = { x: -18, y: -44 }; // STAND rear hand — untouched by a front-elbow strike
  const NEUTRAL_FOOT_L = { x: -14, y: 0 }; // STAND feet — a mid-joint strike is not a kick, so they
  const NEUTRAL_FOOT_R = { x: 14, y: 0 }; // stay planted (no step)

  const STARTUP = 1;
  const CONTACT = 2;
  const RECOVER = 3;

  // Striker `a` faces right at x 150000 committing empi; `b` sits `gap` sub-units in front. Defaults to
  // the CLOSE anchor (empi's real 95k reach); the far cases override reach + gap.
  const poseEmpi = ({
    gap = 120_000,
    band = 2,
    reach = 95_000,
    extra = {},
  }: {
    gap?: number;
    band?: number;
    reach?: number;
    extra?: Partial<ReplayFrame>;
  } = {}) =>
    scene(
      [
        tickOf(
          0,
          {
            attacking: true,
            attackBand: band,
            attackReach: reach,
            attackMove: "empi",
            x: 150_000,
            facing: 1,
            ...extra,
          },
          { x: 150_000 + gap },
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

  it("leads with the elbow — the elbow drives to the near edge and the fist trails behind it", () => {
    // The inversion (guard 7, anti-clobber). The DRIVEN point is elbowR, landing ON the near edge (28)
    // at the mid band — NOT the deriveBend bisector the old front-hand path leaves there. The fist rides
    // BEHIND the elbow tip (elbowR.x > handR.x), the reverse of a punch where the hand leads.
    const pose = poseEmpi();

    expect(pose.elbowR).toEqual(scaled({ x: 28, y: -46 }));
    expect(pose.elbowR.x).toBeGreaterThan(pose.handR.x);
  });

  it("folds the forearm at an angle — the elbow reads jointed, the fist tucked behind the tip", () => {
    // Guard 6 (jointedness). The fist tucks back RELATIVE to the elbow (M13c), so the forearm
    // elbowR→handR bends off the upper arm shoulderR→elbowR — non-collinear, via their cross product —
    // and the fist sits behind the tip (handR.x < elbowR.x). Today the fist IS the driven target, so it
    // sits FORWARD of the derived elbow; the fold-back assertion fails until the tuck exists.
    const pose = poseEmpi();

    const cross =
      (pose.elbowR.x - pose.shoulderR.x) * (pose.handR.y - pose.elbowR.y) -
      (pose.elbowR.y - pose.shoulderR.y) * (pose.handR.x - pose.elbowR.x);

    expect(cross).not.toBe(0);
    expect(pose.handR.x).toBeLessThan(pose.elbowR.x);
    // The fist actually FOLDED — it left its stance rather than being ignored (kills a mutant that
    // drops the trailing-endpoint write, which would leave the stance hand behind the elbow tip and
    // still satisfy the two checks above).
    expect(pose.handR).not.toEqual(scaled(NEUTRAL_HAND_R));
  });

  it("holds the root — a mid-joint strike does not lean the torso, even at a far target (M13f)", () => {
    // M13f: suppress the forward-root motion for a mid-joint. At the FAR anchor a HAND would lean 16
    // (head + girdle midpoint advancing 8, the driving shoulder swinging through); the elbow reaches
    // the far edge (66) with the head, girdle midpoint and BOTH shoulders held at their square stance —
    // absolute ±7 shoulders, because the equidistant-from-midpoint check is invariant under rotation.
    const pose = poseEmpi({ gap: 240_000, reach: 240_000 });

    expect(pose.elbowR).toEqual(scaled({ x: 66, y: -46 })); // it DID reach far — not a no-op
    expect(pose.head).toEqual(scaled({ x: 0, y: -76 }));
    expect(pose.shoulder).toEqual(scaled({ x: 0, y: -64 }));
    expect(pose.shoulderL).toEqual(scaled({ x: -SHOULDER_HALF_WIDTH, y: -64 }));
    expect(pose.shoulderR).toEqual(scaled({ x: SHOULDER_HALF_WIDTH, y: -64 }));
    expect(pose.hip).toEqual(scaled({ x: 0, y: -34 }));
  });

  it("tracks the real opponent distance — the elbow solve is retained (guard 5)", () => {
    // The elbow tracks true distance through the SAME reachTargetX a fist uses, not a fixed authored
    // extension: two gaps, two phase-2 elbow endpoints (28 and 66), both inside a 240k reach cap (76).
    expect(poseEmpi({ gap: 120_000, reach: 240_000 }).elbowR).toEqual(
      scaled({ x: 28, y: -46 }),
    );
    expect(poseEmpi({ gap: 240_000, reach: 240_000 }).elbowR).toEqual(
      scaled({ x: 66, y: -46 }),
    );
  });

  it("leaves the other limbs at their stance — feet planted, rear hand home (root held)", () => {
    // A front-elbow strike is not a kick and pulls no hikite, so the support feet and the rear hand hold
    // their stance — only the driving arm (elbowR + its trailing fist) moves.
    const pose = poseEmpi();

    expect(pose.footL).toEqual(scaled(NEUTRAL_FOOT_L));
    expect(pose.footR).toEqual(scaled(NEUTRAL_FOOT_R));
    expect(pose.handL).toEqual(scaled(NEUTRAL_HAND_L));
  });

  it("chambers the elbow during startup, then drives it forward to contact (guards 3/4)", () => {
    // A wind-up is a different SHAPE, not a shorter reach (M3): the elbow cocks back, then extends to
    // the target at contact. The chamber routes through the SAME winding path as every other move
    // (driven = winding ? chamberFor : target), now landing on the elbow instead of a hand or foot.
    const chambered = poseEmpi({ extra: { attackPhase: STARTUP } }).elbowR;
    const extended = poseEmpi({ extra: { attackPhase: CONTACT } }).elbowR;
    const resting = poseEmpi({ extra: { attacking: false } }).elbowR;

    // Guard 3 (phase distinctness): the cocked elbow is a different shape from the contact elbow.
    expect(chambered).not.toEqual(extended);
    // Guard 4 (direction): the elbow EXTENDS forward from its cock to contact, never retracts.
    expect(chambered.x).toBeLessThan(extended.x);
    // ...and the chamber is a distinct COCKED position, not the resting arm — kills "no chamber
    // authored" (which would leave the wind-up at the idle elbow, identical to `resting`).
    expect(chambered).not.toEqual(resting);
  });

  it("recovers through the same chamber, the fist riding with the cocked elbow (guard 3)", () => {
    // Startup and recovery both draw the chamber — a technique returns through its wind-up shape, the
    // mirror of how it entered. And the fist rides WITH the cocked elbow (folded behind it), not left
    // at stance during the wind-up: the tuck is relative to the elbow, so it tracks it across phases.
    const startup = poseEmpi({ extra: { attackPhase: STARTUP } });
    const recovery = poseEmpi({ extra: { attackPhase: RECOVER } });

    expect(recovery.elbowR).toEqual(startup.elbowR);
    expect(startup.handR).not.toEqual(scaled(NEUTRAL_HAND_R));
    expect(startup.handR.x).toBeLessThan(startup.elbowR.x);
  });
});

describe("scene — hiza-geri leads with the knee (S5 · Slice 2)", () => {
  // The LEG branch of the mid-joint mechanism slice 1 built for the arm. empi drives the elbow and
  // folds the fist; hiza-geri drives the KNEE up to the mid band and folds the FOOT back under the hip,
  // while the OTHER leg (footL) stays planted as the support. Same inversion, other classification arm:
  // where every kick so far drives a FOOT and lets deriveBend compute the knee, this drives the knee.
  //
  // The RED driver is the ROUTING, exactly as in slice 1. Today "hiza-geri" is undescribed, so limbFor
  // falls to the generic front hand — the FIST drives to the target and kneeR is only the derived
  // hip→footR bisector, the foot left at its stance. The inversion assertions (knee AT the target, foot
  // FOLDED behind/below it) fail for that reason until the kneeR route exists.
  //
  // Local-px anchors, recomputed independent of production (one sub-unit = 76/240000 local px) — the
  // reach solve is limb-agnostic, so these are the SAME edges the empi and strike blocks use:
  //  · CLOSE anchor — hiza-geri's REAL reach (110k) at a 120k gap: centres 38 local px apart, near edge
  //    one BODY_HALF_WIDTH (10) nearer ⇒ 28; the knee's cap is 110000·(76/240000) = 34.83, so 28 lands
  //    in range. This is the in-character close-range picture (where M13g's overlap lives — by eye in
  //    /dojo, not asserted here).
  //  · FAR anchor — a controlled 240k reach at a 240k gap ⇒ edge 66. A HAND at this reach LEANS 16
  //    (rootTravel over 2·ARM_BONE); a mid-joint must NOT (M13f: hold the root). Using the far anchor is
  //    what makes the no-lean gate load-bearing and the root-held test a real RED driver, not a vacuum.
  const NEUTRAL_HAND_R = { x: 18, y: -44 }; // STAND front hand — untouched by a LEG strike
  const NEUTRAL_HAND_L = { x: -18, y: -44 }; // STAND rear hand — likewise untouched
  const NEUTRAL_FOOT_L = { x: -14, y: 0 }; // STAND support foot — planted (the knee strike is the
  const NEUTRAL_FOOT_R = { x: 14, y: 0 }; // driving leg); STAND driving foot — its pre-strike stance

  const STARTUP = 1;
  const CONTACT = 2;
  const RECOVER = 3;

  // Striker `a` faces right at x 150000 committing hiza-geri; `b` sits `gap` sub-units in front.
  // Defaults to the CLOSE anchor (hiza-geri's real 110k reach); the far cases override reach + gap.
  const poseHiza = ({
    gap = 120_000,
    band = 2,
    reach = 110_000,
    extra = {},
  }: {
    gap?: number;
    band?: number;
    reach?: number;
    extra?: Partial<ReplayFrame>;
  } = {}) =>
    scene(
      [
        tickOf(
          0,
          {
            attacking: true,
            attackBand: band,
            attackReach: reach,
            attackMove: "hiza-geri",
            x: 150_000,
            facing: 1,
            ...extra,
          },
          { x: 150_000 + gap },
        ),
      ],
      0,
      VIEWPORT,
    ).a.pose;

  it("leads with the knee — the knee drives to the near edge, the foot folded behind and below it", () => {
    // The inversion (guard 7, anti-clobber). The DRIVEN point is kneeR, landing ON the near edge (28)
    // at the mid band — NOT the deriveBend(hip → footR) bisector the old front-hand path leaves there.
    // The foot folds BEHIND the knee tip (kneeR.x > footR.x) AND BELOW it (footR.y > kneeR.y — a larger
    // y is lower on screen): the knee-strike shape of a raised knee over a tucked foot, the reverse of a
    // front kick where the foot leads. The below-relation also pins the tuck's vertical sign (a foot
    // folded ABOVE the knee would read as a flick-up, not a knee).
    const pose = poseHiza();

    expect(pose.kneeR).toEqual(scaled({ x: 28, y: -46 }));
    expect(pose.kneeR.x).toBeGreaterThan(pose.footR.x);
    expect(pose.footR.y).toBeGreaterThan(pose.kneeR.y);
  });

  it("folds the shin at an angle — the knee reads jointed, the foot tucked behind the tip", () => {
    // Guard 6 (jointedness). The foot tucks back RELATIVE to the knee (M13c), so the shin kneeR→footR
    // bends off the thigh hip→kneeR — non-collinear, via their cross product — and the foot sits behind
    // the tip (footR.x < kneeR.x). Today the foot IS at its stance (the front-hand path never touches
    // it), so the fold-back assertion fails until the tuck exists.
    const pose = poseHiza();

    const cross =
      (pose.kneeR.x - pose.hip.x) * (pose.footR.y - pose.kneeR.y) -
      (pose.kneeR.y - pose.hip.y) * (pose.footR.x - pose.kneeR.x);

    expect(cross).not.toBe(0);
    expect(pose.footR.x).toBeLessThan(pose.kneeR.x);
    // The foot actually FOLDED — it left its stance rather than being ignored (kills a mutant that drops
    // the trailing-endpoint write, which would leave the stance foot on the ground and still satisfy the
    // two checks above, since a planted foot at y 0 sits below and behind a raised knee).
    expect(pose.footR).not.toEqual(scaled(NEUTRAL_FOOT_L)); // not the support foot's stance
    expect(pose.footR).not.toEqual(scaled(NEUTRAL_FOOT_R)); // nor its own STAND.footR — it FOLDED
  });

  it("holds the root — a mid-joint strike does not step or lean, even at a far target (M13f)", () => {
    // M13f: suppress the forward-root motion for a mid-joint. At the FAR anchor a HAND would lean 16
    // (head + shoulder advancing); a leg-mid-joint neither leans nor steps — the knee reaches the far
    // edge (66) while the head, shoulder, hip (no step) and the SUPPORT foot all hold their stance.
    const pose = poseHiza({ gap: 240_000, reach: 240_000 });

    expect(pose.kneeR).toEqual(scaled({ x: 66, y: -46 })); // it DID reach far — not a no-op
    expect(pose.head).toEqual(scaled({ x: 0, y: -76 })); // no lean
    expect(pose.shoulder).toEqual(scaled({ x: 0, y: -64 }));
    expect(pose.hip).toEqual(scaled({ x: 0, y: -34 })); // no step
    expect(pose.footL).toEqual(scaled(NEUTRAL_FOOT_L)); // support foot planted
  });

  it("tracks the real opponent distance — the knee solve is retained (guard 5)", () => {
    // The knee tracks true distance through the SAME reachTargetX a fist uses, not a fixed authored
    // extension: two gaps, two knee endpoints (28 and 66), both inside a 240k reach cap (76).
    expect(poseHiza({ gap: 120_000, reach: 240_000 }).kneeR).toEqual(
      scaled({ x: 28, y: -46 }),
    );
    expect(poseHiza({ gap: 240_000, reach: 240_000 }).kneeR).toEqual(
      scaled({ x: 66, y: -46 }),
    );
  });

  it("leaves the other limbs at their stance — support foot planted, arms home (root held)", () => {
    // A knee strike drives one leg; the arms and the support leg hold their stance. Only the driving
    // leg (kneeR + its trailing foot) moves — the support knee kneeL re-derives from an unmoved hip and
    // footL, so it is identical to the idle figure's.
    const pose = poseHiza();
    const idleKneeL = poseHiza({ extra: { attacking: false } }).kneeL;

    expect(pose.handL).toEqual(scaled(NEUTRAL_HAND_L));
    expect(pose.handR).toEqual(scaled(NEUTRAL_HAND_R));
    expect(pose.footL).toEqual(scaled(NEUTRAL_FOOT_L));
    expect(pose.kneeL).toEqual(idleKneeL);
  });

  it("chambers the knee during startup, then drives it up to contact (guards 3/4)", () => {
    // A wind-up is a different SHAPE, not a shorter reach (M3): the knee cocks low, then rises to the
    // mid band at contact. The chamber routes through the SAME winding path as every other move
    // (driven = winding ? chamberFor : target), now landing on the KNEE instead of a hand or foot.
    const chambered = poseHiza({ extra: { attackPhase: STARTUP } }).kneeR;
    const extended = poseHiza({ extra: { attackPhase: CONTACT } }).kneeR;
    const resting = poseHiza({ extra: { attacking: false } }).kneeR;

    // Guard 3 (phase distinctness): the cocked knee is a different shape from the contact knee.
    expect(chambered).not.toEqual(extended);
    // Guard 4 (direction): the knee RISES from its cock to contact (a smaller y is higher on screen),
    // never drops — the leg's signature, as the elbow EXTENDS forward for empi.
    expect(chambered.y).toBeGreaterThan(extended.y);
    // ...and the chamber is a distinct COCKED position, not the resting leg — kills "no chamber
    // authored" (which would leave the wind-up at the idle knee, identical to `resting`).
    expect(chambered).not.toEqual(resting);
  });

  it("recovers through the same chamber, the foot riding with the cocked knee (guard 3)", () => {
    // Startup and recovery both draw the chamber — a technique returns through its wind-up shape, the
    // mirror of how it entered. And the foot rides WITH the cocked knee (folded behind it), not left at
    // stance during the wind-up: the tuck is relative to the knee, so it tracks it across phases.
    const startup = poseHiza({ extra: { attackPhase: STARTUP } });
    const recovery = poseHiza({ extra: { attackPhase: RECOVER } });

    expect(recovery.kneeR).toEqual(startup.kneeR);
    expect(startup.footR).not.toEqual(scaled(NEUTRAL_FOOT_R));
    expect(startup.footR.x).toBeLessThan(startup.kneeR.x);
  });
});
