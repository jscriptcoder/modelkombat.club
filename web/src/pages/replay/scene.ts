import type { ReplayFrame, ReplayTape, ReplayTick } from "./replay-contract";
import { chamberFor, limbFor } from "./move-descriptors";

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

// How far forward a raised guard sits — modest (protective) vs the strike's committed reach, and on
// the rear hand (handL), so a strike and a guard never fight over the same arm.
const GUARD_REACH_X = 8;

// A throw's grab reaches BOTH hands to the opponent's near edge at chest height (M8) — the cue that
// reads a throw. Chest height (no band, unlike a strike) and the spread between the two grab hands: the
// front hand (handR) leads onto the near edge, the rear hand (handL) closes a hand's-width behind it,
// so two arms read as a two-handed grab rather than one hand drawn twice. The forward x is solved
// per-frame by throwGrabFor (reach-to-target), not authored here.
const GRAB_Y = -44;
const GRAB_SPREAD = 8;

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

// The FIXED length of one bone in a 2-bone limb. Derived from STAND and the bow above, so that at
// the stance span the solve below reproduces exactly the old fixed perpendicular offset: the neutral
// figure draws pixel-identically to before this change, and only a limb that MOVES is affected.
// Both bones of a limb are equal (upper === lower), which is what makes the solve a bisector.
const boneOf = (from: Joint, to: Joint, bend: number): number =>
  Math.hypot(Math.hypot(to.x - from.x, to.y - from.y) / 2, bend);

const ARM_BONE = boneOf(STAND.shoulder, STAND.handR, ELBOW_BEND);
const LEG_BONE = boneOf(STAND.hip, STAND.footR, KNEE_BEND);

// The mid-joint of a 2-bone limb (elbow / knee), solved so the two bones keep their FIXED length
// (`bone`) whatever the endpoints do — 2-bone IK, not a bulge. With equal bones the joint lies on
// the perpendicular bisector of the endpoints, offset by the far leg of a right triangle whose
// hypotenuse is the bone and whose base is half the endpoint span. `dir` picks which of the two
// mirror solutions to take (BEND_BACK −x / BEND_FORWARD +x); taking the wrong one inverts the joint.
//
// Before this, the offset was a CONSTANT 8px, so the bones it implied were √((span/2)² + 8²) — they
// stretched with the reach, and a mae-geri's leg ran 10.2 → 34.5 local px inside one technique.
//
// poseFor never reads facing, so the bow is a fixed local direction; the container flip (applyFigure)
// carries facing, so the joint reads correctly whichever way the fighter faces. TOTAL at both
// degenerate ends: a zero-length span divides by 1 instead of 0, and a span BEYOND the limb's
// straight reach (2 × bone) floors the offset at 0 so the limb simply straightens rather than
// producing a NaN — reaching such a target is the root's job (see `rootTravel`), not the joint's.
const deriveBend = (
  from: Joint,
  to: Joint,
  dir: number,
  bone: number,
): Joint => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const half = len / 2;
  const offset = Math.sqrt(Math.max(0, bone * bone - half * half));
  const perpX = -dy / len;
  const perpY = dx / len;
  const flip = perpX * dir < 0 ? -1 : 1; // orient the bow's x toward dir

  return {
    x: (from.x + to.x) / 2 + perpX * flip * offset,
    y: (from.y + to.y) / 2 + perpY * flip * offset,
  };
};

// Grow a stance's endpoints into the full articulated pose by deriving the mid-joints: the elbows bow
// back off the straight shoulder→hand line, the knees bow forward off the straight hip→foot line
// (Story 4) — so an arm reads shoulder→elbow→hand and a leg reads hip→knee→foot, not rigid sticks.
const deriveSkeleton = (stance: Stance): Skeleton => ({
  ...stance,
  elbowL: deriveBend(stance.shoulder, stance.handL, BEND_BACK, ARM_BONE),
  elbowR: deriveBend(stance.shoulder, stance.handR, BEND_BACK, ARM_BONE),
  kneeL: deriveBend(stance.hip, stance.footL, BEND_FORWARD, LEG_BONE),
  kneeR: deriveBend(stance.hip, stance.footR, BEND_FORWARD, LEG_BONE),
});

