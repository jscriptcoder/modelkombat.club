import { describe, it, expect } from "vitest";

import { compareSubmission, type Submission } from "./submission.js";
import type { ValidationIssue } from "../engine/dsl.js";

// A submission is either a SCORED bot (it fought the gauntlet) or an INVALID one
// (it never fought — extraction/parse/validation rejected it). `compareSubmission`
// is the best-first ordering encoding the benchmark's hard-zero-distinct policy:
// every valid bot outranks every invalid one, no matter how badly the valid bot
// scored; valid bots order by net-points then win-rate; invalids don't discriminate.
const scored = (netPoints: number, wins = 0, totalFights = 0): Submission => ({
  kind: "scored",
  result: {
    netPoints,
    winRate: totalFights === 0 ? 0 : wins / totalFights,
    wins,
    draws: 0,
    totalFights,
    perOpponent: [],
  },
});

const invalid = (
  issues: ValidationIssue[] = [
    { path: "$", reason: "no bot JSON found in reply" },
  ],
): Submission => ({ kind: "invalid", issues });

describe("compareSubmission — hard-zero-distinct ranking", () => {
  it("sorts every valid bot above every invalid one — even a deeply-negative valid bot", () => {
    const ranked = [
      invalid(),
      scored(-9999, 0, 20),
      scored(50, 18, 20),
      invalid(),
    ]
      .sort(compareSubmission)
      .map((s) => (s.kind === "scored" ? s.result.netPoints : "invalid"));

    expect(ranked).toEqual([50, -9999, "invalid", "invalid"]);
  });

  it("orders two valid bots by net-points, best first", () => {
    expect(compareSubmission(scored(100), scored(40))).toBeLessThan(0);
    expect(compareSubmission(scored(40), scored(100))).toBeGreaterThan(0);
  });

  it("breaks a net-points tie by win-rate, best first", () => {
    const higher = scored(10, 16, 20); // win-rate 0.8
    const lower = scored(10, 4, 20); // win-rate 0.2

    expect(compareSubmission(higher, lower)).toBeLessThan(0);
    expect(compareSubmission(lower, higher)).toBeGreaterThan(0);
  });

  it("reports a genuine tie (0) when two valid bots match on both net-points and win-rate", () => {
    expect(compareSubmission(scored(10, 5, 20), scored(10, 5, 20))).toBe(0);
  });

  it("does not discriminate between two invalid outcomes (0)", () => {
    expect(compareSubmission(invalid(), invalid())).toBe(0);
  });

  it("ranks a scored bot before an invalid one and an invalid one after a scored", () => {
    expect(compareSubmission(scored(-1, 0, 20), invalid())).toBeLessThan(0);
    expect(compareSubmission(invalid(), scored(-1, 0, 20))).toBeGreaterThan(0);
  });
});
