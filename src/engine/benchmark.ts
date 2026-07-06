// ============================================================================
// Benchmark aggregator — the pure scoring core of the one-shot LLM bot-authoring
// benchmark. Given a submitted bot, a frozen gauntlet, the seed set, a tick cap,
// the frame table, and (in WKF match mode) the win gap, it runs every
// (opponent × seed × side) fight through the real deterministic engine
// (`runFight`) and reduces them to the ranking figures — win-rate (primary) and
// Σ net-points (tiebreaker) — with a per-opponent breakdown.
//
// PURE + deterministic: no I/O, no clock, no randomness of its own — the only
// entropy is each fight's seed, which threads `runFight`'s PRNG. Each
// (opponent × seed) is played TWICE — submitted bot as fighter A, then as
// fighter B — and both fights count, cancelling the start-side / PRNG-draw-order
// asymmetry baked into the perception jitter (a matchup is not side-symmetric).
//
// No mirror: a gauntlet opponent that deep-equals the submitted document is
// skipped (a bot vs its own clone is just side-asymmetry noise). For a real LLM
// submission this never triggers; it only matters when self-testing a roster bot.
// ============================================================================
import { runFight, type FightConfig, type FightResult } from "./sim.js";
import type { Rules } from "./types.js";
import type { BotDoc } from "./dsl.js";

// A count of bouts per `endReason` — the shape shared by the per-opponent
// breakdown and the global `endedBy` roll-up.
export type EndReasonTally = Record<FightResult["endReason"], number>;

export type OpponentScore = {
  name: string;
  netPoints: number; // Σ (botScore − oppScore) over both sides × seeds
  wins: number; // fights the submitted bot won (a draw is not a win)
  draws: number;
  fights: number; // |seeds| × 2
  endReasons: EndReasonTally; // how THIS matchup's bouts ended (sums to fights)
};

// A supplementary read-out of how the fights were officiated — never a ranking key.
// `endedBy` buckets every bout by its `endReason`; `jogai` and `passivity` each split their
// category-2 fouls into the submitted bot's own vs. its opponents' (bot-centric, like every
// other figure — NOT the raw fighter-A/B split, which mixes the two once both sides are played).
export type OfficiatingTally = {
  endedBy: EndReasonTally;
  jogai: { bot: number; opp: number };
  passivity: { bot: number; opp: number };
};

export type BenchmarkResult = {
  netPoints: number; // Σ (botScore − oppScore) — the tiebreaker ranking key
  winRate: number; // wins / totalFights — the primary ranking key; 0 when no fights ran
  wins: number;
  draws: number;
  totalFights: number;
  perOpponent: OpponentScore[];
  officiating: OfficiatingTally; // inert to ranking; a read-out for the CLI report
};

export type BenchmarkConfig = {
  bot: BotDoc;
  gauntlet: BotDoc[];
  seeds: readonly number[];
  maxTicks: number;
  rules: Rules;
  // WKF match mode, carried verbatim into `runFight` (the aggregator keys off the
  // resulting `winner`, so any tie-resolution — e.g. senshu — propagates for free).
  // Absent ⇒ every fight runs to maxTicks.
  match?: FightConfig["match"];
};

// One fight reduced to the submitted bot's perspective — the ranking figures plus the
// officiating read-out (how it ended, and each side's jogai ring-outs + passivity fouls).
type Outcome = {
  net: number;
  botWin: boolean;
  draw: boolean;
  endReason: FightResult["endReason"];
  jogaiBot: number; // the submitted bot's own ring-outs this fight
  jogaiOpp: number; // the opponent's ring-outs this fight
  passivityBot: number; // the submitted bot's own passivity fouls this fight
  passivityOpp: number; // the opponent's passivity fouls this fight
};

// Deep document identity for the no-mirror rule. Both documents are validated
// JSON (plain data, no functions/undefined), so a serialization compare is a
// faithful deep-equal. It is conservative on key order — a reordered-but-otherwise
// -identical doc would NOT be skipped — which only ever yields a (harmless) extra
// mirror fight, never a wrong skip; the real trigger is the SAME file submitted
// against itself, where order is identical.
const sameDoc = (a: BotDoc, b: BotDoc): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

