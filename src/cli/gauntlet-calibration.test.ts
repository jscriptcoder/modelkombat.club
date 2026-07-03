import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { benchmark } from "../engine/benchmark.js";
import {
  GAUNTLET_NAMES,
  MATCH,
  MAX_TICKS,
  SEEDS,
} from "../engine/benchmark-config.js";
import { CANONICAL_RULES } from "../engine/rules.js";
import type { Action } from "../engine/types.js";
import type { BotDoc } from "../engine/dsl.js";
import { loadBotDoc } from "./load.js";

// ── The gauntlet calibration lock (S4) — the CI guard that certifies the modernized
// gauntlet stays a calibrated, arsenal-representative measuring instrument. Two
// regression invariants, each failing the build the moment a future bot/rules change
// breaks it:
//   1. BAND — every member's round-robin win-rate sits inside the confirmed [25%, 75%]
//      dispersion band (membership, NOT exact numbers — the coupled round-robin can't be
//      precision-dialed, so acceptance is band-membership).
//   2. COVERAGE — every CANONICAL_RULES.moves technique is referenced by some member, so
//      an LLM-authored bot's score is tested across the full strategic space.
// Both hold as of v14 (S1–S3), so the guards are GREEN on the real roster. To prove they
// are not vacuous theatre, each ships with a companion test showing it FAILS on a
// deliberate violation (a fabricated pushover / a roster missing a move).

// The confirmed calibration band, as win-rate fractions. Outside [25%, 75%] a member is
// either an exploitable pushover or an untested wall — an un-calibrated rung.
const BAND_MIN = 0.25;
const BAND_MAX = 0.75;

const botText = (name: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../../bots/${name}.json`, import.meta.url)),
    "utf8",
  );

const roster: BotDoc[] = GAUNTLET_NAMES.map((name) =>
  loadBotDoc(botText(name)),
);

// The techniques a bot can emit: every `attack` action's move, plus the `sweep` action
// (its own tag, mapping to the moves.sweep spec). The walk action `{type:"move"}`, throw,
// throw-break, block, etc. are NOT `moves` keys, so they contribute nothing here.
const movesReferencedBy = (bot: BotDoc): string[] => {
  const actions: Action[] = [
    ...bot.rules.flatMap((rule) => (rule.do ? [rule.do] : [])),
    bot.default,
  ];

  return actions.flatMap((action) => {
    if (action.type === "attack") return [action.move];
    if (action.type === "sweep") return ["sweep"];

    return [];
  });
};

// Round-robin win-rate of one bot vs the full roster (the no-mirror rule drops the
// self-match ⇒ 5 opponents × 10 seeds × 2 sides = 100 fights).
const winRateVsRoster = (bot: BotDoc): number =>
  benchmark({
    bot,
    gauntlet: roster,
    seeds: SEEDS,
    maxTicks: MAX_TICKS,
    rules: CANONICAL_RULES,
    match: MATCH,
  }).winRate;

describe("gauntlet calibration lock — the certified measuring instrument", () => {
  describe("band: every member wins within [25%, 75%] of the round-robin", () => {
    for (const member of roster) {
      it(`${member.name} sits inside the calibration band`, () => {
        const winRate = winRateVsRoster(member);
        expect(winRate).toBeGreaterThanOrEqual(BAND_MIN);
        expect(winRate).toBeLessThanOrEqual(BAND_MAX);
      });
    }

    it("would reject a member that cannot hold the band (the guard bites)", () => {
      // A do-nothing bot loses ~every fight (and every senshu tie, never scoring first),
      // so its win-rate falls below BAND_MIN — proving the band assertion is not vacuous.
      const pushover: BotDoc = {
        version: 1,
        name: "pushover",
        rules: [],
        default: { type: "idle" },
      };

      expect(winRateVsRoster(pushover)).toBeLessThan(BAND_MIN);
    });
  });

  describe("coverage: the roster exercises the full arsenal", () => {
    const arsenal = Object.keys(CANONICAL_RULES.moves);

    it("references every CANONICAL_RULES.moves technique (11/11)", () => {
      const covered = new Set(roster.flatMap(movesReferencedBy));
      const uncovered = arsenal.filter((move) => !covered.has(move));

      expect(uncovered).toEqual([]);
    });

    it("would flag an unreferenced technique (the guard bites)", () => {
      // Drop grappler — the sole home of empi + hiza-geri — and those two go uncovered,
      // proving the coverage assertion is not vacuous.
      const withoutGrappler = roster.filter((bot) => bot.name !== "grappler");
      const covered = new Set(withoutGrappler.flatMap(movesReferencedBy));
      const uncovered = arsenal.filter((move) => !covered.has(move));

      expect(uncovered).toContain("empi");
      expect(uncovered).toContain("hiza-geri");
    });
  });
});