// ─── M2 lean: a committed strike leans the upper body forward INTO the reach ──────────────────────
// The arm alone can't span the engine's reach at this body scale, so a drawn strike shifts the upper
// body (head + shoulder) FORWARD toward the target — a lunge — and the arm telescopes for the
// remainder, reading as a committed step-in rather than one over-stretched limb. Viewer-only cosmetic:
// the fighter's root x (its truthful tape position) is untouched; only the local pose leans. The shift
// is a fraction of the hand's forward reach, CAPPED so a long technique lunges but never topples, in
// local +x (the container flip carries facing). Both constants are tuned by eye in /dojo.
const STRIKE_LEAN_RATIO = 0.5;
const STRIKE_LEAN_CAP = 16;

// The upper-body forward shift for a strike whose hand reaches `handX` local px: a fraction of that
// reach, bounded by the cap. Only a positive handX ever reaches here (a drawn strike always floors
// forward), so no lower bound is needed.
const strikeLean = (handX: number): number =>
  Math.min(STRIKE_LEAN_CAP, handX * STRIKE_LEAN_RATIO);

// ─── S2 · Slice 3: the driving root steps into a technique it cannot otherwise reach ──────────────
// The engine's reaches are longer than a human-proportioned figure can span: at the workhorse
// distance (gyaku-zuki's 240k, also the dojo's default gap) a fighter stands about ONE BODY-HEIGHT
// from its opponent, while a leg spans ~0.48 of that and an arm ~0.35. Nothing with human proportions
// reaches its own height, and the drawing cannot fix a ratio the engine fixes — scaling the body up
// scales the gap with it, and the figure already fills 80% of the viewport.
//
// So something must give, and this is where: the root closes PART of the shortfall — a step into the
// technique — and the limb stretches for the rest. Both bounded. Closing it entirely would lunge the
// figure 27-56 local px on a 76 px body every time it commits, which reads as lurching rather than
// stepping; leaving it entirely to the limb is the rubber band this slice exists to kill.
const ROOT_TRAVEL_CAP = 16;

// How far the driving root shifts toward `target`: the shortfall between the target's distance and
// the limb's straight-line reach (both bones end to end), capped. Zero when the target is already
// reachable, so a close-range technique never steps.
const rootTravel = (root: Joint, target: Joint, bone: number): number =>
  Math.min(
    ROOT_TRAVEL_CAP,
    Math.max(0, Math.hypot(target.x - root.x, target.y - root.y) - 2 * bone),
  );

// ─── S2 phase: a technique winds up, commits, and recovers ────────────────────────────────────────
// `attackPhase` (M1 encoding: 0 nothing committed / 1 startup / 2 active / 3 recovery) selects WHICH
// shape a committed move draws. Startup and recovery draw the technique's chamber; only the active
// phase drives to the solved target. Before this, `attacking` was emitted true for the whole
// committed duration, so a gyaku-zuki held full extension for 24 ticks (~0.4 s).
//
// TOTAL by construction: an absent field (the loader casts the wire wholesale), a non-numeric value,
// and any out-of-range code all answer `false` and therefore draw the EXTENSION — exactly what every
// tape drew before phases existed, so no frame can regress into a blank or frozen figure (M7).
const isChamberPhase = (phase: number | undefined): boolean =>
  phase === 1 || phase === 3;

