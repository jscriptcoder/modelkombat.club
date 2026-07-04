import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { benchmark } from "../engine/benchmark.js";
import { runFight } from "../engine/sim.js";
import {
  GAUNTLET_NAMES,
  MATCH,
  MAX_TICKS,
  SEEDS,
} from "../engine/benchmark-config.js";
import { CANONICAL_RULES } from "../engine/rules.js";
import type { Action } from "../engine/types.js";
import type { BotDoc, BoolExpr, NumExpr } from "../engine/dsl.js";
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

// ── The jogai-adoption lock (item 3 / v15) — certifies the officiating mechanic is
// EXERCISED on the frozen board, not merely enabled. Two invariants, mirroring the
// "exercised = fires + field-read" contract (decision 3):
//   1. FIRES — some board bout is DECIDED by a jogai foul: a fighter rings out ≥2×
//      (the shared category-2 ladder's 1st foul is free, so ≥2 confers ≥1 point) and
//      that point flips the winner vs the identical fight with jogai OFF.
//   2. FIELD-READ — the zoner (the ring-aware carrier) references `self.x` against a
//      constant in the near-edge zone — a boundary decision, not generic mid-ring
//      spacing (a bare / mid-ring `self.x` reference is explicitly insufficient).
// Each ships with a companion proving it is not vacuous theatre.

const rosterBot = (name: string): BotDoc => {
  const bot = roster.find((b) => b.name === name);
  if (!bot) throw new Error(`${name} not in the frozen roster`);

  return bot;
};

// The same v16 rules with jogai turned OFF but passivity still ON — the counterfactual for
// "the jogai point decided it". Keeping passivity on (once MATCH carries it) is essential:
// the ONLY change vs MATCH is the jogai key, so the winner-flip isolates jogai's causal point
// under the shared/pooled ladder rather than conflating it with passivity.
const MATCH_NO_JOGAI = {
  winGap: MATCH.winGap,
  senshu: MATCH.senshu,
  passivity: MATCH.passivity,
};

type JogaiFire = { fouler: string; beneficiary: string; seed: number };

// Every board bout whose winner a jogai foul decides: a fighter rings out ≥2× (so the
// ladder confers ≥1 point) AND the winner differs from the jogai-OFF run of the same
// (bots × seed × side) fight.
const decisiveJogaiFires = (): JogaiFire[] => {
  const fires: JogaiFire[] = [];

  for (const a of roster) {
    for (const b of roster) {
      if (a.name === b.name) continue;

      for (const seed of SEEDS) {
        const cfg = {
          rules: CANONICAL_RULES,
          botA: a,
          botB: b,
          maxTicks: MAX_TICKS,
          seed,
        };

        const on = runFight({ ...cfg, match: MATCH });
        const aConfers = on.fouls.a.jogai >= 2;
        const bConfers = on.fouls.b.jogai >= 2;
        if (!aConfers && !bConfers) continue;

        const off = runFight({ ...cfg, match: MATCH_NO_JOGAI });
        if (off.winner === on.winner) continue;

        if (aConfers) fires.push({ fouler: a.name, beneficiary: b.name, seed });
        if (bConfers) fires.push({ fouler: b.name, beneficiary: a.name, seed });
      }
    }
  }

  return fires;
};

// Every constant the bot's CONDITIONS compare `self.x` against — the condition-AST
// analog of `movesReferencedBy`'s action-AST walk. Walks the BoolExpr tree, recording
// the other operand of any comparison whose one side is exactly `field self.x`.
const selfXConstants = (bot: BotDoc): number[] => {
  const found: number[] = [];

  const isSelfX = (e: NumExpr): boolean =>
    e.op === "field" && e.path === "self.x";

  const constOf = (e: NumExpr): number | undefined =>
    e.op === "const" ? e.value : undefined;

  const record = (a: NumExpr, b: NumExpr): void => {
    if (isSelfX(a)) {
      const v = constOf(b);
      if (v !== undefined) found.push(v);
    }

    if (isSelfX(b)) {
      const v = constOf(a);
      if (v !== undefined) found.push(v);
    }
  };

  const walk = (node: BoolExpr): void => {
    switch (node.op) {
      case "gt":
      case "lt":
      case "gte":
      case "lte":
      case "eq":
      case "neq":
        record(node.args[0], node.args[1]);

        return;
      case "and":
      case "or":
        node.args.forEach(walk);

        return;
      case "not":
        walk(node.arg);

        return;
    }
  };

  for (const rule of bot.rules) walk(rule.when);

  return found;
};

