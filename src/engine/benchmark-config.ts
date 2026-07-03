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

export const BENCHMARK_VERSION = "v9"; // Batch-1 arsenal expansion #5: empi (elbow) enters CANONICAL_RULES

// The seeded perception jitter draws differ per seed; ten seeds average it out.
export const SEEDS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export const MAX_TICKS = 600;

// WKF match mode: a fight ends the moment the point gap reaches winGap (else it
// runs to MAX_TICKS and is decided on points). This makes a benchmark fight a
// real match — ranking who WINS, not who farms the most raw points over the cap.
// `senshu` (v4): a level-at-cap bout is decided by first blood (the first fighter
// to score) instead of drawing — so win-rate discriminates the close, low-scoring
// matchups that previously drew.
// A scoring input ⇒ folded into INPUT_HASH; changing it forces a version bump.
export const MATCH = { winGap: 8, senshu: true } as const;

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
// Recompute and bump (with BENCHMARK_VERSION) whenever a scoring input changes —
// the guard test in benchmark-config.test.ts prints the expected value on drift.
export const INPUT_HASH =
  "7cb8c325325b6465eb9c645d0e1731224d97547cc55f640dc760b57d1873d69e";
