// The arena round-robin TALLY — a pure reduction of the pairwise fight scores into each contestant's
// Copeland win-count + Σ net-points (the ranking figures `rankArena` consumes). Extracted from the
// fight orchestration (like `fight-report.ts` and `rank-arena.ts`) so the arithmetic — Copeland's
// strict `> 0.5`, the net-sign bookkeeping, the defender-vs-defender attribution — is unit-testable
// with synthetic fixtures that reach paths real filling-arena fights can't (exact ties, draws,
// three-defender round-robins). Platform layer, no engine reach: it consumes already-computed scores.
import type { BenchmarkResult } from "../engine/benchmark.js";
import type { ArenaMember } from "./throne-store.js";
import type { Standing } from "./rank-arena.js";

// The figures a single-opponent benchmark carries that the tally reads (a full `BenchmarkResult` is
// assignable). Narrow so synthetic fixtures need only these five numbers.
export type FightScore = Pick<
  BenchmarkResult,
  "winRate" | "netPoints" | "wins" | "draws" | "totalFights"
>;

// A contestant's win rate as the OPPONENT of a single-opponent benchmark: the bot's own win rate is
// `r.winRate`; the opponent won the bouts the bot neither won nor drew. A mirror skip (0 fights) is 0
// — nobody "beat" anybody.
export const oppWinRate = (r: FightScore): number =>
  r.totalFights === 0 ? 0 : (r.totalFights - r.wins - r.draws) / r.totalFights;

// A Copeland win: strictly more than half the bouts won (a draw is not a win) — mirrors the gauntlet
// gate's `> 0.5`.
const beat = (winRate: number): boolean => winRate > 0.5;

// The round-robin schedule: every unordered index pair `[i, j]` with `i < j` over `count` contestants.
export const pairIndices = (
  count: number,
): Array<readonly [number, number]> => {
  const indices = Array.from({ length: count }, (_, i) => i);

  return indices.flatMap((i) =>
    indices.slice(i + 1).map((j) => [i, j] as const),
  );
};

// One defender-vs-defender fight: the two defender indices + the benchmark score with `i` as the bot.
export type DefenderPair = { i: number; j: number; result: FightScore };

// Reduce the round-robin into standings. `challengerFights[k]` is the challenger vs `defenders[k]`
// (challenger as the bot); `defenderPairs` covers every defender pair (`i < j`, `i` as the bot). Each
// fight is attributed to BOTH sides: the bot reads its own `winRate` / `netPoints`, the opponent the
// complement (`oppWinRate`, negated net). So a fight the challenger lost still credits the defender.
export const arenaStandings = (input: {
  defenders: readonly ArenaMember[];
  challenger: ArenaMember;
  challengerFights: readonly FightScore[];
  defenderPairs: readonly DefenderPair[];
}): { defenderStandings: Standing[]; challengerStanding: Standing } => {
  const challengerStanding: Standing = {
    member: input.challenger,
    wins: input.challengerFights.filter((r) => beat(r.winRate)).length,
    net: input.challengerFights.reduce((sum, r) => sum + r.netPoints, 0),
  };

  const defenderStandings = input.defenders.map((member, k): Standing => {
    // The challenger was the bot in `challengerFights[k]`, so this defender is the opponent there.
    const vsChallenger = input.challengerFights[k];
    const asBot = input.defenderPairs.filter((p) => p.i === k);
    const asOpp = input.defenderPairs.filter((p) => p.j === k);

    const wins =
      (beat(oppWinRate(vsChallenger)) ? 1 : 0) +
      asBot.filter((p) => beat(p.result.winRate)).length +
      asOpp.filter((p) => beat(oppWinRate(p.result))).length;

    const net =
      -vsChallenger.netPoints +
      asBot.reduce((sum, p) => sum + p.result.netPoints, 0) +
      asOpp.reduce((sum, p) => sum - p.result.netPoints, 0);

    return { member, wins, net };
  });

  return { defenderStandings, challengerStanding };
};
