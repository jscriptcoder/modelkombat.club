import { describe, it, expect } from "vitest";
import { benchmark, type BenchmarkConfig } from "./benchmark.js";
import type { Rules, Action } from "./types.js";
import type { BotDoc, BoolExpr } from "./dsl.js";

// ─── factories ───────────────────────────────────────────────────────────────
// Mock rules WITHOUT perception: no perception ⇒ no PRNG draws ⇒ every fight is
// seed-independent AND swap-symmetric, so the aggregation arithmetic is exactly
// predictable. gyaku-zuki reach 250000, startGap 200000 ⇒ in range.
const MOCK_RULES: Rules = {
  tickRate: 60,
  walkSpeed: 4000,
  ring: { width: 600000 },
  startGap: 200000,
  moves: {
    "gyaku-zuki": {
      startup: 4,
      active: 2,
      recovery: 6,
      score: 1,
      reach: 250000,
    },
  },
};

const named = (name: string, dflt: Action): BotDoc => ({
  version: 1,
  name,
  model: "test",
  rules: [],
  default: dflt,
});

const ATTACK_MID: Action = { type: "attack", move: "gyaku-zuki", band: "mid" };

// Always attacks ⇒ scores 1 vs an idler over 12 ticks; trades 1-1 vs another attacker.
const SUBMITTED = named("sub", ATTACK_MID);
// Same behaviour as SUBMITTED but a DIFFERENT name ⇒ NOT a mirror (deep-equal includes name).
const TRADER = named("trader", ATTACK_MID);
// Never scores.
const LOSER = named("loser", { type: "idle" });
// Always backpedals away from the opponent ⇒ backs into its OWN out-zone (the low edge
// as fighter A, the high edge as fighter B), ringing out on either slot.
const RETREATER = named("retreater", { type: "move", dir: -1 });
// Byte-for-byte identical to SUBMITTED ⇒ the no-mirror skip must drop it.
const SUBMITTED_CLONE = named("sub", ATTACK_MID);

// Attacks a valid MoveId that MOCK_RULES does NOT configure ⇒ the action never starts;
// it degrades to `inert` EVERY tick (stays neutral, so no `locked` follow-on).
const INERT_BOT = named("inert-bot", {
  type: "attack",
  move: "kizami-zuki",
  band: "mid",
});

// ─── senshu fixtures ─────────────────────────────────────────────────────────
// A level-at-cap matchup with a SOLO first blood, for the senshu tie-break (D1).
const selfHasScored: BoolExpr = {
  op: "gte",
  args: [
    { op: "field", path: "self.points" },
    { op: "const", value: 1 },
  ],
};

const oppHasScored: BoolExpr = {
  op: "gte",
  args: [
    { op: "field", path: "opponent.points" },
    { op: "const", value: 1 },
  ],
};

// Scores its first point ASAP, then idles forever ⇒ exactly 1 technique point,
// always drawn FIRST (its opponent below waits) ⇒ it holds senshu.
const SCORER: BotDoc = {
  version: 1,
  name: "scorer",
  model: "test",
  rules: [{ when: selfHasScored, do: { type: "idle" } }],
  default: ATTACK_MID,
};

// Idles until the opponent has drawn first blood, THEN scores exactly one point ⇒
// its point always lands AFTER the scorer's ⇒ a SOLO first blood for SCORER and a
// 1-1 level bout at the cap (the gap never nears winGap).
const DELAYED: BotDoc = {
  version: 1,
  name: "delayed",
  model: "test",
  rules: [
    { when: selfHasScored, do: { type: "idle" } },
    { when: oppHasScored, do: ATTACK_MID },
  ],
  default: { type: "idle" },
};

const config = (o: Partial<BenchmarkConfig> = {}): BenchmarkConfig => ({
  bot: SUBMITTED,
  gauntlet: [LOSER, TRADER],
  seeds: [1, 2],
  maxTicks: 12,
  rules: MOCK_RULES,
  ...o,
});

