import type { ReplayFrame, ReplayTape, ReplayTick } from "./replay-contract";

// The world→screen projection: a pure function from (tape, playhead, viewport) to the on-screen
// state the Pixi layer draws. Kept free of Pixi and of any engine import (web/src never imports
// src/) so it is exhaustively unit-testable — the numeric heart of the viewer.

// A skeleton joint in the figure's LOCAL frame — feet on the ground line at y 0, up is negative
// (so a larger y sits lower on screen). The draw layer strokes bones between these and the root
// container carries the whole figure to its screen position / facing.
export type Joint = { x: number; y: number };

// The stance ENDPOINTS the draw layer's bones connect between: head + torso + two hands + two feet.
// The stance constants and the strike/guard/throw override layers are authored in these seven joints;
// a 2-bone limb's mid-joint (elbow / knee) is DERIVED from them, not authored here (Story 4).
export type Stance = {
  head: Joint;
  shoulder: Joint;
  hip: Joint;
  handL: Joint;
  handR: Joint;
  footL: Joint;
  footR: Joint;
};

// The full articulated pose the draw layer strokes: the stance endpoints plus the derived mid-joints,
// so an arm reads as shoulder→elbow→hand instead of a rigid stick (Story 4 · Slice 1 adds the elbows;
// the knees follow). PRONE authors its own mid-joints (a downed body reshapes everything).
export type Skeleton = Stance & {
  elbowL: Joint;
  elbowR: Joint;
  kneeL: Joint;
  kneeR: Joint;
};

// A fighter's on-screen placement: pixel position + facing (1 right / -1 left, passed through from
// the frame so the draw layer can flip the sprite) + the stance-derived skeleton to stroke.
export type Figure = { x: number; y: number; facing: number; pose: Skeleton };

// The upright default: head at the top, feet planted on the local ground line (mirrors the S1
// fixed stickman). Crouch and air are edits of this base.
const STAND: Stance = {
  head: { x: 0, y: -76 },
  shoulder: { x: 0, y: -64 },
  hip: { x: 0, y: -34 },
  handL: { x: -18, y: -44 },
  handR: { x: 18, y: -44 },
  footL: { x: -14, y: 0 },
  footR: { x: 14, y: 0 },
};

// Crouch: the upper body drops ~18px toward the planted, slightly wider feet — a visibly lower
// stance that vacates the high band.
const CROUCH: Stance = {
  head: { x: 0, y: -58 },
  shoulder: { x: 0, y: -46 },
  hip: { x: 0, y: -22 },
  handL: { x: -18, y: -30 },
  handR: { x: 18, y: -30 },
  footL: { x: -16, y: 0 },
  footR: { x: 16, y: 0 },
};

// Airborne: the upper body holds the stand while the legs tuck up toward the hip — read against
// the y-arc the container is already lifted along (S1).
const AIR: Stance = {
  head: { x: 0, y: -76 },
  shoulder: { x: 0, y: -64 },
  hip: { x: 0, y: -34 },
  handL: { x: -18, y: -44 },
  handR: { x: 18, y: -44 },
  footL: { x: -10, y: -18 },
  footR: { x: 10, y: -18 },
};

// posture → stance skeleton, written TOTAL: only 0/1/2 are emitted by the engine, but any other
// code falls back to STAND so an odd frame renders a safe neutral figure rather than crashing.
const stanceFor = (posture: number): Stance =>
  posture === 1 ? CROUCH : posture === 2 ? AIR : STAND;

// The screen height (local frame, up is negative) of a low / mid / high band: the shared ladder a
// strike reaches toward and — from Slice 4 — a guard rises to. `null` = not a real band (a 0 or an
// out-of-range code), so callers leave the limb at its stance rather than reaching an unmapped spot.
const bandHeight = (band: number): number | null =>
  band === 1 ? -24 : band === 2 ? -46 : band === 3 ? -68 : null;

// How far forward (local +x) a striking hand reaches — past the neutral front hand at x 18. The
// container flip (S1 facing) turns this local reach into the correct on-screen direction.
const STRIKE_REACH_X = 40;