// The stance skeleton with the action layers applied: a knockdown lays the whole body PRONE and wins
// over everything (highest precedence — an early return, so a downed fighter is never also striking
// or throwing, and it keeps its OWN authored mid-joints rather than the derived bend); otherwise the
// striking hand (`strikeHand` — already solved toward the opponent by strikeHandFor, or `null` for no
// strike to draw) takes the front hand (handR) AND leans the upper body (head + shoulder) forward into
// the reach (M2 lean, strike-only); a guard raises the rear hand (handL) to the incoming
// band; a throw reaches BOTH hands into a grab on the opponent's near edge (`grab` — already solved by
// throwGrabFor, or `null` for no throw to draw). All are TOTAL — an idle fighter, a 0 / out-of-range
// band, or a defensively-zeroed reach keeps the stance hand. The layers are independent (and mutually
// exclusive in the engine), so they compose with each other and with any stance (an air-attack keeps
// the AIR tucked legs). The throw is applied LAST of the action layers, so it wins if ever combined
// with a strike/guard. Finally the mid-joints are DERIVED from the resulting endpoints, so a strike /
// guard / throw re-bends the elbow to follow the moved hand. Gates: knockdown ← `knockdown`, strike ←
// `strikeHand` (non-null), guard ← `guardBand` (0 = none), throw ← `grab` (non-null).
const poseFor = (
  frame: ReplayFrame,
  strikeHand: Joint | null,
  grab: Pick<Stance, "handL" | "handR"> | null,
): Skeleton => {
  if (frame.knockdown) return PRONE;

  const stance = stanceFor(frame.posture);
  const guardY = bandHeight(frame.guardBand);
  // Which endpoint this technique drives (S1): a punch reaches with the front hand, a kick with the
  // front foot. The solved position is identical either way — only its destination differs.
  const limb = limbFor(frame.attackMove);
  const winding = isChamberPhase(frame.attackPhase);

  // WHERE that endpoint sits this phase (S2). `strikeHand` remains the gate: no strike to draw (idle,
  // unmapped band, rejected reach) ⇒ no layer at all, so a stale move id can never make an idle
  // fighter chamber. Given a strike, the phase picks the point — the chamber while winding up and
  // recovering, the solved target at contact. A move with no authored chamber winds up through its
  // STANCE instead (`chamberFor` ⇒ null ⇒ no layer), which is why every move gains a wind-up here,
  // not just the authored ones.
  const driven =
    strikeHand === null || !winding ? strikeHand : chamberFor(frame.attackMove);

  // A drawn HAND strike leans the upper body forward into the reach (M2) — gated to the ACTIVE phase
  // (M9), because leaning fully forward during the chamber is backwards: a fighter leans INTO a
  // technique as it extends, not while winding up.
  //
  // Gated to hand techniques as well (S2 · Slice 3). The lean was authored for punches and inherited
  // by kicks, where it reads wrong: pitching the torso forward over a rising leg makes the figure
  // look like it is FALLING INTO the kick. A real front kick counterbalances. The kick's reach
  // problem is answered by the hip step below instead, which is the lower body's own mechanism.
  const lean =
    driven === null || winding || limb === "footR" ? 0 : strikeLean(driven.x);

  // A kick whose target is beyond the leg's reach steps the HIP forward (the leg's root) — the
  // lower-body counterpart of the lean, which already does this for the arm by shifting the shoulder.
  // Horizontal only: the fighter steps in, it does not rise. Zero for a punch (the lean covers it),
  // for a chamber (always within reach), and for any non-strike layer.
  const step =
    driven === null || limb !== "footR"
      ? 0
      : rootTravel(stance.hip, driven, LEG_BONE);

  const endpoints: Stance = {
    ...stance,
    ...(driven === null
      ? {}
      : {
          head: { x: stance.head.x + lean, y: stance.head.y },
          shoulder: { x: stance.shoulder.x + lean, y: stance.shoulder.y },
          hip: { x: stance.hip.x + step, y: stance.hip.y },
          ...(limb === "footR" ? { footR: driven } : { handR: driven }),
        }),
    ...(guardY === null ? {} : { handL: { x: GUARD_REACH_X, y: guardY } }),
    ...(grab === null ? {} : grab),
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

// ─── strike reach-to-target (Story 5) ────────────────────────────────────────────────────────────
// One world sub-unit as a length in the pose's LOCAL-px frame. Because the body is projected by the
// SAME pxPerSubunit that positions it (decision 3), this ratio is viewport-INDEPENDENT — the reference
// body height in px over the world height it fills. The whole reach solve works in local px through
// this ratio, so it composes with scalePose exactly like every other authored pose coordinate.
const SUBUNIT_TO_LOCAL = REF_BODY_HEIGHT_PX / BODY_HEIGHT_SUB;

// The opponent's body half-width in local px: how far their near surface sits in front of their
// centre. `attackReach` is the engine's centre-to-centre contact distance, so the drawn fist aims one
// half-width short of the centre to land ON the surface, not inside the torso (M1). Tuned by eye in
// /dojo.
const BODY_HALF_WIDTH = 10;

// The point-blank floor (local px): the minimal forward extension a committed strike shows when the
// opponent is overlapping or behind the facing (M3) — a jab into space rather than a retracted or
// backward arm. Bounded by the move's own reach cap, so a very short technique never out-reaches it.
const STRIKE_FLOOR_X = 24;

// The reach-to-target solve, shared by every committed action (strike front hand + throw grab hands,
// M8): how far FORWARD (local px) the reaching hand lands — aimed at the opponent's near body edge,
// clamped to the move's true reach — or `null` when the committed reach is defensively rejected. Only
// the forward x is solved here; the caller supplies the y (a strike's band, a throw's chest height).
// Pure in the two frames' fields + the constants above — no viewport, no cross-frame state — so it is
// identical on replay and any scrub (M-purity).
const reachTargetX = (
  self: ReplayFrame,
  opponent: ReplayFrame,
): number | null => {
  // The committed reach, read defensively (M7): the tape always carries `attackReach`, but the loader
  // casts the JSON wholesale, so an absent / non-numeric / non-positive value means "no reach" ⇒ the
  // reaching hand keeps its stance pose (the idle fallback). `!(reach > 0)` rejects NaN as well as ≤0.
  const reach = self.attackReach;

  if (typeof reach !== "number" || !(reach > 0)) return null;

  // In-front (facing-relative) distance to the opponent's near edge, in local px. The reach
  // direction is ALWAYS the facing, so a negative in-front distance (opponent behind / overlapping)
  // just floors forward — the hand never swings backward, and the arithmetic never divides to a NaN.
  const centerGap = self.facing * (opponent.x - self.x) * SUBUNIT_TO_LOCAL;

  const edgeGap = centerGap - BODY_HALF_WIDTH;
  const cap = reach * SUBUNIT_TO_LOCAL;
  // Clamp forward into [floor, cap]: never past the move's reach, never below the point-blank floor,
  // and the floor itself never exceeds the cap (a short move can't out-reach its own range).
  const floor = Math.min(STRIKE_FLOOR_X, cap);

  return Math.max(floor, Math.min(edgeGap, cap));
};

// Where the striking front hand (handR) lands: the reach-to-target x at the band height — or `null`
// when there is no strike to draw (not attacking, an unmapped band, or a defensively-rejected reach ⇒
// the stance hand stays). The y is the band height; only the x reaches (via reachTargetX).
const strikeHandFor = (
  striker: ReplayFrame,
  opponent: ReplayFrame,
): Joint | null => {
  if (!striker.attacking) return null;

  const y = bandHeight(striker.attackBand);

  if (y === null) return null;

  const x = reachTargetX(striker, opponent);

  if (x === null) return null;

  return { x, y };
};

// Where a throw's TWO grab hands land (M8): both reach the reach-to-target x at chest height, so the
// grab lands on the opponent instead of grabbing air — the same solve as a strike, applied to both
// hands. The front hand (handR) leads onto the near edge; the rear hand (handL) closes a GRAB_SPREAD
// behind it, so two arms read as a two-handed grab. `null` when there is no throw to draw (not
// throwing, or a defensively-rejected reach ⇒ the stance hands stay, the M7 idle fallback).
const throwGrabFor = (
  thrower: ReplayFrame,
  opponent: ReplayFrame,
): Pick<Stance, "handL" | "handR"> | null => {
  if (!thrower.throwing) return null;

  const x = reachTargetX(thrower, opponent);

  if (x === null) return null;

  return {
    handR: { x, y: GRAB_Y },
    handL: { x: x - GRAB_SPREAD, y: GRAB_Y },
  };
};

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

  // Each fighter's pose needs the OTHER's frame: the reach-to-target solves aim the striking hand and
  // the throw grab at the opponent's near edge (strikeHandFor / throwGrabFor). Everything else is a
  // pure function of the one frame; the opponent only feeds the reach-to-target layers.
  const figure = (frame: ReplayFrame, opponent: ReplayFrame): Figure => ({
    x: frame.x * pxPerSubunit,
    y: groundY - frame.y * pxPerSubunit,
    facing: frame.facing,
    pose: scalePose(
      poseFor(
        frame,
        strikeHandFor(frame, opponent),
        throwGrabFor(frame, opponent),
      ),
      scale,
    ),
  });

  const p = clampPlayhead(playhead, tape.length);
  const at = tape[p];

  return {
    a: figure(at.a, at.b),
    b: figure(at.b, at.a),
    hud: {
      tick: at.tick,
      scoreA: at.a.points,
      scoreB: at.b.points,
      scoredA: scoredWithin(tape, p, (t) => t.a.points),
      scoredB: scoredWithin(tape, p, (t) => t.b.points),
    },
  };
};
