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

export const BENCHMARK_VERSION = "v15"; // Item 3 / jogai adoption: MATCH scores jogai (ring-out); zoner made ring-aware (self.x guard), sweeper re-authored into the naive ring-out victim

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
// A scoring input ⇒ folded into INPUT_HASH; changing it forces a version bump.
export const MATCH = {
  winGap: 8,
  senshu: true,
  jogai: { margin: 100000 },
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
  "f8514a3f05c7069fc60db930e90528ceaf3959041433a4125f9714efa363a27c";