// The near-edge zone: a constant within EDGE_DELTA of either legal margin. Sourced
// from the manifest + frame table (never hardcoded) so a margin/ring retune moves it.
const MARGIN = MATCH.jogai.margin;
const WIDTH = CANONICAL_RULES.ring.width;
const EDGE_DELTA = 50000;

const isNearEdge = (x: number): boolean =>
  (x >= MARGIN && x <= MARGIN + EDGE_DELTA) ||
  (x >= WIDTH - MARGIN - EDGE_DELTA && x <= WIDTH - MARGIN);

describe("jogai adoption lock — exercised on the v15 board (fires + field-read)", () => {
  describe("fires: a jogai foul decides a bout", () => {
    it("some board bout is won on a ≥2-ring-out penalty point (a jogai-off flip)", () => {
      const fires = decisiveJogaiFires();

      expect(fires.length).toBeGreaterThan(0);
      // WKF-faithful: the naive sweeper rings ITSELF out, handing the bout it could
      // never score in to the patient vulture.
      expect(
        fires.every(
          (f) => f.fouler === "sweeper" && f.beneficiary === "vulture",
        ),
      ).toBe(true);
    });

    it("would find nothing without the mechanic (the guard bites)", () => {
      // Same roster, jogai OFF ⇒ the ring-out foul cannot occur at all, so there is no
      // jogai point to decide anything — proving the fires guard keys off the jogai
      // mechanic and is not vacuously true.
      let totalJogaiFouls = 0;

      for (const a of roster) {
        for (const b of roster) {
          if (a.name === b.name) continue;

          for (const seed of SEEDS) {
            const r = runFight({
              rules: CANONICAL_RULES,
              botA: a,
              botB: b,
              maxTicks: MAX_TICKS,
              seed,
              match: MATCH_NO_JOGAI,
            });

            totalJogaiFouls += r.fouls.a.jogai + r.fouls.b.jogai;
          }
        }
      }

      expect(totalJogaiFouls).toBe(0);
    });
  });

  describe("field-read: the zoner makes a boundary decision on self.x", () => {
    it("references self.x against a near-margin constant (not generic mid-ring spacing)", () => {
      const nearEdge = selfXConstants(rosterBot("zoner")).filter(isNearEdge);

      expect(nearEdge.length).toBeGreaterThan(0);
    });

    it("would not count a bare / mid-ring self.x comparison (the guard bites)", () => {
      // A bot that references self.x ONLY at dead-center — a generic spacing read, not a
      // boundary decision — must NOT satisfy the field-read guard.
      const midRing: BotDoc = {
        version: 1,
        name: "mid-ring",
        rules: [
          {
            when: {
              op: "gt",
              args: [
                { op: "field", path: "self.x" },
                { op: "const", value: 300000 },
              ],
            },
            do: { type: "idle" },
          },
        ],
        default: { type: "idle" },
      };

      expect(selfXConstants(midRing)).toContain(300000); // it DOES reference self.x…
      expect(selfXConstants(midRing).filter(isNearEdge)).toEqual([]); // …but 300000 is mid-ring
    });

    // Pin the near-edge predicate's boundaries directly (it is test-local, so its
    // correctness is characterised by a directional matrix, not a mutation score).
    it.each<[number, boolean, string]>([
      [MARGIN, true, "exactly the low margin"],
      [MARGIN + EDGE_DELTA, true, "low near-edge outer bound (inclusive)"],
      [MARGIN + EDGE_DELTA + 1, false, "just past the low near-edge band"],
      [WIDTH - MARGIN, true, "exactly the high margin"],
      [
        WIDTH - MARGIN - EDGE_DELTA,
        true,
        "high near-edge inner bound (inclusive)",
      ],
      [
        WIDTH - MARGIN - EDGE_DELTA - 1,
        false,
        "just short of the high near-edge band",
      ],
      [WIDTH / 2, false, "dead-center mid-ring"],
    ])("isNearEdge(%i) === %s — %s", (x, expected) => {
      expect(isNearEdge(x)).toBe(expected);
    });
  });
});

// ── The passivity-adoption lock (item 3 / v16) — certifies the non-engagement mechanic is
// EXERCISED on the frozen board, not merely enabled. Two invariants, mirroring the jogai
// lock's "exercised = fires + field-read" contract (decision 3):
//   1. EXERCISED — some board bout has a real bot commit ≥2 passivity fouls, so the shared
//      category-2 ladder CONFERS a penalty point (1st foul free, 2nd confers) on the frozen
//      roster. This is the RELAXED fire (decision 3, passivity): a _decisive_ winner-flip is
//      structurally infeasible on the all-aggressive roster — a bout stalled ~480 ticks (two
//      240-tick fouls) loses on points regardless, so the foul is never the decider. That a
//      conferred passivity point AWARDS the opponent +1 and can decide scoring is proven by the
//      built Capability-B engine unit tests; this lock proves the board exercises the mechanic
//      (the move-coverage analog: coverage proves the board uses a technique, unit tests prove
//      its scoring).
//   2. FIELD-READ — the jabber (the carrier) references `self.passivityRemaining` in a
//      condition — the direct dedicated-path analog of `movesReferencedBy` (jogai had no field,
//      so it settled for a `self.x`-vs-edge boundary read).
// Each ships with a companion proving it is not vacuous theatre.

