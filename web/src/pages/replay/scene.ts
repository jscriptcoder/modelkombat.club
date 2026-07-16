import type { ReplayFrame, ReplayTape } from "./replay-contract";

// The world→screen projection: a pure function from (tape, playhead, viewport) to the on-screen
// state the Pixi layer draws. Kept free of Pixi and of any engine import (web/src never imports
// src/) so it is exhaustively unit-testable — the numeric heart of the viewer.

// A fighter's on-screen placement: pixel position + facing (1 right / -1 left, passed through from
// the frame so the draw layer can flip the sprite).
export type Figure = { x: number; y: number; facing: number };

// The heads-up display for the current playhead: the engine tick number + both fighters' scores.
export type Hud = { tick: number; scoreA: number; scoreB: number };

export type Scene = { a: Figure; b: Figure; hud: Hud };

// The canvas the scene is drawn into (supplied by the Pixi layer; fixed in tests for exact maths).
export type Viewport = { width: number; height: number };

// The engine ring spans [0, WORLD_WIDTH] fixed-point sub-units (mirrors rules.ts `ring.width`,
// SCALE=1000 ⇒ 600 units). web/src can't import src/, so the bound is mirrored here exactly as the
// tape types mirror the wire contract; it only scales the drawing, never an outcome.
const WORLD_WIDTH = 600_000;

// The ground line sits at 90% of the viewport height: a grounded fighter (worldY 0) stands on it,
// a jump (worldY > 0) lifts up the screen. The world is isotropic — one sub-unit is the same length
// on both axes — so x and y share a single px-per-subunit scale and proportions hold.
const GROUND_RATIO = 0.9;

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

  const figure = (frame: ReplayFrame): Figure => ({
    x: frame.x * pxPerSubunit,
    y: groundY - frame.y * pxPerSubunit,
    facing: frame.facing,
  });

  const at = tape[clampPlayhead(playhead, tape.length)];

  return {
    a: figure(at.a),
    b: figure(at.b),
    hud: { tick: at.tick, scoreA: at.a.points, scoreB: at.b.points },
  };
};
