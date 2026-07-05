// ============================================================================
// The frozen, versioned benchmark manifest — the SINGLE source of the scoring
// inputs, consumed by the harness (the CLI runner) and, later, the spec
// generator. Pure data: roster names + run parameters + the version string + a
// pinned digest of every scoring input. No I/O (the actual bot files are loaded
// by the CLI shell, which owns the filesystem).
//
// A benchmark score is comparable ONLY against another score carrying the same
// BENCHMARK_VERSION. INPUT_HASH pins the serialized CANONICAL_RULES + this
// manifest + the verbatim gauntlet bot files; the guard test fails CI if any of
// those drift without a matching version bump. Policy: also bump on any change to
// the engine outcome path (sim.ts / the dsl.ts interpreter), which the existing
// determinism/replay tests catch.
// ============================================================================

export const BENCHMARK_VERSION = "v19"; // Aerial exercise: rekka's reachable-but-dormant `tobi-geri` jump-in is weaponized (its gate `opponent.distance > 300000`, which the ~286k opening gap never cleared, is lowered to > 250000) so the gauntlet actually EXERCISES aerial combat — rekka jumps off the opening gap and connects for a jodan ippon, all 6 members stay ∈ [25,75]. Only the rekka bot text changes (one INPUT_HASH flip); CANONICAL_RULES + the spec's move table are unchanged

// The seeded perception jitter draws differ per seed; ten seeds average it out.
export const SEEDS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export const MAX_TICKS = 600;

// WKF match mode: a fight ends the moment the point gap reaches winGap (else it
// runs to MAX_TICKS and is decided on points). This makes a benchmark fight a
// real match — ranking who WINS, not who farms the most raw points over the cap.
// `senshu` (v4): a level-at-cap bout is decided by first blood (the first fighter
// to score) instead of drawing — so win-rate discriminates the close, low-scoring
// matchups that previously drew.
// `jogai` (v15): a fighter driven into the outer `margin` strip of the ring rings
// out — a yame-style reset plus a shared category-2 penalty (1st free, 2+ ⇒
// opponent +1). Makes the officiating perception fields (self.x-vs-edge, penalties)
// live; the zoner reads self.x to avoid it, the sweeper naively rings itself out.
// `passivity` (v16): a fighter that goes `limit` = 240 ticks without landing offense
// is fouled on the same shared category-2 ladder — makes `self.passivityRemaining`
// live. The jabber reads it (a last-ditch re-engage), the vulture is shaped into a
// standoff victim that eats the fouls. 240 (not a tighter value) is calibrated so a
// patient counter-fighter is not mis-flagged while a genuine staller still is.
// `overtime` (v17): a bout LEVEL at the cap plays one sudden-death `ticks` = 300 period —
// first to a 1-point gap wins (`endReason:"overtime"`), else it exhausts to the senshu/draw
// fallback. Makes `clock.overtime` live: the jabber multi-reads it to go all-in in sudden
// death. Measured: the frozen board yields 7 such bouts (4 flipping the winner vs senshu), all
// 6 members stay ∈ [25,75] — a natural fire, no victim shaping. The full win cascade is now
// `winGap → overtime → senshu → draw`, closing the deferred officiating adoption (item 3).
// A scoring input ⇒ folded into INPUT_HASH; changing it forces a version bump.
export const MATCH = {
  winGap: 8,
  senshu: true,
  jogai: { margin: 100000 },
  passivity: { limit: 240 },
  overtime: { ticks: 300 },
} as const;

// The 6 locked archetypes (bots/<name>.json), spanning the strategic axes —
// pressure (jabber poke + rekka cancel-combo), zoner, grappler, sweeper/okizeme,
// and band-reading defense (vulture) — so no single counter-strategy can
// top-score. Order is part of the frozen identity (it fixes the report order and
// the INPUT_HASH).
export const GAUNTLET_NAMES: readonly string[] = [
  "jabber",
  "rekka",
  "zoner",
  "grappler",
  "sweeper",
  "vulture",
];

// sha256 of { rules: CANONICAL_RULES, seeds, maxTicks, match, gauntlet: [<file text>] }.
// The gauntlet file texts are hashed with LF line endings, pinned by `.gitattributes`
// (`bots/*.json text eol=lf`) so the digest is byte-stable on every platform. Recompute
// and bump (with BENCHMARK_VERSION) whenever a scoring input changes — the guard test in
// benchmark-config.test.ts prints the expected value on drift. (Computed over all-LF bot
// texts, pinned by `.gitattributes`, so the digest is byte-stable on every platform.)
export const INPUT_HASH =
  "4764cdd7a51fbded720070f52e1cc34e5b7486d173b4fd5772583fc6e75f8926";
