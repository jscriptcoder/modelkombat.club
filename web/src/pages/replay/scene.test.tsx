import { describe, expect, it } from "vitest";

import { scene, type Scene, type Viewport } from "./scene";
import type { ReplayFrame, ReplayTape, ReplayTick } from "./replay-contract";

// A 1200×600 viewport makes the world→screen maths land on whole pixels: the world is 600000
// sub-units wide (mirrors the engine ring), so pxPerSubunit = 1200 / 600000 = 0.002. The opening
// stances (challenger 150000, King 450000) therefore map to 300 and 900; the ground line sits at
// 90% of height = 540. Every expected number below is derived from those two facts.
const VIEWPORT: Viewport = { width: 1200, height: 600 };

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

describe("scene — stance geometry by posture", () => {
  // The pose is a skeleton of local joints (feet at the local ground line y=0, up is negative),
  // carried on `Figure.pose`. The container position/facing (S1) still places the whole figure;
  // these joints add the body articulation the draw layer strokes.
  const poseAt = (posture: number) =>
    scene([tickOf(0, { posture }, {})], 0, VIEWPORT).a.pose;

  it("stands upright at posture 0 — head at the top, feet on the local ground line", () => {
    const pose = poseAt(0);

    expect(pose.head).toEqual({ x: 0, y: -76 });
    expect(pose.shoulder).toEqual({ x: 0, y: -64 });
    expect(pose.hip).toEqual({ x: 0, y: -34 });
    expect(pose.footL).toEqual({ x: -14, y: 0 });
    expect(pose.footR).toEqual({ x: 14, y: 0 });
  });

  it("crouches lower than a stand — the upper body drops while the feet stay planted", () => {
    const stand = poseAt(0);
    const crouch = poseAt(1);

    // Every upper joint sits lower on screen (larger local y, since up is negative).
    expect(crouch.head.y).toBeGreaterThan(stand.head.y);
    expect(crouch.shoulder.y).toBeGreaterThan(stand.shoulder.y);
    expect(crouch.hip.y).toBeGreaterThan(stand.hip.y);
    // Exact drop distances (pins the geometry against off-by mutants).
    expect(crouch.head).toEqual({ x: 0, y: -58 });
    expect(crouch.hip).toEqual({ x: 0, y: -22 });
    // Feet stay on the ground line (y 0), planted a touch wider.
    expect(crouch.footL).toEqual({ x: -16, y: 0 });
    expect(crouch.footR).toEqual({ x: 16, y: 0 });
  });

  it("tucks the legs for an airborne fighter while the upper body holds", () => {
    const stand = poseAt(0);
    const air = poseAt(2);

    // Feet lift toward the hip (tucked), distinct from the planted stand feet.
    expect(air.footL.y).toBeLessThan(stand.footL.y);
    expect(air.footR.y).toBeLessThan(stand.footR.y);
    expect(air.footL).toEqual({ x: -10, y: -18 });
    expect(air.footR).toEqual({ x: 10, y: -18 });
    // The upper body is unchanged from the stand — only the legs tuck.
    expect(air.head).toEqual(stand.head);
    expect(air.hip).toEqual(stand.hip);
  });

  it("falls back to the standing stance for an unrecognized posture code", () => {
    // Our engine only emits 0/1/2, but the derivation is total: an odd code renders a safe stand.
    const odd = poseAt(9);

    expect(odd).toEqual(poseAt(0));
    expect(odd.head).toEqual({ x: 0, y: -76 }); // a real stand, not an empty/garbage pose
  });
});

describe("scene — strike extension by band", () => {
  // An attacking fighter throws its front arm (handR) forward to the strike's band height. The
  // reach is in the figure's LOCAL frame (x forward), so the container flip (S1 facing) turns it
  // into the correct on-screen direction — the strike geometry never needs to know the facing.
  // Neutral front hand: { x: 18, y: -44 } (the STAND handR). Bands sit ascending up the screen
  // (up is negative): low -24, mid -46, high -68.
  const NEUTRAL_HAND = { x: 18, y: -44 };

  const poseAttacking = (
    attackBand: number,
    extra: Partial<ReplayFrame> = {},
  ) =>
    scene(
      [tickOf(0, { attacking: true, attackBand, ...extra }, {})],
      0,
      VIEWPORT,
    ).a.pose;

  it("extends the striking hand forward to the low band height", () => {
    expect(poseAttacking(1).handR).toEqual({ x: 40, y: -24 });
  });

  it("extends the striking hand forward to the mid band height", () => {
    expect(poseAttacking(2).handR).toEqual({ x: 40, y: -46 });
  });

  it("extends the striking hand forward to the high band height", () => {
    expect(poseAttacking(3).handR).toEqual({ x: 40, y: -68 });
  });

  it("stacks the three bands as distinct heights ascending up the screen", () => {
    // Higher band ⇒ higher on screen ⇒ more negative y. A collapsed or mis-ordered map fails here.
    const low = poseAttacking(1).handR.y;
    const mid = poseAttacking(2).handR.y;
    const high = poseAttacking(3).handR.y;

    expect(low).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(high);
  });

  it("leaves the front hand neutral when not attacking, even with a stale band", () => {
    // The `attacking` flag is the gate, not the band: an idle fighter carrying a non-zero band must
    // not throw a phantom strike (kills the "drop the attacking gate" mutant).
    const pose = scene(
      [tickOf(0, { attacking: false, attackBand: 2 }, {})],
      0,
      VIEWPORT,
    ).a.pose;

    expect(pose.handR).toEqual(NEUTRAL_HAND);
  });

  it("does not extend when attacking with a zero band", () => {
    expect(poseAttacking(0).handR).toEqual(NEUTRAL_HAND);
  });

  it("does not extend for an out-of-range attack band (total fallback)", () => {
    expect(poseAttacking(9).handR).toEqual(NEUTRAL_HAND);
  });

  it("draws both the airborne stance and the strike for an air attack", () => {
    const pose = poseAttacking(2, { posture: 2 });

    // The air stance still tucks the legs...
    expect(pose.footL).toEqual({ x: -10, y: -18 });
    expect(pose.footR).toEqual({ x: 10, y: -18 });
    // ...while the strike extends the front hand on the same tick.
    expect(pose.handR).toEqual({ x: 40, y: -46 });
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
    expect(poseGuarding(1).handL).toEqual({ x: 8, y: -24 });
  });

  it("raises the guard arm to the mid band height", () => {
    expect(poseGuarding(2).handL).toEqual({ x: 8, y: -46 });
  });

  it("raises the guard arm to the high band height", () => {
    expect(poseGuarding(3).handL).toEqual({ x: 8, y: -68 });
  });

  it("stacks the three guard bands as distinct heights ascending up the screen", () => {
    const low = poseGuarding(1).handL.y;
    const mid = poseGuarding(2).handL.y;
    const high = poseGuarding(3).handL.y;

    expect(low).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(high);
  });

  it("leaves the guard arm neutral when not guarding (guardBand 0)", () => {
    expect(poseGuarding(0).handL).toEqual(NEUTRAL_GUARD_HAND);
  });

  it("leaves the guard arm neutral for an out-of-range guard band", () => {
    expect(poseGuarding(9).handL).toEqual(NEUTRAL_GUARD_HAND);
  });

  it("guards independently of stance — the guard composes with a crouch", () => {
    // Guard height is driven by guardBand, not posture: a crouching fighter can still raise a guard.
    const pose = poseGuarding(2, { posture: 1 });

    // Guard raised to mid...
    expect(pose.handL).toEqual({ x: 8, y: -46 });
    // ...while the CROUCH stance survives (feet planted a touch wider, head dropped).
    expect(pose.footL).toEqual({ x: -16, y: 0 });
    expect(pose.head).toEqual({ x: 0, y: -58 });
  });
});