// How far forward a raised guard sits — modest (protective) vs the strike's committed reach, and on
// the rear hand (handL), so a strike and a guard never fight over the same arm.
const GUARD_REACH_X = 8;

// A throw's grab: BOTH hands reach forward and lock together at chest height — the cue that reads a
// throw. Distinct from a strike (front hand only, at a band) and a guard (rear hand, modest reach).
const GRAB: Pick<Stance, "handL" | "handR"> = {
  handL: { x: 28, y: -44 },
  handR: { x: 36, y: -44 },
};

// A knocked-down fighter lies PRONE: the whole body laid horizontal just above the ground line —
// the spine flat at y -10 with the head at one end (x -40) and the feet at the far end (x 36), arms
// splayed by the shoulders. A complete skeleton (not a per-limb layer), because a knockdown reshapes
// the WHOLE figure; it is applied as an early-return override so it supersedes every stance + action.
const PRONE: Skeleton = {
  head: { x: -40, y: -10 },
  shoulder: { x: -24, y: -10 },
  hip: { x: 6, y: -10 },
  handL: { x: -20, y: -2 },
  handR: { x: -20, y: -18 },
  footL: { x: 36, y: -6 },
  footR: { x: 36, y: -14 },
  // A downed body reshapes everything, so PRONE AUTHORS its own mid-joints (Story 4) rather than
  // running the upright bend rule — the arms lie splayed by the shoulder, the legs straight toward the
  // feet end (each knee the midpoint of hip→foot, at the far end from the head).
  elbowL: { x: -22, y: -6 },
  elbowR: { x: -22, y: -14 },
  kneeL: { x: 21, y: -8 },
  kneeR: { x: 21, y: -12 },
};

// The local-px bow of a 2-bone limb's mid-joint off the straight line between its endpoints — enough
// that a resting joint reads jointed, not a rigid stick. Authored in LOCAL px so Story 3's scalePose
// scales it with the body; tunable by eye in /dojo. Elbow and knee tune independently.
const ELBOW_BEND = 8;
const KNEE_BEND = 8;

// The bow direction of a 2-bone limb's mid-joint, in the local +x = forward frame: an elbow bends
// BACK (toward −x), a knee bends FORWARD (toward +x). Passed to deriveBend as the sign that orients
// the perpendicular offset.
const BEND_BACK = -1;
const BEND_FORWARD = 1;

// The mid-joint of a 2-bone limb (elbow / knee): the midpoint of its two endpoints, offset along the
// bone's unit-perpendicular by `dist` local px, oriented by `dir` (BEND_BACK −x / BEND_FORWARD +x).
// poseFor never reads facing, so the bow is a fixed local direction; the container flip (applyFigure)
// carries facing, so the joint reads correctly whichever way the fighter faces. A degenerate
// (zero-length) bone divides by 1 instead of 0 — TOTAL, like the stance/band fallbacks — and offsets
// purely along the perpendicular.
const deriveBend = (
  from: Joint,
  to: Joint,
  dir: number,
  dist: number,
): Joint => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const perpX = -dy / len;
  const perpY = dx / len;
  const flip = perpX * dir < 0 ? -1 : 1; // orient the bow's x toward dir

  return {
    x: (from.x + to.x) / 2 + perpX * flip * dist,
    y: (from.y + to.y) / 2 + perpY * flip * dist,
  };
};

// Grow a stance's endpoints into the full articulated pose by deriving the mid-joints: the elbows bow
// back off the straight shoulder→hand line, the knees bow forward off the straight hip→foot line
// (Story 4) — so an arm reads shoulder→elbow→hand and a leg reads hip→knee→foot, not rigid sticks.
const deriveSkeleton = (stance: Stance): Skeleton => ({
  ...stance,
  elbowL: deriveBend(stance.shoulder, stance.handL, BEND_BACK, ELBOW_BEND),
  elbowR: deriveBend(stance.shoulder, stance.handR, BEND_BACK, ELBOW_BEND),
  kneeL: deriveBend(stance.hip, stance.footL, BEND_FORWARD, KNEE_BEND),
  kneeR: deriveBend(stance.hip, stance.footR, BEND_FORWARD, KNEE_BEND),
});

