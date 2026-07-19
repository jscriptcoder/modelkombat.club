// The reach-preset table: a documented MIRROR of the engine move reaches (src/engine/rules.ts), the
// same way scene.ts's WORLD_WIDTH mirrors the ring width — web/src can't import src/, so the values
// are transcribed here and pinned value-by-value in the test. The pose lab snaps the fighter gap to
// these so spacing/contact reads at true engine distances. Ascending, shortest → longest. Keep in
// sync with rules.ts if a move's reach ever changes (the test will flag drift, not catch it live).

// Alongside reach, each preset mirrors the move's FRAME TIMING (S2) — the same three engine fields,
// under the same names: how many ticks the technique spends winding up, at contact, and recovering.
// The pose lab spans a technique's tape over `startup + active + recovery` so it plays at true engine
// speed. Same mirror discipline as `reach`: transcribed, pinned value-by-value, drift caught by test.
// The third mirrored field (S3): the height bands a move may legally strike, as this codebase's
// numeric band codes (3 high / 2 mid / 1 low), in the order rules.ts lists them. Order matters —
// the move picker stamps the FIRST entry, so the engine's own ordering decides the default rather
// than an opinion transcribed here.
//
// OPTIONAL, faithfully: `throw` and `sweep` declare no band list, and `bandLegal` (sim.ts:613)
// reads an absent `bands` as EVERY band being legal. The sweep is constrained by hurtbox occupancy
// instead, and a throw is a grab with no height at all — so there is genuinely nothing to mirror,
// and inventing a list would put an interpretation in a transcription table.
export type ReachPreset = {
  move: string;
  reach: number;
  startup: number;
  active: number;
  recovery: number;
  bands?: readonly number[];
};

// Band codes, named so the table below reads as bands rather than as magic numbers.
const HIGH = 3;
const MID = 2;

export const REACH_PRESETS = [
  // move                reach       startup  active  recovery   bands (absent ⇒ unrestricted)
  {
    move: "empi",
    reach: 95_000,
    startup: 8,
    active: 2,
    recovery: 14,
    bands: [HIGH, MID],
  }, // elbow — the infighting floor
  {
    move: "hiza-geri",
    reach: 110_000,
    startup: 9,
    active: 2,
    recovery: 16,
    bands: [MID],
  }, // knee
  { move: "throw", reach: 120_000, startup: 7, active: 2, recovery: 14 }, // grab — no band at all
  { move: "sweep", reach: 180_000, startup: 7, active: 2, recovery: 13 }, // banded by occupancy, not bandLegal
  {
    move: "uraken",
    reach: 200_000,
    startup: 7,
    active: 2,
    recovery: 13,
    bands: [HIGH],
  }, // backfist — the only jodan-ONLY technique
  {
    move: "kizami-zuki",
    reach: 210_000,
    startup: 7,
    active: 2,
    recovery: 13,
    bands: [HIGH, MID],
  }, // jab
  {
    move: "gyaku-zuki",
    reach: 240_000,
    startup: 7,
    active: 3,
    recovery: 14,
    bands: [HIGH, MID],
  }, // reverse punch — the workhorse / opening distance
  {
    move: "tobi-geri",
    reach: 250_000,
    startup: 4,
    active: 3,
    recovery: 14,
    bands: [HIGH, MID],
  }, // jump kick — the fastest wind-up in the arsenal
  {
    move: "shuto",
    reach: 260_000,
    startup: 8,
    active: 2,
    recovery: 15,
    bands: [HIGH, MID],
  }, // knife-hand
  {
    move: "mae-geri",
    reach: 270_000,
    startup: 9,
    active: 3,
    recovery: 16,
    bands: [MID],
  }, // front kick
  {
    move: "mawashi-geri",
    reach: 300_000,
    startup: 11,
    active: 3,
    recovery: 18,
    bands: [HIGH, MID],
  }, // roundhouse
  {
    move: "yoko-geri",
    reach: 315_000,
    startup: 12,
    active: 3,
    recovery: 20,
    bands: [MID],
  }, // side kick
  {
    move: "ushiro-geri",
    reach: 330_000,
    startup: 13,
    active: 3,
    recovery: 22,
    bands: [HIGH, MID],
  }, // back kick — the reach apex
] as const satisfies readonly ReachPreset[];

// The mirror's lookup. `undefined` for an unknown / empty move id — the caller decides what a figure
// with no known technique looks like (M7 totality: an unknown id never throws, it falls back).
export const presetFor = (move: string): ReachPreset | undefined =>
  REACH_PRESETS.find((p) => p.move === move);

// How many ticks a technique occupies, end to end.
export const durationOf = (preset: ReachPreset): number =>
  preset.startup + preset.active + preset.recovery;

// Which phase a technique is in `tick` ticks after it commits, in the engine's own encoding
// (1 startup / 2 active / 3 recovery — mirroring `attackPhase` on the render tape).
export const phaseAt = (preset: ReachPreset, tick: number): number => {
  if (tick < preset.startup) return 1;
  if (tick < preset.startup + preset.active) return 2;

  return 3;
};

// The slider's travel: from fully overlapping (0) to the longest reach in the arsenal. MAX_GAP is
// derived from the table (not a stray literal) so it can never drift from the presets it bounds.
export const MIN_GAP = 0;
export const MAX_GAP = Math.max(...REACH_PRESETS.map((p) => p.reach));

// The lab's opening distance — gyaku-zuki reach, a real striking distance. Lives here (not in the
// tape builder) so the default folds onto the preset table: the opening gap IS one of the presets.
export const DEFAULT_GAP = 240_000;
