import { describe, expect, it } from "vitest";

import { buildFightReport } from "./fight-report.js";
import type { BenchmarkResult, OpponentScore } from "../engine/benchmark.js";

// Real engine types — no redefinition (testing rule). A per-opponent score with
// sensible defaults (a dead-even 10-10 of 20 fights) that each test overrides.
const opponentScore = (
  over: Partial<OpponentScore> & { name: string },
): OpponentScore => ({
  netPoints: 0,
  wins: 10,
  draws: 0,
  fights: 20,
  endReasons: { gap: 0, time: 0, senshu: 0, overtime: 0 },
  ...over,
});

// A BenchmarkResult carrying the given per-opponent breakdown. The global
// roll-ups + officiating are required by the type but unused by the slice-1
// reshaper, so they are inert zeros here.
const benchmarkResult = (perOpponent: OpponentScore[]): BenchmarkResult => ({
  netPoints: 0,
  winRate: 0,
  wins: 0,
  draws: 0,
  totalFights: 0,
  perOpponent,
  officiating: {
    endedBy: { gap: 0, time: 0, senshu: 0, overtime: 0 },
    jogai: { bot: 0, opp: 0 },
    passivity: { bot: 0, opp: 0 },
  },
});

const opts = (gauntletNames: string[]) => ({
  version: "v19",
  seeds: [1, 2, 3] as const,
  gauntletNames,
});

describe("buildFightReport — the compact gauntlet-gate report", () => {
  it("clears when the bot won more than half vs every gauntlet member", () => {
    const result = benchmarkResult([
      opponentScore({ name: "a", wins: 11 }),
      opponentScore({ name: "b", wins: 12 }),
    ]);

    const report = buildFightReport(result, opts(["a", "b"]));

    expect(report.cleared).toBe(true);
    expect(report.gauntlet.perOpponent.every((o) => o.passed)).toBe(true);
    expect(report.gauntlet.perOpponent[0].winRate).toBeCloseTo(0.55); // 11/20
  });

  it("does not clear when a member sits exactly at 50% (strict > gate)", () => {
    const result = benchmarkResult([
      opponentScore({ name: "a", wins: 11 }),
      opponentScore({ name: "b", wins: 10 }), // 10/20 = 0.5 — NOT > 0.5
    ]);

    const report = buildFightReport(result, opts(["a", "b"]));

    expect(report.cleared).toBe(false);
    expect(
      report.gauntlet.perOpponent.find((o) => o.name === "b")?.passed,
    ).toBe(false);
  });

  it("does not clear when a gauntlet member is missing (mirror skip)", () => {
    // only 'a' fought — 'b' was skipped as a byte-clone. The gate must still fail
    // (copying a gauntlet fighter can never clear — decisions §mirror rule).
    const result = benchmarkResult([opponentScore({ name: "a", wins: 20 })]);

    const report = buildFightReport(result, opts(["a", "b"]));

    expect(report.cleared).toBe(false);
    expect(report.gauntlet.perOpponent).toHaveLength(1);
  });

  it("derives winRate, losses and net per opponent", () => {
    const result = benchmarkResult([
      opponentScore({
        name: "zoner",
        wins: 7,
        draws: 1,
        fights: 20,
        netPoints: -54,
      }),
    ]);

    const [o] = buildFightReport(result, opts(["zoner"])).gauntlet.perOpponent;

    expect(o.winRate).toBeCloseTo(0.35); // 7/20
    expect(o.losses).toBe(12); // 20 - 7 - 1
    expect(o.draws).toBe(1);
    expect(o.net).toBe(-54);
    expect(o.passed).toBe(false);
  });

  it("passes version and seeds through and carries no title block", () => {
    const result = benchmarkResult([opponentScore({ name: "a" })]);

    const report = buildFightReport(result, opts(["a"]));

    expect(report.version).toBe("v19");
    expect(report.gauntlet.seeds).toEqual([1, 2, 3]);
    expect(report).not.toHaveProperty("title"); // throne is S4
  });

  it("carries each opponent's endReasons through to its report entry", () => {
    // The report surfaces HOW each matchup ended, verbatim from the OpponentScore.
    const result = benchmarkResult([
      opponentScore({
        name: "zoner",
        endReasons: { gap: 5, time: 12, senshu: 2, overtime: 1 },
      }),
    ]);

    const [o] = buildFightReport(result, opts(["zoner"])).gauntlet.perOpponent;

    expect(o.endReasons).toEqual({ gap: 5, time: 12, senshu: 2, overtime: 1 });
  });

  it("keys each member to ITS OWN result — a,b pass but c fails ⇒ not cleared", () => {
    // The gate must match each gauntlet name to its own opponent, not merely find
    // some passing one. Only the LAST member fails: a lookup that matched a
    // DIFFERENT opponent would see three passes and wrongly clear.
    const result = benchmarkResult([
      opponentScore({ name: "a", wins: 11 }),
      opponentScore({ name: "b", wins: 11 }),
      opponentScore({ name: "c", wins: 10 }), // 0.5 — fails
    ]);

    const report = buildFightReport(result, opts(["a", "b", "c"]));

    expect(report.cleared).toBe(false);
  });
});