// The same v16 MATCH with passivity turned OFF (jogai + senshu still on) — the counterfactual
// proving the exercised guard keys off the passivity mechanic (no passivity ⇒ zero such fouls).
const MATCH_NO_PASSIVITY = {
  winGap: MATCH.winGap,
  senshu: MATCH.senshu,
  jogai: MATCH.jogai,
};

type MatchCfg = Parameters<typeof runFight>[0]["match"];

// The most passivity fouls any single fighter commits in any one board bout, and who — a foul
// count ≥2 means the shared ladder conferred a penalty point somewhere on the frozen roster.
const maxPassivityFoulsInABout = (
  match: MatchCfg,
): { fouls: number; who: string } => {
  let fouls = 0;
  let who = "";

  const consider = (n: number, name: string): void => {
    if (n > fouls) {
      fouls = n;
      who = name;
    }
  };

  for (const a of roster) {
    for (const b of roster) {
      if (a.name === b.name) continue;

      for (const seed of SEEDS) {
        const r = runFight({
          rules: CANONICAL_RULES,
          botA: a,
          botB: b,
          maxTicks: MAX_TICKS,
          seed,
          match,
        });

        consider(r.fouls.a.passivity, a.name);
        consider(r.fouls.b.passivity, b.name);
      }
    }
  }

  return { fouls, who };
};

// Whether a bot references `self.passivityRemaining` anywhere in its CONDITIONS — the
// dedicated-path field-read walk (the BoolExpr analog of `selfXConstants`, but a presence
// check: the field IS the meaningful surface, no constant band to classify).
const readsPassivityRemaining = (bot: BotDoc): boolean => {
  const isPassivityField = (e: NumExpr): boolean =>
    e.op === "field" && e.path === "self.passivityRemaining";

  const walk = (node: BoolExpr): boolean => {
    switch (node.op) {
      case "gt":
      case "lt":
      case "gte":
      case "lte":
      case "eq":
      case "neq":
        return isPassivityField(node.args[0]) || isPassivityField(node.args[1]);
      case "and":
      case "or":
        return node.args.some(walk);
      case "not":
        return walk(node.arg);
    }
  };

  return bot.rules.some((rule) => walk(rule.when));
};

describe("passivity adoption lock — exercised on the v16 board (exercised + field-read)", () => {
  describe("exercised: a passivity penalty point is conferred on the board", () => {
    it("some board bout has a real bot commit ≥2 passivity fouls (a conferred point)", () => {
      const { fouls, who } = maxPassivityFoulsInABout(MATCH);

      expect(fouls).toBeGreaterThanOrEqual(2);
      // WKF-faithful: the shaped vulture over-turtles in a standoff and eats the fouls, while
      // the jabber (carrier) reads self.passivityRemaining to avoid its own.
      expect(who).toBe("vulture");
    });

    it("would confer nothing without the mechanic (the guard bites)", () => {
      // Same roster, passivity OFF ⇒ the non-engagement foul cannot occur at all, so no bot
      // commits a single passivity foul — proving the exercised guard keys off the mechanic.
      expect(maxPassivityFoulsInABout(MATCH_NO_PASSIVITY).fouls).toBe(0);
    });
  });

  describe("field-read: the jabber reads self.passivityRemaining", () => {
    it("references self.passivityRemaining in a condition (the carrier avoids its own foul)", () => {
      expect(readsPassivityRemaining(rosterBot("jabber"))).toBe(true);
    });

    it("would not count a bot that reads only other fields (the guard bites)", () => {
      // A bot referencing a DIFFERENT self field (self.x) must NOT satisfy the passivity
      // field-read — proving the walk keys off the dedicated path, not any self read.
      const otherReader: BotDoc = {
        version: 1,
        name: "other-reader",
        rules: [
          {
            when: {
              op: "gt",
              args: [
                { op: "field", path: "self.x" },
                { op: "const", value: 300000 },
              ],
            },
            do: { type: "idle" },
          },
        ],
        default: { type: "idle" },
      };

      expect(readsPassivityRemaining(otherReader)).toBe(false);
    });
  });
});

