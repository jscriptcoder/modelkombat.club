// The per-defender championship-bout telemetry — a pure reshaping of the engine's
// `BenchmarkResult` into the fidelity a `/fight` board row carries. No I/O, no engine
// access; the derivation lives here so it is unit-testable without running fights.
import type {
  BenchmarkResult,
  DegradeTally,
  EndReasonTally,
} from "../engine/benchmark.js";

// The per-defender bout telemetry, at the fidelity every board row carries — net / win-loss-draw /
// endReasons / degrade — so a challenger can diagnose WHY it beat or lost to a defender (close vs
// blown out, on gap/time/senshu, self-gassing) instead of guessing from a lone win-rate. Each board
// entry is a SINGLE-opponent benchmark, so its top-level aggregates ARE that one matchup's score;
// `officiating.endedBy` and `degrade` stay fully-keyed even when the no-mirror rule skips a byte-clone
// (empty breakdown, totalFights 0 ⇒ every figure a clean zero), so no per-opponent lookup — and no
// empty guard — is needed. `losses` derives as fights − wins − draws.
export type TitleFightReport = {
  winRate: number;
  net: number; // Σ (botScore − oppScore) across the bouts
  wins: number;
  losses: number; // bouts − wins − draws
  draws: number;
  bouts: number; // |freshSeeds| × 2, or 0 for a mirror skip
  endReasons: EndReasonTally; // how the bouts ended (sums to bouts)
  degrade: DegradeTally; // the challenger's degraded frames vs this defender
};

export const toTitleFightReport = (r: BenchmarkResult): TitleFightReport => ({
  winRate: r.winRate,
  net: r.netPoints,
  wins: r.wins,
  losses: r.totalFights - r.wins - r.draws,
  draws: r.draws,
  bouts: r.totalFights,
  endReasons: r.officiating.endedBy,
  degrade: r.degrade,
});