describe("benchmark — aggregation over both sides × seeds", () => {
  it("sums net-points and win/draw counts across every (opponent × seed × side) fight", () => {
    const result = benchmark(config());

    // vs LOSER: bot scores 1, loser 0 ⇒ net +1 + a win, on all 2 seeds × 2 sides = 4 fights.
    // vs TRADER: both score 1 ⇒ net 0 + a draw, on all 4 fights.
    // No match ⇒ every fight runs to the cap ⇒ all four bouts per opponent end by "time".
    const allTime = { gap: 0, time: 4, senshu: 0, overtime: 0 };

    expect(result.perOpponent).toEqual([
      {
        name: "loser",
        netPoints: 4,
        wins: 4,
        draws: 0,
        fights: 4,
        endReasons: allTime,
      },
      {
        name: "trader",
        netPoints: 0,
        wins: 0,
        draws: 4,
        fights: 4,
        endReasons: allTime,
      },
    ]);
    expect(result.netPoints).toBe(4);
    expect(result.wins).toBe(4);
    expect(result.draws).toBe(4);
    expect(result.totalFights).toBe(8);
    expect(result.winRate).toBe(0.5); // 4 wins / 8 fights (draws are not wins)
  });

  it("plays each (opponent × seed) on BOTH sides — fights = |seeds| × 2 per opponent", () => {
    const result = benchmark(config({ gauntlet: [LOSER], seeds: [1, 2, 3] }));

    expect(result.totalFights).toBe(6); // 3 seeds × 2 sides
    expect(result.perOpponent[0].fights).toBe(6);
    expect(result.perOpponent[0].wins).toBe(6); // the bot wins as A AND as B
    expect(result.netPoints).toBe(6); // +1 each fight, both sides
  });

  it("skips a gauntlet opponent that deep-equals the submitted bot (no mirror)", () => {
    const result = benchmark(config({ gauntlet: [SUBMITTED_CLONE, LOSER] }));

    expect(result.perOpponent.map((o) => o.name)).toEqual(["loser"]); // clone dropped
    expect(result.totalFights).toBe(4); // only the LOSER pairing, both sides × 2 seeds
    expect(result.netPoints).toBe(4);
    expect(result.winRate).toBe(1);
  });

  it("returns a zeroed result with win-rate 0 when every opponent is skipped (no divide-by-zero)", () => {
    const result = benchmark(config({ gauntlet: [SUBMITTED_CLONE] }));

    expect(result.perOpponent).toEqual([]);
    expect(result.totalFights).toBe(0);
    expect(result.netPoints).toBe(0);
    expect(result.wins).toBe(0);
    expect(result.winRate).toBe(0);
  });

  it("is deterministic — the same config scores byte-identically twice", () => {
    expect(benchmark(config())).toEqual(benchmark(config()));
  });

  it("threads match mode into every fight — fights end at the win gap, bounding net-points", () => {
    // Over 300 ticks the bot out-scores the idle LOSER many times; match mode
    // ends each fight the moment the bot leads by 8, so net is EXACTLY the gap.
    const matched = config({
      gauntlet: [LOSER],
      seeds: [1],
      maxTicks: 300,
      match: { winGap: 8 },
    });

    const result = benchmark(matched);

    // 1 seed × 2 sides = 2 fights, each ending at a +8 gap ⇒ net 16, both wins.
    expect(result.perOpponent[0].netPoints).toBe(16);
    expect(result.perOpponent[0].wins).toBe(2);
    expect(result.winRate).toBe(1);

    // Without match the bot keeps farming past the gap to the cap ⇒ strictly more.
    const unmatched = benchmark({ ...matched, match: undefined });
    expect(unmatched.perOpponent[0].netPoints).toBeGreaterThan(16);
  });
});

