import { WORLD_WIDTH } from "../replay/scene";
import {
  controlsToFrame,
  DEFAULT_CHALLENGER_CONTROLS,
  DEFAULT_KING_CONTROLS,
} from "./controls";
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

// Center the challenger (a) and king (b) `gap` apart about the ring midpoint: a to the left, b to the
// right, every other pose field passed through untouched. One static tick numbered 0 — a still pose.
export const buildDojoTape = ({ a, b, gap }: DojoTapeInput): ReplayTape => [
  {
    tick: 0,
    a: { ...a, x: WORLD_MID - gap / 2 },
    b: { ...b, x: WORLD_MID + gap / 2 },
  },
];

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
