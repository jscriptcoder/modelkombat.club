// The jump-physics mirror: a documented transcription of the engine's vertical + horizontal jump
// constants (src/engine/rules.ts), the same discipline reach-presets.ts applies to move reaches —
// web/src cannot import src/, so the values live here and the test pins them value-by-value.
//
// What is NOT transcribed is the arc itself. rules.ts documents the resulting heights in prose
// ("12000, 20000, 24000, 24000, 20000, 12000, 0"), but storing that list would let the mirror agree
// with the prose while disagreeing with the physics. The arc is INTEGRATED from the constants below
// using the engine's own recurrence, so a drifted constant produces a visibly wrong arc rather than a
// stale literal that still looks right.
export const JUMP_IMPULSE = 12_000;
export const GRAVITY = 4_000;
export const JUMP_X_SPEED = 10_000;

// How many ticks one jump spends off the ground plus the tick it lands on. Vertical velocity crosses
// zero after `impulse / gravity` steps and the fall mirrors the rise, so the jumper is back down
// `2 * (impulse / gravity) + 1` ticks after launch. rules.ts guarantees this divides evenly ("impulse
// is a whole number of gravity steps ⇒ replay-stable"), which is what makes the landing land on
// EXACTLY 0 rather than somewhere under the floor.
const FLIGHT_TICKS = (2 * JUMP_IMPULSE) / GRAVITY + 1;

type Flight = {
  readonly heights: readonly number[];
  readonly y: number;
  readonly vy: number;
};

// jumpArc: the height of one jump at each tick, from the grounded launch tick through touchdown.
// Index 0 is the launch (still on the ground, height 0) so a tape can index it by tick directly;
// rules.ts's prose sequence is this arc from index 1. Integrated as the engine integrates it:
// `y += vy; vy -= gravity`, once per tick.
export const jumpArc = (): readonly number[] =>
  Array.from({ length: FLIGHT_TICKS }).reduce<Flight>(
    ({ heights, y, vy }) => {
      const next = y + vy;

      return { heights: [...heights, next], y: next, vy: vy - GRAVITY };
    },
    { heights: [0], y: 0, vy: JUMP_IMPULSE },
  ).heights;

// jumpTravelAt: how far a directional jump has closed by `tick`. The leap carries the jumper forward
// only while its feet are off the ground, so the total freezes at touchdown instead of sliding on —
// and over the whole flight it closes the ~60000 rules.ts credits the jump-in with. A tick past the
// arc's end simply keeps the landed total, so callers never need to bound their own index.
export const jumpTravelAt = (tick: number): number =>
  JUMP_X_SPEED * jumpArc().filter((y, t) => y > 0 && t <= tick).length;
