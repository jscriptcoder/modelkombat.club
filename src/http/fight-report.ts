// The compact, egocentric gauntlet-gate report — a pure reshaping of the engine's
// `BenchmarkResult` into the `/fight` response contract (decisions §API response
// contract). No I/O, no engine access; the gate predicate and per-member
// derivations live here so they are unit-testable without running fights.
import type { BenchmarkResult, OpponentScore } from "../engine/benchmark.js";

export type FightReportOpponent = {
  name: string;
  winRate: number; // wins / fights
  wins: number;
  losses: number; // fights − wins − draws
  draws: number;
  net: number; // Σ (botScore − oppScore)
  passed: boolean; // won > 50% vs this member (strict)
};

export type FightReport = {
  version: string; // ruleset/benchmark version scored on
  cleared: boolean; // won > 50% vs EACH of the frozen gauntlet members
  gauntlet: {
    seeds: readonly number[]; // fixed + disclosed
    perOpponent: FightReportOpponent[];
  };
};

// The gate bar: strictly MORE than half the head-to-head fights won (a draw is not
// a win). Strict `>` resolves the exact-tie edge — 10-10 of 20 = 0.5 does NOT pass.
const winRateOf = (o: OpponentScore): number => o.wins / o.fights;
const passedBy = (o: OpponentScore): boolean => winRateOf(o) > 0.5;

const toReportOpponent = (o: OpponentScore): FightReportOpponent => ({
  name: o.name,
  winRate: winRateOf(o),
  wins: o.wins,
  losses: o.fights - o.wins - o.draws,
  draws: o.draws,
  net: o.netPoints,
  passed: passedBy(o),
});

export const buildFightReport = (
  result: BenchmarkResult,
  opts: {
    version: string;
    seeds: readonly number[];
    gauntletNames: readonly string[];
  },
): FightReport => {
  // Cleared iff EVERY expected member is present in the breakdown AND was beaten
  // > 50%. Keying off `gauntletNames` (not the returned rows) means a member that
  // did not appear — e.g. a byte-clone skipped by the no-mirror rule — leaves the
  // gate false: copying a gauntlet fighter can never clear (decisions §mirror rule).
  const cleared = opts.gauntletNames.every((name) => {
    const o = result.perOpponent.find((p) => p.name === name);

    return o !== undefined && passedBy(o);
  });

  return {
    version: opts.version,
    cleared,
    gauntlet: {
      seeds: opts.seeds,
      perOpponent: result.perOpponent.map(toReportOpponent),
    },
  };
};
