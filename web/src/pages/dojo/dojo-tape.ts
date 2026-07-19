import { WORLD_WIDTH } from "../replay/scene";
import {
  controlsToFrame,
  DEFAULT_CHALLENGER_CONTROLS,
  DEFAULT_KING_CONTROLS,
} from "./controls";
import { durationOf, phaseAt, presetFor } from "./reach-presets";
import type { ReplayFrame, ReplayTape } from "../replay/replay-contract";

// The dojo's synthetic-tape builder: it takes two hand-posed fighters and a world gap and produces a
// single-tick ReplayTape centered on the ring, so the pose lab drives the SAME scene()/createStage
// pipeline that /watch ships — "what you tune is what ships". Pure: no Pixi, no engine import (the
// pose lab tunes the render model, never an outcome).

// The ring midpoint the pair is centered on. The builder OWNS position (derived from the gap), so a
// control-supplied frame x is replaced — the two roots sit `gap` sub-units apart, symmetric about it.
const WORLD_MID = WORLD_WIDTH / 2;

type DojoTapeInput = {
  a: ReplayFrame;
  b: ReplayFrame;
  gap: number;
};

// The technique a figure is playing, or undefined when it has none to play — an idle figure, or one
// committed to a move with no entry in the timing mirror. Such a figure has no phases and no
// duration: it is passed through exactly as posed, keeping the pre-S2 static look (M7).
const techniqueOf = (f: ReplayFrame) =>
  f.attacking ? presetFor(f.attackMove ?? "") : undefined;

// How many ticks a figure needs to play out — 0 when it has no technique, so it never sets the span.
const spanOf = (f: ReplayFrame): number => {
  const preset = techniqueOf(f);

  return preset === undefined ? 0 : durationOf(preset);
};

// One figure at one tick of its technique: the phase stamped so `poseFor` can draw the wind-up,
// contact and recovery. Placement is the builder's (x from the gap); every other pose field is the
// caller's.
const figureAt = (f: ReplayFrame, tick: number, x: number): ReplayFrame => {
  const preset = techniqueOf(f);

  if (preset === undefined) return { ...f, x };

  // Past its own end — the other figure's technique is still running, but this one is spent. The
  // engine would have it idle again, so the tape says so rather than holding the last recovery frame.
  if (tick >= durationOf(preset))
    return { ...f, x, attacking: false, attackPhase: 0 };

  return { ...f, x, attackPhase: phaseAt(preset, tick) };
};

// Center the challenger (a) and king (b) `gap` apart about the ring midpoint: a to the left, b to the
// right, every other pose field passed through untouched. The tape spans the LONGER of the two
// figures' committed techniques so both play out in full; with neither committed it collapses to the
// single static tick a still pose needs.
export const buildDojoTape = ({ a, b, gap }: DojoTapeInput): ReplayTape => {
  const span = Math.max(1, spanOf(a), spanOf(b));

  return Array.from({ length: span }, (_, tick) => ({
    tick,
    a: figureAt(a, tick, WORLD_MID - gap / 2),
    b: figureAt(b, tick, WORLD_MID + gap / 2),
  }));
};

// The default first-load spacing (gyaku-zuki reach) lives with the preset table in reach-presets.ts —
// the opening gap IS one of the snap presets, so there is one source of truth (see DEFAULT_GAP there).

// The default fighter frames are DERIVED from the pose-lab's default control states (controls.ts) —
// one source of truth for the opening scene, so Slice 1's first-load pose can't drift from the control
// defaults Slice 2 seeds the panels with. The challenger throws a standing mid-band strike facing the
// king; the king is idle facing back. `x` is set by the builder from the gap; `y` 0 grounds them.
export const DEFAULT_CHALLENGER: ReplayFrame = controlsToFrame(
  DEFAULT_CHALLENGER_CONTROLS,
);

export const DEFAULT_KING: ReplayFrame = controlsToFrame(DEFAULT_KING_CONTROLS);