describe("benchmark — senshu first-blood tie-resolution (Capability D1)", () => {
  // Same SOLO-first-blood, level-at-cap matchup; only `match.senshu` toggles.
  const senshuConfig = (senshu: boolean): BenchmarkConfig => ({
    bot: SCORER,
    gauntlet: [DELAYED],
    seeds: [1],
    maxTicks: 120,
    rules: MOCK_RULES,
    match: senshu ? { winGap: 8, senshu: true } : { winGap: 8 },
  });

  it("scores a level-at-cap bout as a WIN for the first-blood holder when senshu is on", () => {
    const result = benchmark(senshuConfig(true));

    // SCORER draws first blood on BOTH sides (behaviour is per-document, not per-slot)
    // ⇒ holds senshu ⇒ wins the otherwise-level 1-1 bout each time.
    expect(result.perOpponent[0]).toEqual({
      name: "delayed",
      netPoints: 0, // 1-1 each fight ⇒ net 0
      wins: 2, // as A and as B
      draws: 0,
      fights: 2,
      endReasons: { gap: 0, time: 0, senshu: 2, overtime: 0 }, // decided by first blood
    });
    expect(result.wins).toBe(2);
    expect(result.draws).toBe(0);
  });

  it("scores the SAME level-at-cap bout as a DRAW when senshu is absent", () => {
    const result = benchmark(senshuConfig(false));

    // No senshu ⇒ the level 1-1 bout stays a draw on both sides.
    expect(result.perOpponent[0]).toEqual({
      name: "delayed",
      netPoints: 0,
      wins: 0,
      draws: 2,
      fights: 2,
      endReasons: { gap: 0, time: 2, senshu: 0, overtime: 0 }, // level bout runs to cap
    });
    expect(result.wins).toBe(0);
    expect(result.draws).toBe(2);
  });

  it("leaves net-points invariant under senshu — only the win/draw tally moves (AC-3)", () => {
    const withSenshu = benchmark(senshuConfig(true));
    const without = benchmark(senshuConfig(false));

    // senshu rewrites only the winner of a level bout — it never touches a score.
    expect(withSenshu.netPoints).toBe(without.netPoints);
    // ... while the win/draw tally diverges (win vs draw).
    expect(withSenshu.wins).not.toBe(without.wins);
    expect(withSenshu.draws).not.toBe(without.draws);
  });
});