// The stance skeleton with the action layers applied: a knockdown lays the whole body PRONE and wins
// over everything (highest precedence — an early return, so a downed fighter is never also striking
// or throwing, and it keeps its OWN authored mid-joints rather than the derived bend); otherwise a
// strike throws the front hand (handR) forward to the attacked band; a guard raises the rear hand
// (handL) to the incoming band; a throw locks BOTH hands into a forward grab. All are TOTAL — an idle
// fighter, or a 0 / out-of-range band, keeps the stance hand. The layers are independent (and mutually
// exclusive in the engine), so they compose with each other and with any stance (an air-attack keeps
// the AIR tucked legs). The throw is applied LAST of the action layers, so it wins if ever combined
// with a strike/guard. Finally the mid-joints are DERIVED from the resulting endpoints, so a strike /
// guard / throw re-bends the elbow to follow the moved hand. Gates: knockdown ← `knockdown`, strike ←
// `attacking`, guard ← `guardBand` (0 = none), throw ← `throwing`.
const poseFor = (frame: ReplayFrame): Skeleton => {
  if (frame.knockdown) return PRONE;

  const stance = stanceFor(frame.posture);
  const strikeY = frame.attacking ? bandHeight(frame.attackBand) : null;
  const guardY = bandHeight(frame.guardBand);

  const endpoints: Stance = {
    ...stance,
    ...(strikeY === null ? {} : { handR: { x: STRIKE_REACH_X, y: strikeY } }),
    ...(guardY === null ? {} : { handL: { x: GUARD_REACH_X, y: guardY } }),
    ...(frame.throwing ? GRAB : {}),
  };

  return deriveSkeleton(endpoints);
};

// The heads-up display for the current playhead: the engine tick number + both fighters' scores,
// plus a per-fighter "just scored" flag the draw layer highlights (see `scoredWithin`).
export type Hud = {
  tick: number;
  scoreA: number;
  scoreB: number;
  scoredA: boolean;
  scoredB: boolean;
};

// The score-pop lookback: a fighter's score highlights if their points rose within the last N ticks
// ending at the playhead (≈0.5 s at 60 fps). Held long enough to read as "that scored!".
const SCORE_POP_TICKS = 30;

// True if the selected fighter's `points` STRICTLY rose at any tick in the window (playhead−N,
// playhead] — the low end guarded at index 1 so we never compare against a negative index. A pure
// scan of the tape at this playhead: no cross-frame state, so it is identical on replay and correct
// after a restart or a backward scrub.
const scoredWithin = (
  tape: ReplayTape,
  playhead: number,
  points: (tick: ReplayTick) => number,
): boolean => {
  const from = Math.max(1, playhead - SCORE_POP_TICKS + 1);

  const window = Array.from(
    { length: Math.max(0, playhead - from + 1) },
    (_, k) => from + k,
  );

  return window.some((i) => points(tape[i]) > points(tape[i - 1]));
};

export type Scene = { a: Figure; b: Figure; hud: Hud };

// The canvas the scene is drawn into (supplied by the Pixi layer; fixed in tests for exact maths).
export type Viewport = { width: number; height: number };

// The engine ring spans [0, WORLD_WIDTH] fixed-point sub-units (mirrors rules.ts `ring.width`,
// SCALE=1000 ⇒ 600 units). web/src can't import src/, so the bound is mirrored here exactly as the
// tape types mirror the wire contract; it only scales the drawing, never an outcome. Exported so the
// dojo pose lab centers its synthetic pair on the same ring the projection assumes.
export const WORLD_WIDTH = 600_000;

// The ground line sits at 90% of the viewport height: a grounded fighter (worldY 0) stands on it,
// a jump (worldY > 0) lifts up the screen. The world is isotropic — one sub-unit is the same length
// on both axes — so x and y share a single px-per-subunit scale and proportions hold.
const GROUND_RATIO = 0.9;

