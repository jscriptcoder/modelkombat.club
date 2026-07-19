import { presetFor } from "./reach-presets";
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
  // Which technique the committed strike is (S1): selects the per-move pose descriptor, so a
  // `mae-geri` draws with the foot while an undescribed move keeps the generic hand. "" = nothing
  // committed. A per-figure move PICKER lands in S3; until then the default scene names it.
  attackMove: string;
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

// What committing a figure to a technique means for its controls (S3): the move id, plus the fields
// the mirror table can fill in for it. STAMP-then-let-go (decision 6) — this computes a starting
// point, it does not lock anything: every field it writes stays independently editable afterward,
// which is how the lab reaches the engine-impossible combos it exists to show (M10).
//
// An id the mirror doesn't know — including the "" idle row — stands the figure down rather than
// half-committing it to a technique with no reach and no duration.
export const selectMove = (
  controls: FigureControls,
  move: string,
): FigureControls => {
  const preset = presetFor(move);

  return {
    ...controls,
    attackMove: move,
    attackReach: preset?.reach ?? 0,
    attacking: preset !== undefined,
  };
};

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
  attackReach: 270_000, // mae-geri reach
  attackMove: "mae-geri", // the first technique with a pose of its own (S1) — opens the lab on it
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
  attackMove: "", // idle — nothing committed
};
