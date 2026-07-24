import {
  controlsToFrame,
  selectMove,
  type FigureControls,
} from "../dojo/controls";
import { buildDojoTape, DEFAULT_KING } from "../dojo/dojo-tape";
import { DEFAULT_GAP, presetFor } from "../dojo/reach-presets";
import type { ReplayTape } from "../replay/replay-contract";

// The Arsenal preview's pure render-model core (S1). It turns ONE move id into a looping ReplayTape —
// an attacker driving a passive target — that the hover popover plays through the SAME
// scene()/createStage pipeline /watch ships, so "what you tune is what ships" holds here too. No Pixi,
// no DOM: the whole chain (dojo-tape → scene/controls/reach-presets) is render-model only, which keeps
// the home bundle Pixi-free until the popover lazily loads the renderer (S2).

// The attacker's neutral starting pose: standing, facing right toward the target, nothing committed.
// `selectMove` stamps the move's reach / band / attacking onto it; posture, facing, guard and
// knockdown ride through untouched. Deliberately its OWN constant rather than the pose lab's
// DEFAULT_CHALLENGER_CONTROLS (which is mae-geri-specific) — re-tuning the dojo's opening scene must
// not quietly re-pose the Arsenal preview.
const ATTACKER_BASE: FigureControls = {
  posture: 0,
  facing: 1,
  attacking: false,
  attackBand: 0,
  guardBand: 0,
  knockdown: false,
  attackReach: 0,
  attackMove: "",
};

// The knockdown a technique lands on its TARGET. Three moves put the foe on the floor at contact
// (which three is the preset table's `knockdown` column, mirroring the engine), and for two of them
// it is the whole payload — `sweep` and `hiza-geri` both score 0, so a preview that leaves the target
// standing shows nothing of what the move actually does. From the contact tick onward the target's
// frame carries `knockdown`, which `poseFor` already renders as its full-body PRONE pose: no new
// render mechanism, just the tape telling the truth about the outcome.
//
// The foe stays down for the rest of the loop, and that needs no wake-up modelling rather than
// skipping it — the engine's knockdownDuration is 18 and all three tapes end within that budget
// (pinned in the test, not assumed here). Cross-fighter by construction: only `b` is rewritten, so a
// fighter never downs itself. Total — a move with no preset, or one that leaves the foe standing,
// returns the tape untouched (M7).
const withTargetKnockdown = (tape: ReplayTape, move: string): ReplayTape => {
  const preset = presetFor(move);

  if (preset?.knockdown !== true) return tape;

  return tape.map((frame) =>
    frame.tick < preset.startup
      ? frame
      : { ...frame, b: { ...frame.b, knockdown: true } },
  );
};

// moveLoopTape: ONE move id → a looping ReplayTape. The attacker (a) is committed to the move via the
// same `selectMove` the pose lab uses; the target (b) is the dojo's idle DEFAULT_KING, a passive
// partner facing back. The pair is centered the move's OWN reach apart, so the strike lands at
// contact. buildDojoTape spans the attacker's full technique and stamps its phase per tick, so the
// tape runs stance → chamber → extension → chamber → stance and loops with no seam. An unknown move
// has no preset: `selectMove` stands the attacker down (M7 totality) and the gap falls back to
// DEFAULT_GAP, so the tape is a single idle tick rather than a throw.
export const moveLoopTape = (move: string): ReplayTape => {
  const attacker = controlsToFrame(selectMove(ATTACKER_BASE, move));
  const gap = presetFor(move)?.reach ?? DEFAULT_GAP;

  return withTargetKnockdown(
    buildDojoTape({ a: attacker, b: DEFAULT_KING, gap }),
    move,
  );
};

// loopIndex: the seamless wrap from the preview clock's fractional playhead to a tape index in
// [0, length). Floor (not round) so a playhead in [length-1, length) stays on the last frame instead
// of rounding up to `length` and indexing off the end; the modulo wraps the end back to the start and
// a negative playhead floors back into range — so the loop never gaps, freezes, or reads undefined.
export const loopIndex = (playhead: number, length: number): number => {
  const wrapped = Math.floor(playhead) % length;

  return wrapped < 0 ? wrapped + length : wrapped;
};

// contactFrame: the still frame a reduced-motion preview freezes on — the move's FIRST ACTIVE tick, the
// strike at contact / full extension (the same tick the dojo calls "contact"). The active window opens
// exactly at `startup` (see phaseAt), so that index is it. An unknown move has no timing and only a
// single idle tick, so it freezes on tick 0 — the only valid index (M7 totality; never reads off the
// end).
export const contactFrame = (move: string): number =>
  presetFor(move)?.startup ?? 0;