// Play one (bot vs opponent) matchup at one seed on BOTH sides, each reduced to
// the submitted bot's perspective.
const playBothSides = (
  bot: BotDoc,
  opp: BotDoc,
  seed: number,
  maxTicks: number,
  rules: Rules,
  match: BenchmarkConfig["match"],
): Outcome[] => {
  const asA = runFight({ rules, botA: bot, botB: opp, maxTicks, seed, match });
  const asB = runFight({ rules, botA: opp, botB: bot, maxTicks, seed, match });

  return [
    {
      net: asA.scores.a - asA.scores.b,
      botWin: asA.winner === "A",
      draw: asA.winner === "draw",
      endReason: asA.endReason,
      jogaiBot: asA.fouls.a.jogai, // bot is fighter A here
      jogaiOpp: asA.fouls.b.jogai,
      passivityBot: asA.fouls.a.passivity,
      passivityOpp: asA.fouls.b.passivity,
    },
    {
      net: asB.scores.b - asB.scores.a,
      botWin: asB.winner === "B",
      draw: asB.winner === "draw",
      endReason: asB.endReason,
      jogaiBot: asB.fouls.b.jogai, // bot is fighter B here
      jogaiOpp: asB.fouls.a.jogai,
      passivityBot: asB.fouls.b.passivity,
      passivityOpp: asB.fouls.a.passivity,
    },
  ];
};

const outcomesAgainst = (
  bot: BotDoc,
  opp: BotDoc,
  seeds: readonly number[],
  maxTicks: number,
  rules: Rules,
  match: BenchmarkConfig["match"],
): Outcome[] =>
  seeds.flatMap((seed) =>
    playBothSides(bot, opp, seed, maxTicks, rules, match),
  );

const summarize = (name: string, outcomes: Outcome[]): OpponentScore => ({
  name,
  netPoints: outcomes.reduce((sum, o) => sum + o.net, 0),
  wins: outcomes.filter((o) => o.botWin).length,
  draws: outcomes.filter((o) => o.draw).length,
  fights: outcomes.length,
  endReasons: outcomes.reduce<EndReasonTally>(
    (acc, o) => ({ ...acc, [o.endReason]: acc[o.endReason] + 1 }),
    { gap: 0, time: 0, senshu: 0, overtime: 0 },
  ),
});

// Fold every fight's officiating read-out into one aggregate: how it ended (per
// `endReason`) and the running bot-vs-opponent jogai + passivity foul splits.
const tallyOfficiating = (outcomes: Outcome[]): OfficiatingTally =>
  outcomes.reduce<OfficiatingTally>(
    (acc, o) => ({
      endedBy: { ...acc.endedBy, [o.endReason]: acc.endedBy[o.endReason] + 1 },
      jogai: {
        bot: acc.jogai.bot + o.jogaiBot,
        opp: acc.jogai.opp + o.jogaiOpp,
      },
      passivity: {
        bot: acc.passivity.bot + o.passivityBot,
        opp: acc.passivity.opp + o.passivityOpp,
      },
    }),
    {
      endedBy: { gap: 0, time: 0, senshu: 0, overtime: 0 },
      jogai: { bot: 0, opp: 0 },
      passivity: { bot: 0, opp: 0 },
    },
  );

export const benchmark = (cfg: BenchmarkConfig): BenchmarkResult => {
  const { bot, gauntlet, seeds, maxTicks, rules, match } = cfg;

  const outcomesByOpponent = gauntlet
    .filter((opp) => !sameDoc(opp, bot)) // no mirror
    .map((opp) => ({
      name: opp.name,
      outcomes: outcomesAgainst(bot, opp, seeds, maxTicks, rules, match),
    }));

  const perOpponent = outcomesByOpponent.map(({ name, outcomes }) =>
    summarize(name, outcomes),
  );

  const allOutcomes = outcomesByOpponent.flatMap((o) => o.outcomes);

  const netPoints = perOpponent.reduce((sum, o) => sum + o.netPoints, 0);
  const wins = perOpponent.reduce((sum, o) => sum + o.wins, 0);
  const draws = perOpponent.reduce((sum, o) => sum + o.draws, 0);
  const totalFights = perOpponent.reduce((sum, o) => sum + o.fights, 0);

  return {
    netPoints,
    winRate: totalFights === 0 ? 0 : wins / totalFights,
    wins,
    draws,
    totalFights,
    perOpponent,
    officiating: tallyOfficiating(allOutcomes),
  };
};
