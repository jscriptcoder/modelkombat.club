// The reach-preset table: a documented MIRROR of the engine move reaches (src/engine/rules.ts), the
// same way scene.ts's WORLD_WIDTH mirrors the ring width — web/src can't import src/, so the values
// are transcribed here and pinned value-by-value in the test. The pose lab snaps the fighter gap to
// these so spacing/contact reads at true engine distances. Ascending, shortest → longest. Keep in
// sync with rules.ts if a move's reach ever changes (the test will flag drift, not catch it live).

export type ReachPreset = {
  move: string;
  reach: number;
};

export const REACH_PRESETS = [
  { move: "empi", reach: 95_000 }, // elbow — the infighting floor
  { move: "hiza-geri", reach: 110_000 }, // knee
  { move: "throw", reach: 120_000 }, // grab
  { move: "sweep", reach: 180_000 },
  { move: "uraken", reach: 200_000 }, // backfist
  { move: "kizami-zuki", reach: 210_000 }, // jab
  { move: "gyaku-zuki", reach: 240_000 }, // reverse punch — the workhorse / opening distance
  { move: "tobi-geri", reach: 250_000 }, // jump kick
  { move: "shuto", reach: 260_000 }, // knife-hand
  { move: "mae-geri", reach: 270_000 }, // front kick
  { move: "mawashi-geri", reach: 300_000 }, // roundhouse
  { move: "yoko-geri", reach: 315_000 }, // side kick
  { move: "ushiro-geri", reach: 330_000 }, // back kick — the reach apex
] as const satisfies readonly ReachPreset[];

// The slider's travel: from fully overlapping (0) to the longest reach in the arsenal. MAX_GAP is
// derived from the table (not a stray literal) so it can never drift from the presets it bounds.
export const MIN_GAP = 0;
export const MAX_GAP = Math.max(...REACH_PRESETS.map((p) => p.reach));

// The lab's opening distance — gyaku-zuki reach, a real striking distance. Lives here (not in the
// tape builder) so the default folds onto the preset table: the opening gap IS one of the presets.
export const DEFAULT_GAP = 240_000;
