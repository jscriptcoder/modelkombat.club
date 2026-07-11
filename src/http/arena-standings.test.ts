import { describe, expect, it } from "vitest";

import {
  arenaStandings,
  oppWinRate,
  pairIndices,
  type FightScore,
} from "./arena-standings.js";
import type { ArenaMember } from "./throne-store.js";

// A synthetic single-opponent score. `winRate` drives Copeland (strict > 0.5); `wins`/`draws`/
// `totalFights` drive the OPPONENT's win rate; `netPoints` the net. Set independently so a fixture
// can reach paths a real fight can't (exact ties, draw-heavy bouts).
const score = (o: Partial<FightScore>): FightScore => ({
  winRate: 0,
  netPoints: 0,
  wins: 0,
  draws: 0,
  totalFights: 10,
  ...o,
});

const member = (name: string, seniority: number): ArenaMember => ({
  champion: { version: 1, name, rules: [], default: { type: "idle" } },
  handle: null,
  seniority,
});

describe("oppWinRate — a contestant's win rate as the opponent of a single-opponent benchmark", () => {
  it("is 0 for a mirror skip (no fights ran)", () => {
    expect(oppWinRate(score({ totalFights: 0 }))).toBe(0);
  });

  it("is the share of bouts the opponent won: (fights − botWins − draws) / fights", () => {
    // 20 bouts, bot won 5, drew 3 ⇒ opponent won 12 ⇒ 0.6
    expect(oppWinRate(score({ totalFights: 20, wins: 5, draws: 3 }))).toBe(0.6);
  });

  it("subtracts draws (they are neither side's win), not adds them", () => {
    // 10 bouts, bot 2, drew 4 ⇒ opponent 4 ⇒ 0.4 (a +draws bug would read 1.2)
    expect(oppWinRate(score({ totalFights: 10, wins: 2, draws: 4 }))).toBe(0.4);
  });
});

describe("pairIndices — the round-robin schedule of unordered index pairs (i < j)", () => {
  it("has no pairs below two contestants", () => {
    expect(pairIndices(0)).toEqual([]);
    expect(pairIndices(1)).toEqual([]);
  });

  it("is the single pair for two contestants", () => {
    expect(pairIndices(2)).toEqual([[0, 1]]);
  });

  it("is every i < j pair for three and four contestants", () => {
    expect(pairIndices(3)).toEqual([
      [0, 1],
      [0, 2],
      [1, 2],
    ]);
    expect(pairIndices(4)).toEqual([
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
      [2, 3],
    ]);
  });
});

describe("arenaStandings — reduce the round-robin into Copeland wins + Σ net per contestant", () => {
  it("tallies the challenger's Copeland wins (strict > 0.5) and net over its fights", () => {
    const challenger = member("c", 4);
    const defenders = [member("d0", 1), member("d1", 2), member("d2", 3)];

    const challengerFights = [
      score({ winRate: 0.7, netPoints: 30 }), // beat d0
      score({ winRate: 0.5, netPoints: -5 }), // an exact tie is NOT a win (strict > 0.5)
      score({ winRate: 0.2, netPoints: -40 }), // lost to d2
    ];

    const { challengerStanding } = arenaStandings({
      defenders,
      challenger,
      challengerFights,
      defenderPairs: [],
    });

    // one Copeland win (only the 0.7 fight), net is the signed sum 30 − 5 − 40 = −15
    expect(challengerStanding).toEqual({
      member: challenger,
      wins: 1,
      net: -15,
    });
  });

  it("credits an exact-0.5 fight to neither side (the strict > 0.5 Copeland boundary)", () => {
    const challenger = member("c", 2);
    const defender = member("king", 1);

    // level fight: challenger winRate 0.5, and the defender's opponent-rate is also 0.5 (won 5 of 10)
    const challengerFights = [
      score({ winRate: 0.5, wins: 5, draws: 0, totalFights: 10 }),
    ];

    const { challengerStanding, defenderStandings } = arenaStandings({
      defenders: [defender],
      challenger,
      challengerFights,
      defenderPairs: [],
    });

    expect(challengerStanding.wins).toBe(0);
    expect(defenderStandings[0].wins).toBe(0);
  });

  it("attributes every fight to BOTH sides across a full three-defender round-robin", () => {
    const d0 = member("d0", 1);
    const d1 = member("d1", 2);
    const d2 = member("d2", 3);
    const challenger = member("c", 4);

    // challenger vs each defender (challenger as the bot)
    const challengerFights = [
      score({ winRate: 0.8, netPoints: 40, wins: 8, totalFights: 10 }), // beat d0
      score({ winRate: 0.3, netPoints: -20, wins: 3, totalFights: 10 }), // lost to d1
      score({ winRate: 0.6, netPoints: 10, wins: 6, totalFights: 10 }), // beat d2
    ];

    // defender pairs, i as the bot
    const defenderPairs = [
      { i: 0, j: 1, result: score({ winRate: 0.7, netPoints: 25, wins: 7 }) }, // d0 beat d1
      { i: 0, j: 2, result: score({ winRate: 0.4, netPoints: -15, wins: 4 }) }, // d0 lost to d2
      { i: 1, j: 2, result: score({ winRate: 0.9, netPoints: 50, wins: 9 }) }, // d1 beat d2
    ];

    const { challengerStanding, defenderStandings } = arenaStandings({
      defenders: [d0, d1, d2],
      challenger,
      challengerFights,
      defenderPairs,
    });

    // challenger: beat d0 + d2 ⇒ 2 wins; net 40 − 20 + 10 = 30
    expect(challengerStanding).toEqual({
      member: challenger,
      wins: 2,
      net: 30,
    });

    expect(defenderStandings).toEqual([
      // d0: lost to challenger (0); beat d1 as bot (+1); lost to d2 as bot (0) ⇒ 1 win.
      //     net = −40 (vs challenger) + 25 − 15 (as bot) = −30
      { member: d0, wins: 1, net: -30 },
      // d1: beat challenger via oppWinRate 0.7 (+1); lost {0,1} as opp (0); beat d2 as bot (+1) ⇒ 2.
      //     net = +20 (vs challenger) − 25 (as opp of {0,1}) + 50 (as bot {1,2}) = 45
      { member: d1, wins: 2, net: 45 },
      // d2: lost to challenger via oppWinRate 0.4 (0); beat {0,2} as opp 0.6 (+1); lost {1,2} opp (0) ⇒ 1.
      //     net = −10 (vs challenger) + 15 (as opp of {0,2}) − 50 (as opp of {1,2}) = −45
      { member: d2, wins: 1, net: -45 },
    ]);
  });
});
