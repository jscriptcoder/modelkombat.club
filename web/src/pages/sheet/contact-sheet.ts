import {
  controlsToFrame,
  DEFAULT_CHALLENGER_CONTROLS,
  DEFAULT_KING_CONTROLS,
  selectMove,
} from "../dojo/controls";
import { buildDojoTape } from "../dojo/dojo-tape";
import { REACH_PRESETS, type ReachPreset } from "../dojo/reach-presets";
import { scene, type Figure, type Viewport } from "../replay/scene";

// The contact sheet's DATA layer (S7): the whole arsenal posed side by side, one attacker figure per
// move at its ACTIVE phase, so a developer can see at a glance whether every technique reads as its
// own — the detector for the arc's expressiveness risk. Pure (no Pixi): it drives the SAME
// selectMove → buildDojoTape → scene path /watch ships, so a move looks here exactly as it fights.
// The Pixi assembly (grid + labels) is figures.ts's `createContactSheet`; this only computes poses.

// One cell's payload: the move id (its label) and the fully-posed attacker figure to draw. `x`/`y` on
// the placement are the scene's ring pixels and are IGNORED by the grid — the layout re-anchors each
// figure into its cell; only the pose + facing carry over.
export type ContactCellData = { id: string; placement: Figure };

// A technique the engine performs in the air is posed from the AIR stance here too. Rendered grounded,
// tobi-geri would duplicate mae-geri (both drive footR to the band), so the sheet would flag a
// look-alike that does not exist on /watch; posing it airborne — the AIR stance's tucked support foot
// IS the read — keeps the detector honest. WHICH moves those are is the preset table's `air` column,
// not a list kept here: posture is an engine fact, and an engine fact gets one home.
const AIR_POSTURE = 2;
const GROUND_POSTURE = 0;

export const contactSheetCells = (
  figureViewport: Viewport,
): ContactCellData[] =>
  // Read through the declared ReachPreset, not the `as const` literal union: `air` is a genuinely
  // optional key, so only the real type exposes it as absent-or-true rather than "does not exist".
  REACH_PRESETS.map((preset: ReachPreset) => {
    // Commit the challenger to this technique from the right posture, facing its idle opponent. The
    // opponent sits one true-reach away so the reach-to-target solve extends the driven limb to real
    // contact distance — the same distance the engine fights the move at.
    const attacker = selectMove(
      {
        ...DEFAULT_CHALLENGER_CONTROLS,
        posture: preset.air === true ? AIR_POSTURE : GROUND_POSTURE,
      },
      preset.move,
    );

    const tape = buildDojoTape({
      a: controlsToFrame(attacker),
      b: controlsToFrame(DEFAULT_KING_CONTROLS),
      gap: preset.reach,
    });

    // The active phase begins exactly at `startup` ticks in (phaseAt → 2), the first frame the driven
    // endpoint reaches its solved target rather than the chamber. That is the frame that shows the
    // technique, so that is the frame the sheet freezes.
    return {
      id: preset.move,
      placement: scene(tape, preset.startup, figureViewport).a,
    };
  });