describe("scene — throw grab pose", () => {
  // A throwing fighter reaches BOTH hands forward and locks them together at chest height — the cue
  // that reads a throw as a throw. Distinct from a strike (only the front hand, at a band) and from
  // neutral (hands at ±18). `throwing` gates it; it wins over strike/guard (applied last in poseFor).
  const poseThrowing = (extra: Partial<ReplayFrame> = {}) =>
    scene([tickOf(0, { throwing: true, ...extra }, {})], 0, VIEWPORT).a.pose;

  it("reaches both hands forward into a grab when throwing", () => {
    const pose = poseThrowing();

    expect(pose.handL).toEqual({ x: 28, y: -44 });
    expect(pose.handR).toEqual({ x: 36, y: -44 });
  });

  it("leaves the hands at their neutral stance when not throwing", () => {
    const pose = scene([tickOf(0, { throwing: false }, {})], 0, VIEWPORT).a
      .pose;

    expect(pose.handL).toEqual({ x: -18, y: -44 });
    expect(pose.handR).toEqual({ x: 18, y: -44 });
  });

  it("shows a grab distinct from a strike — the rear hand comes forward too", () => {
    const grab = poseThrowing();

    const strike = scene(
      [tickOf(0, { attacking: true, attackBand: 2 }, {})],
      0,
      VIEWPORT,
    ).a.pose;

    // A strike leaves the rear hand back at the stance; a grab brings BOTH hands forward.
    expect(strike.handL.x).toBeLessThan(0);
    expect(grab.handL.x).toBeGreaterThan(0);
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
  };

  const poseDowned = (extra: Partial<ReplayFrame> = {}) =>
    scene([tickOf(0, { knockdown: true, ...extra }, {})], 0, VIEWPORT).a.pose;

  it("lays the whole body prone when knocked down", () => {
    expect(poseDowned()).toEqual(PRONE);
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
    // knockdown:true with a live attack on the same tick still renders prone; the front hand is
    // NOT thrown to the strike reach (kills a "compose knockdown with the action layers" mutant).
    const pose = poseDowned({ attacking: true, attackBand: 3 });

    expect(pose).toEqual(PRONE);
    expect(pose.handR).not.toEqual({ x: 40, y: -68 }); // the high-band strike geometry
  });

  it("overrides a throw — prone wins over the grab that is otherwise applied last", () => {
    const pose = poseDowned({ throwing: true });

    expect(pose).toEqual(PRONE);
    expect(pose.handL).not.toEqual({ x: 28, y: -44 }); // the grab geometry
  });

  it("wakes up — returns to the standing stance the tick knockdown clears", () => {
    const tape: ReplayTape = [
      tickOf(0, { knockdown: true }, {}),
      tickOf(1, { knockdown: false }, {}),
    ];

    const downed = scene(tape, 0, VIEWPORT).a.pose;
    const woken = scene(tape, 1, VIEWPORT).a.pose;

    expect(downed.head).toEqual({ x: -40, y: -10 }); // prone at the knockdown tick
    expect(woken.head).toEqual({ x: 0, y: -76 }); // upright stand the next tick — wake-up
  });

  it("leaves a standing fighter unaffected when not knocked down", () => {
    // knockdown is the gate — an idle fighter is a normal stand (kills an "always prone" mutant).
    const pose = scene([tickOf(0, { knockdown: false }, {})], 0, VIEWPORT).a
      .pose;

    expect(pose.head).toEqual({ x: 0, y: -76 });
    expect(pose.footL).toEqual({ x: -14, y: 0 });
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
