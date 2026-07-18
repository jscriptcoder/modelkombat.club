import type { ReplayFrame } from "../replay/replay-contract";

// The pose lab's control state: the RAW frame pose fields a developer tunes in `/dojo`. Deliberately
// the raw fields (not a single mutually-exclusive action enum), so engine-impossible combinations
// (e.g. knockdown + throwing) are reachable by design (M10); `poseFor` resolves the precedence when
// the frame renders. The lab never tunes position/score/stamina, so they are not controls.
export type FigureControls = {
  posture: number;
  facing: number;
  attacking: boolean;
  attackBand: number;
  guardBand: number;
  throwing: boolean;
  knockdown: boolean;
  // The committed action's reach in world sub-units (Story 5): how far the strike reaches toward the
  // opponent. 0 for an idle fighter. The default challenger carries a gyaku-zuki reach so the opening
  // strike lands at the default gap; a future control lets it be tuned per figure (M10).
  attackReach: number;
};

// controlsToFrame: the pure mapper from control state to a render `ReplayFrame`. Passes every pose
// field through untouched (no clamping — free combos), and fills the fields the render pipeline needs
// but the lab doesn't tune: `x` is owned by the builder's ring-centering, `y` 0 plants the fighter on
// the ground line, `points`/`stamina` are render-neutral defaults (they don't affect the pose).
export const controlsToFrame = (controls: FigureControls): ReplayFrame => ({
  ...controls,
  x: 0,
  y: 0,
  points: 0,
  stamina: 100,
});

// The opening scene the lab seeds on first load: the challenger throwing a standing mid-band strike,
// facing right toward an idle king that faces left. Mapped through `controlsToFrame`, these are the
// Slice 1 default fighter frames — the pose model's out-of-the-box "make it fight" snapshot.
export const DEFAULT_CHALLENGER_CONTROLS: FigureControls = {
  posture: 0,
  facing: 1,
  attacking: true,
  attackBand: 2,
  guardBand: 0,
  throwing: false,
  knockdown: false,
  attackReach: 240_000, // gyaku-zuki reach — lands on the king at the default (gyaku) gap
};

export const DEFAULT_KING_CONTROLS: FigureControls = {
  posture: 0,
  facing: -1,
  attacking: false,
  attackBand: 0,
  guardBand: 0,
  throwing: false,
  knockdown: false,
  attackReach: 0, // idle — no committed reach
};
