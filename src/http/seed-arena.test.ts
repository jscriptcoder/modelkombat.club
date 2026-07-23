import { describe, expect, it } from "vitest";

import { loadGauntlet } from "./gauntlet.js";
import {
  buildSeedArena,
  readArenaOrSeed,
  SEED_HANDLE,
  SEED_MODEL,
  SEED_ORDER,
} from "./seed-arena.js";
import { inMemoryThroneStore, type ArenaRecord } from "./throne-store.js";
import { benchmark } from "../engine/benchmark.js";
import {
  GAUNTLET_NAMES,
  MATCH,
  MAX_TICKS,
  SEEDS,
} from "../engine/benchmark-config.js";
import { CANONICAL_RULES } from "../engine/rules.js";
import type { BotDoc } from "../engine/dsl.js";

// ── The House-seed determinism lock. `SEED_ARENA` (materialized by `buildSeedArena` from the
// frozen roster) must NOT be an arbitrary hardcode: the pin test below RE-DERIVES the strongest
// three and their arena order from the real deterministic `benchmark`, and fails the build if the
// pinned `SEED_ORDER` ever diverges (a roster/rules change that reorders the strongest bots). The
// seed itself does no runtime fights (D5) — `buildSeedArena` is a pure pick-and-order over the
// pinned constant; only this TEST runs the fights that certify the constant.

const roster = loadGauntlet();

const rosterBot = (name: string): BotDoc => {
  const bot = roster.find((b) => b.name === name);
  if (!bot) throw new Error(`${name} not in the frozen roster`);

  return bot;
};

// Win-rate of one bot vs the full roster (no-mirror drops the self-match) — the SELECTION metric
// (D4: "strongest" = top-3 by round-robin win-rate). Mirrors `gauntlet-calibration.test.ts`.
const winRateVsRoster = (bot: BotDoc): number =>
  benchmark({
    bot,
    gauntlet: roster,
    seeds: SEEDS,
    maxTicks: MAX_TICKS,
    rules: CANONICAL_RULES,
    match: MATCH,
  }).winRate;

// The three strongest bot NAMES by `winRateVsRoster`, ties broken by `GAUNTLET_NAMES` order.
const strongestThree = (): string[] =>
  [...roster]
    .map((bot) => ({ name: bot.name, wr: winRateVsRoster(bot) }))
    .sort(
      (a, b) =>
        b.wr - a.wr ||
        GAUNTLET_NAMES.indexOf(a.name) - GAUNTLET_NAMES.indexOf(b.name),
    )
    .slice(0, 3)
    .map((r) => r.name);

// Rank the trio by the ARENA'S order: Copeland wins among the three (each pair fought once, a
// win = win-rate > 0.5), then Σ net-points — the `rank-arena` `byRank` total order minus the
// seniority tiebreak (which is what we ASSIGN from this order, and which a strict order never needs).
const trioRankOrder = (names: readonly string[]): string[] => {
  const bots = names.map(rosterBot);

  const standing = (
    bot: BotDoc,
  ): { name: string; wins: number; net: number } => {
    const others = bots.filter((b) => b.name !== bot.name);

    const r = benchmark({
      bot,
      gauntlet: others,
      seeds: SEEDS,
      maxTicks: MAX_TICKS,
      rules: CANONICAL_RULES,
      match: MATCH,
    });

    return {
      name: bot.name,
      // A Copeland win over one opponent: strictly more than half its bouts won (wins/fights > 0.5),
      // integer-exact as 2·wins > fights — the same `> 0.5` rule `arena-standings`' `beat` applies.
      wins: r.perOpponent.filter((o) => 2 * o.wins > o.fights).length,
      net: r.netPoints,
    };
  };

  return bots
    .map(standing)
    .sort((a, b) => b.wins - a.wins || b.net - a.net)
    .map((s) => s.name);
};

describe("SEED_ARENA — the pinned House seed (deterministic, no runtime fights)", () => {
  it("SEED_ORDER is the three strongest bots, in the arena round-robin order", () => {
    const strongest = strongestThree();

    // Same membership as the computed strongest three...
    expect([...SEED_ORDER].sort()).toEqual([...strongest].sort());
    // ...and the pinned King/#2/#3 order equals the trio's arena ranking.
    expect([...SEED_ORDER]).toEqual(trioRankOrder(strongest));
  });

  it("buildSeedArena orders by SEED_ORDER, stamps seniority 1/2/3, gen 1, nextSeniority 4", () => {
    const seed = buildSeedArena(roster);

    expect(seed.members.map((m) => m.champion.name)).toEqual([...SEED_ORDER]);
    expect(seed.members.map((m) => m.seniority)).toEqual([1, 2, 3]);
    expect(seed.generation).toBe(1);
    expect(seed.nextSeniority).toBe(4);
  });

  it("credits every House member handle 'Gauntlet' + model 'House'", () => {
    const seed = buildSeedArena(roster);

    expect(SEED_HANDLE).toBe("Gauntlet");
    expect(SEED_MODEL).toBe("House");
    seed.members.forEach((member) => {
      expect(member.handle).toBe(SEED_HANDLE);
      expect(member.champion.model).toBe(SEED_MODEL);
    });
  });

  it("carries each House champion's real fightable rules (the seed can be contested)", () => {
    const seed = buildSeedArena(roster);

    seed.members.forEach((member) => {
      expect(member.champion.rules.length).toBeGreaterThan(0);
    });
    // The King slot is the strongest bot's actual document (name preserved from the roster).
    expect(seed.members[0].champion.name).toBe(SEED_ORDER[0]);
  });

  it("throws, naming the missing bot, if a pinned seed bot is absent from the gauntlet", () => {
    const withoutGrappler = roster.filter((bot) => bot.name !== SEED_ORDER[0]);

    expect(() => buildSeedArena(withoutGrappler)).toThrow(/grappler/);
  });
});

describe("readArenaOrSeed — an empty store resolves to the seed", () => {
  const seed = (): ArenaRecord => buildSeedArena(roster);

  it("returns the seed when the version has no stored arena", async () => {
    const store = inMemoryThroneStore();

    const arena = await readArenaOrSeed(store, "v-empty", seed());

    expect(arena?.members.map((m) => m.champion.name)).toEqual([...SEED_ORDER]);
  });

  it("returns the STORED arena, not the seed, when one exists", async () => {
    const store = inMemoryThroneStore();

    const real: ArenaRecord = {
      members: [
        { champion: rosterBot("zoner"), handle: "human", seniority: 7 },
      ],
      generation: 5,
      nextSeniority: 8,
    };

    await store.commitArena("v1", null, real);

    const arena = await readArenaOrSeed(store, "v1", seed());

    expect(arena?.members.map((m) => m.champion.name)).toEqual(["zoner"]);
    expect(arena?.generation).toBe(5);
  });

  it("returns undefined when the store is empty and no seed is supplied", async () => {
    const store = inMemoryThroneStore();

    expect(await readArenaOrSeed(store, "v-empty")).toBeUndefined();
  });
});