// The fighter's body height in world sub-units — the single tunable knob every body dimension
// derives from (decision 3 / M2). Projected by the SAME pxPerSubunit that positions the fighter, so
// the body grows with the ring instead of staying a fixed ~76px across a void of empty world. ~240k
// ≈ a reference mid-punch reach; a starting guess, refined by eye in /dojo (M2 / M12 vertical-fit).
// Exported so the head glyph (Slice 2) can size itself as a proportion of the same height.
export const BODY_HEIGHT_SUB = 240_000;

// The reference skeleton's head-to-foot span in local px (feet planted at y 0, head at STAND.head.y)
// — the unit the pose constants (STAND/CROUCH/AIR/PRONE + the reach layers) are authored in. Derived
// from STAND so it can never drift from the model it measures.
const REF_BODY_HEIGHT_PX = STAND.footL.y - STAND.head.y;

// The uniform body scale: how many screen px one reference-px becomes, chosen so a
// REF_BODY_HEIGHT_PX-tall reference body renders at exactly BODY_HEIGHT_SUB · pxPerSubunit. ONE
// factor scales every joint, so all proportions hold and every stance/action grows together (no
// half-scaled figure) — the whole projection stays a pure function of (frame, viewport).
const bodyScale = (viewport: Viewport): number =>
  (BODY_HEIGHT_SUB * (viewport.width / WORLD_WIDTH)) / REF_BODY_HEIGHT_PX;

// The fighter's body height in screen px at this viewport: BODY_HEIGHT_SUB projected by the SAME
// pxPerSubunit that scales the pose (a STAND body renders this tall, pre-rounding). Exported so the
// head glyph (figures.ts) can size itself as a fixed proportion of the body height at any viewport,
// growing together with the body from the one knob.
export const bodyHeightPx = (viewport: Viewport): number =>
  BODY_HEIGHT_SUB * (viewport.width / WORLD_WIDTH);

// Scale a whole pose uniformly to screen px, rounding to whole pixels (crisp, and consistent with
// the integer world→screen positions). Feet at y 0 stay at 0, so a bigger body grows UP from a
// planted base rather than sinking through the ground line.
const scalePose = (pose: Skeleton, scale: number): Skeleton => {
  const scaleJoint = (joint: Joint): Joint => ({
    x: Math.round(joint.x * scale),
    y: Math.round(joint.y * scale),
  });

  return {
    head: scaleJoint(pose.head),
    shoulder: scaleJoint(pose.shoulder),
    hip: scaleJoint(pose.hip),
    handL: scaleJoint(pose.handL),
    handR: scaleJoint(pose.handR),
    footL: scaleJoint(pose.footL),
    footR: scaleJoint(pose.footR),
    elbowL: scaleJoint(pose.elbowL),
    elbowR: scaleJoint(pose.elbowR),
    kneeL: scaleJoint(pose.kneeL),
    kneeR: scaleJoint(pose.kneeR),
  };
};

// Keep the playhead inside the tape: a value past the last tick shows the final frame, a negative
// one shows the first. The player never renders a frame off the ends of a real fight.
const clampPlayhead = (playhead: number, length: number): number =>
  Math.max(0, Math.min(playhead, length - 1));

export const scene = (
  tape: ReplayTape,
  playhead: number,
  viewport: Viewport,
): Scene => {
  const pxPerSubunit = viewport.width / WORLD_WIDTH;
  const groundY = viewport.height * GROUND_RATIO;
  const scale = bodyScale(viewport);

  const figure = (frame: ReplayFrame): Figure => ({
    x: frame.x * pxPerSubunit,
    y: groundY - frame.y * pxPerSubunit,
    facing: frame.facing,
    pose: scalePose(poseFor(frame), scale),
  });

  const p = clampPlayhead(playhead, tape.length);
  const at = tape[p];

  return {
    a: figure(at.a),
    b: figure(at.b),
    hud: {
      tick: at.tick,
      scoreA: at.a.points,
      scoreB: at.b.points,
      scoredA: scoredWithin(tape, p, (t) => t.a.points),
      scoredB: scoredWithin(tape, p, (t) => t.b.points),
    },
  };
};