// ── The overtime-adoption lock (item 3 / v17) — certifies the sudden-death mechanic FIRES on
// the frozen board, not merely enabled. Two invariants, mirroring the jogai/passivity locks'
// "fires + field-read" contract (decision 3):
//   1. FIRES — some board bout ends `endReason: "overtime"`: it was LEVEL at the regulation cap,
//      so one sudden-death period played and a 1-point gap opened. Unlike passivity (relaxed to
//      "exercised" because a decisive foul is structurally infeasible on the all-aggressive
//      roster), overtime is INHERENTLY decisive — it resolves an otherwise-level bout (measured:
//      7 such bouts, 4 flipping the winner vs senshu) — so the clean `endReason: "overtime"` fire
//      is the bar, no relaxation.
//   2. FIELD-READ — the jabber (the carrier) references `clock.overtime` in a condition — the
//      dedicated-path analog of `readsPassivityRemaining` (jabber MULTI-READS: its passivity
//      re-engage PLUS this sudden-death all-in).
// Each ships with a companion proving it is not vacuous theatre.

// The same v17 MATCH with overtime turned OFF (senshu + jogai + passivity still on) — the
// counterfactual proving the fires guard keys off the overtime mechanic (no overtime ⇒ a level
// bout falls straight through to the senshu fallback, never `endReason: "overtime"`).
const MATCH_NO_OVERTIME = {
  winGap: MATCH.winGap,
  senshu: MATCH.senshu,
  jogai: MATCH.jogai,
  passivity: MATCH.passivity,
};

// How many board bouts are decided in sudden death (`endReason: "overtime"`) under a given match
// config — the round-robin over every ordered pair × seed (both sides), like the jogai fires walk.
const overtimeFireCount = (match: MatchCfg): number => {
  let count = 0;

  for (const a of roster) {
    for (const b of roster) {
      if (a.name === b.name) continue;

      for (const seed of SEEDS) {
        const r = runFight({
          rules: CANONICAL_RULES,
          botA: a,
          botB: b,
          maxTicks: MAX_TICKS,
          seed,
          match,
        });

        if (r.endReason === "overtime") count++;
      }
    }
  }

  return count;
};

// Whether a bot references `clock.overtime` anywhere in its CONDITIONS — the dedicated-path
// field-read walk (the BoolExpr presence check, parallel to `readsPassivityRemaining`).
const readsClockOvertime = (bot: BotDoc): boolean => {
  const isOvertimeField = (e: NumExpr): boolean =>
    e.op === "field" && e.path === "clock.overtime";

  const walk = (node: BoolExpr): boolean => {
    switch (node.op) {
      case "gt":
      case "lt":
      case "gte":
      case "lte":
      case "eq":
      case "neq":
        return isOvertimeField(node.args[0]) || isOvertimeField(node.args[1]);
      case "and":
      case "or":
        return node.args.some(walk);
      case "not":
        return walk(node.arg);
    }
  };

  return bot.rules.some((rule) => walk(rule.when));
};

describe("overtime adoption lock — fires on the v17 board (fires + field-read)", () => {
  describe("fires: a level-at-cap bout is decided in sudden death", () => {
    it("some board bout ends `endReason: overtime` (a 1-point gap opens in sudden death)", () => {
      expect(overtimeFireCount(MATCH)).toBeGreaterThan(0);
    });

    it("would find no overtime without the mechanic (the guard bites)", () => {
      // Same roster, overtime OFF ⇒ a level-at-cap bout cannot enter sudden death at all, so no
      // bout ends `overtime` — proving the fires guard keys off the overtime mechanic.
      expect(overtimeFireCount(MATCH_NO_OVERTIME)).toBe(0);
    });
  });

  describe("field-read: the jabber reads clock.overtime", () => {
    it("references clock.overtime in a condition (the carrier goes all-in in sudden death)", () => {
      expect(readsClockOvertime(rosterBot("jabber"))).toBe(true);
    });

    it("would not count a bot that reads only other fields (the guard bites)", () => {
      // A bot referencing a DIFFERENT field (self.x) must NOT satisfy the overtime field-read —
      // proving the walk keys off the dedicated `clock.overtime` path, not any condition read.
      const otherReader: BotDoc = {
        version: 1,
        name: "other-reader",
        rules: [
          {
            when: {
              op: "gt",
              args: [
                { op: "field", path: "self.x" },
                { op: "const", value: 300000 },
              ],
            },
            do: { type: "idle" },
          },
        ],
        default: { type: "idle" },
      };

      expect(readsClockOvertime(otherReader)).toBe(false);
    });
  });
});