describe("benchmark — officiating tally (how bouts ended + jogai fouls)", () => {
  // A supplementary aggregate on the result, alongside the ranking figures: how every
  // bout ended (by `endReason`) and how many jogai ring-outs the SUBMITTED bot committed
  // vs. its opponents. It never touches the ranking keys (win-rate / net-points), so it
  // is inert to scoring — a pure read-out for the CLI report.

  it("tallies every bout under endReason.time and reports zero fouls when no match mode is set", () => {
    // No match ⇒ every one of the 8 fights runs to the tick cap ⇒ all "time"; no jogai
    // margin ⇒ no ring-outs. The FULL object is asserted so the per-reason initial values
    // (incl. the never-hit gap/senshu/overtime buckets) are pinned to 0.
    const result = benchmark(config());

    expect(result.officiating.endedBy).toEqual({
      gap: 0,
      time: 8,
      senshu: 0,
      overtime: 0,
    });
    expect(result.officiating.jogai).toEqual({ bot: 0, opp: 0 });
    expect(result.officiating.passivity).toEqual({ bot: 0, opp: 0 });
  });

  it("counts gap-ended bouts under endReason.gap when match mode ends on the win gap", () => {
    // 1 seed × 2 sides vs the idle LOSER; each fight ends the instant the bot leads by 8.
    const result = benchmark(
      config({
        gauntlet: [LOSER],
        seeds: [1],
        maxTicks: 300,
        match: { winGap: 8 },
      }),
    );

    expect(result.officiating.endedBy).toEqual({
      gap: 2,
      time: 0,
      senshu: 0,
      overtime: 0,
    });
  });

  it("counts senshu-decided level bouts under endReason.senshu", () => {
    // The SOLO-first-blood, level-at-cap matchup from the senshu block: SCORER holds
    // senshu on both sides ⇒ each bout is decided by first blood at the cap.
    const result = benchmark({
      bot: SCORER,
      gauntlet: [DELAYED],
      seeds: [1],
      maxTicks: 120,
      rules: MOCK_RULES,
      match: { winGap: 8, senshu: true },
    });

    expect(result.officiating.endedBy).toEqual({
      gap: 0,
      time: 0,
      senshu: 2,
      overtime: 0,
    });
  });

  it("attributes jogai ring-outs to the bot vs the opponent, not to raw fighter A/B", () => {
    // The bot RETREATS into its own out-zone on BOTH sides (low edge as A, high edge as B),
    // ringing out twice per side (ticks ~25 and ~51, the re-arm case) = 4 total; the idle
    // opponent never rings out. A raw fouls.a / fouls.b aggregate would mis-split these,
    // because the bot occupies slot A in one fight and slot B in the other.
    const result = benchmark(
      config({
        bot: RETREATER,
        gauntlet: [LOSER],
        seeds: [1],
        maxTicks: 55,
        match: { winGap: 99, jogai: { margin: 100000 } },
      }),
    );

    expect(result.officiating.jogai).toEqual({ bot: 4, opp: 0 });
    // The 99-gap is never reached (the free-then-1pt ladder only nudges the gap to 1),
    // so both bouts still run to time.
    expect(result.officiating.endedBy).toEqual({
      gap: 0,
      time: 2,
      senshu: 0,
      overtime: 0,
    });
  });

  it("attributes the OPPONENT's ring-outs to opp, not bot (the mirror split)", () => {
    // Mirror of the previous fixture: now the idle bot never rings out and the RETREATING
    // gauntlet member backs itself out twice per side (= 4). Pins the opponent accumulator
    // independently — a fixture where the opponent never fouls cannot distinguish it.
    const result = benchmark(
      config({
        bot: LOSER,
        gauntlet: [RETREATER],
        seeds: [1],
        maxTicks: 55,
        match: { winGap: 99, jogai: { margin: 100000 } },
      }),
    );

    expect(result.officiating.jogai).toEqual({ bot: 0, opp: 4 });
  });

  it("attributes passivity fouls to the bot vs the opponent, not to raw fighter A/B", () => {
    // The bot IDLES on BOTH sides (fighter A in one fight, B in the other) ⇒ its no-offense
    // clock climbs past the limit and it is fouled 9× per side = 18; the always-attacking
    // opponent resets its own clock on every landed hit ⇒ never passive. A raw fouls.a / fouls.b
    // aggregate would mis-split these, because the bot occupies slot A in one fight and B in the
    // other — exactly the bot-centric attribution the jogai split above proves for ring-outs.
    const result = benchmark(
      config({
        bot: LOSER,
        gauntlet: [SUBMITTED],
        seeds: [1],
        maxTicks: 55,
        match: { winGap: 99, passivity: { limit: 5 } },
      }),
    );

    expect(result.officiating.passivity).toEqual({ bot: 18, opp: 0 });
    // The 99-gap is never reached (the free-then-1pt ladder never nears it), so both bouts
    // still run to time.
    expect(result.officiating.endedBy).toEqual({
      gap: 0,
      time: 2,
      senshu: 0,
      overtime: 0,
    });
  });

  it("attributes the OPPONENT's passivity fouls to opp, not bot (the mirror split)", () => {
    // Mirror of the previous fixture: now the always-attacking bot never goes passive and the
    // IDLE gauntlet member is fouled 9× per side (= 18). Pins the opponent accumulator
    // independently — a fixture where the opponent never fouls cannot distinguish it (the exact
    // `+`→`-` survivor the jogai opp accumulator hit).
    const result = benchmark(
      config({
        bot: SUBMITTED,
        gauntlet: [LOSER],
        seeds: [1],
        maxTicks: 55,
        match: { winGap: 99, passivity: { limit: 5 } },
      }),
    );

    expect(result.officiating.passivity).toEqual({ bot: 0, opp: 18 });
  });
});

