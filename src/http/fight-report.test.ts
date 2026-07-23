import { describe, expect, it } from "vitest";

import { toTitleFightReport } from "./fight-report.js";
import type { BenchmarkResult } from "../engine/benchmark.js";

// A BenchmarkResult with inert defaults; the toTitleFightReport reshaper reads the top-level
// aggregates + officiating roll-up, so each test overrides exactly those. The per-opponent breakdown
// is unused by the reshaper (a single-defender fight's aggregates ARE that matchup), so it stays empty.
const benchmarkResult = (
  over: Partial<BenchmarkResult> = {},
): BenchmarkResult => ({
  netPoints: 0,
  winRate: 0,
  wins: 0,
  draws: 0,
  totalFights: 0,
  perOpponent: [],
  officiating: {
    endedBy: { gap: 0, time: 0, senshu: 0, overtime: 0 },
    jogai: { bot: 0, opp: 0 },
    passivity: { bot: 0, opp: 0 },
  },
  degrade: {
    unaffordable: 0,
    "out-of-band": 0,
    locked: 0,
    inert: 0,
    "wrong-context": 0,
  },
  ...over,
});

describe("toTitleFightReport — per-defender bout telemetry", () => {
  it("derives winRate / net / win-loss-draw / bouts from the benchmark aggregates", () => {
    // A single-opponent bout: its top-level aggregates ARE that one matchup's score.
    // draws > 0 pins the losses derivation (fights − wins − draws), not fights − wins.
    const result = benchmarkResult({
      winRate: 0.6,
      netPoints: 42,
      wins: 12,
      draws: 2,
      totalFights: 20,
    });

    const title = toTitleFightReport(result);

    expect(title.winRate).toBe(0.6);
    expect(title.net).toBe(42);
    expect(title.wins).toBe(12);
    expect(title.draws).toBe(2);
    expect(title.bouts).toBe(20);
    expect(title.losses).toBe(6); // 20 − 12 − 2 (NOT 20 − 12 + 2 = 10)
  });

  it("carries the bout's endReasons and degrade through verbatim", () => {
    const endedBy = { gap: 9, time: 6, senshu: 4, overtime: 1 };

    const degrade = {
      unaffordable: 3,
      "out-of-band": 0,
      locked: 27,
      inert: 0,
      "wrong-context": 1,
    };

    const result = benchmarkResult({
      totalFights: 20,
      officiating: {
        endedBy,
        jogai: { bot: 0, opp: 0 },
        passivity: { bot: 0, opp: 0 },
      },
      degrade,
    });

    const title = toTitleFightReport(result);

    // endReasons is sourced from the always-defined officiating roll-up (a single-opponent
    // fight ⇒ it equals that opponent's endReasons), so no per-opponent lookup is needed.
    expect(title.endReasons).toEqual(endedBy);
    expect(title.degrade).toEqual(degrade);
  });

  it("degrades every figure to a clean zero for an empty (mirror-skipped) breakdown", () => {
    // A byte-clone challenger is skipped: totalFights 0, empty perOpponent. Every figure
    // must derive from the always-defined aggregates, never crash on a missing opponent.
    const title = toTitleFightReport(benchmarkResult());

    expect(title).toEqual({
      winRate: 0,
      net: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      bouts: 0,
      endReasons: { gap: 0, time: 0, senshu: 0, overtime: 0 },
      degrade: {
        unaffordable: 0,
        "out-of-band": 0,
        locked: 0,
        inert: 0,
        "wrong-context": 0,
      },
    });
  });
});