describe("benchmark — per-opponent endReasons (how each matchup ended)", () => {
  // A per-member breakdown of the global `officiating.endedBy`: the same bucketing,
  // but keyed to each opponent so the author learns HOW a given matchup ended, not
  // just the aggregate. A mixed gauntlet ends different matchups by different reasons.
  const mixed = () =>
    benchmark(
      config({
        gauntlet: [LOSER, TRADER],
        seeds: [1],
        maxTicks: 300,
        match: { winGap: 8 },
      }),
    );

  it("buckets each opponent's bouts by endReason — a mixed gauntlet gets its own per-opponent map", () => {
    // vs the idle LOSER the bot reaches the +8 gap ⇒ both bouts end by "gap"; vs the
    // symmetric TRADER the score stays level (no perception ⇒ swap-symmetric) ⇒ both
    // run to the cap = "time". The maps differ per opponent — a shared global tally
    // (or a fixed-bucket mutant) could not produce both.
    const result = mixed();

    expect(result.perOpponent[0].endReasons).toEqual({
      gap: 2,
      time: 0,
      senshu: 0,
      overtime: 0,
    });
    expect(result.perOpponent[1].endReasons).toEqual({
      gap: 0,
      time: 2,
      senshu: 0,
      overtime: 0,
    });
  });

  it("keeps each opponent's endReasons summing to its fights, and Σ equal to the global endedBy", () => {
    // The two invariants that pin the tally against init / increment / mis-bucket mutants:
    // every member's reasons account for exactly its fights, and the per-member split
    // re-aggregates to the independently-computed global `endedBy` (no double-count, no drop).
    const result = mixed();

    for (const o of result.perOpponent) {
      const total = Object.values(o.endReasons).reduce((a, b) => a + b, 0);

      expect(total).toBe(o.fights);
    }

    const summed = result.perOpponent.reduce(
      (acc, o) => ({
        gap: acc.gap + o.endReasons.gap,
        time: acc.time + o.endReasons.time,
        senshu: acc.senshu + o.endReasons.senshu,
        overtime: acc.overtime + o.endReasons.overtime,
      }),
      { gap: 0, time: 0, senshu: 0, overtime: 0 },
    );

    expect(summed).toEqual(result.officiating.endedBy);
  });
});

describe("benchmark — degrade diagnostics (why the submitted bot's actions failed)", () => {
  // A single aggregate over both sides × seeds × opponents: how many of the SUBMITTED
  // bot's frames degraded, split by reason. The opponent's degradation is never counted
  // (visibility principle) — the author only sees its OWN failures.
  const noDegrade = {
    unaffordable: 0,
    "out-of-band": 0,
    locked: 0,
    inert: 0,
    "wrong-context": 0,
  };

  it("counts the submitted bot's degraded frames across BOTH sides", () => {
    // INERT_BOT attacks an unconfigured move ⇒ every one of its frames degrades to `inert`,
    // whether it fights as A or as B. The idle LOSER never degrades, so only `inert` accrues.
    const result = benchmark(
      config({ bot: INERT_BOT, gauntlet: [LOSER], seeds: [1] }),
    );

    expect(result.degrade.inert).toBeGreaterThan(0);
    expect(result.degrade).toEqual({
      ...noDegrade,
      inert: result.degrade.inert,
    });
  });

  it("never counts the OPPONENT's degraded frames (the mirror — only the bot's own)", () => {
    // Now the bot IDLES (LOSER ⇒ null every frame) and the OPPONENT is the inert one.
    // A tally that read the opponent's side (or aggregated both fighters) would show
    // inert > 0; the correct bot-only tally is all zeros.
    const result = benchmark(
      config({ bot: LOSER, gauntlet: [INERT_BOT], seeds: [1] }),
    );

    expect(result.degrade).toEqual(noDegrade);
  });

  it("attributes the actual degrade reason, not a fixed bucket", () => {
    // SUBMITTED attacks a CONFIGURED move ⇒ it commits, then its re-attacks during the
    // commit frames degrade to `locked` (not inert). Pins the reason key to the real cause.
    const result = benchmark(
      config({ bot: SUBMITTED, gauntlet: [LOSER], seeds: [1] }),
    );

    expect(result.degrade.locked).toBeGreaterThan(0);
    expect(result.degrade.inert).toBe(0);
  });
});
