import { describe, it, expect } from "vitest";
import {
  reduceOpeners,
  reducePerBot,
  reduceUsage,
  runVariety,
  type Matchup,
  type PooledReport,
  type Technique,
  type VarietyConfig,
} from "./telemetry.js";
import type {
  DegradeReason,
  FightEvent,
  FighterFrame,
  FightResult,
} from "./sim.js";
import type { Action, MoveId, Rules } from "./types.js";
import type { BotDoc } from "./dsl.js";

// ─── factories (real engine types, never redefined) ──────────────────────────
// A single fighter's per-tick frame: only `action` + `degrade` drive the usage
// tally, but the factory returns a COMPLETE FighterFrame so the fixture is valid.
const frame = (
  action: Action,
  degrade: DegradeReason | null = null,
): FighterFrame => ({ x: 0, y: 0, action, points: 0, stamina: 0, degrade });

const ev = (a: FighterFrame, b: FighterFrame): FightEvent => ({
  tick: 0,
  a,
  b,
});

// A complete FightResult carrying the given events; the non-event fields are inert
// to the reducer but present so the fixture is a real FightResult.
const fightOf = (events: FightEvent[]): FightResult => ({
  winner: "draw",
  ticks: events.length,
  scores: { a: 0, b: 0 },
  events,
  endReason: "time",
  fouls: { a: { jogai: 0, passivity: 0 }, b: { jogai: 0, passivity: 0 } },
});

const IDLE: Action = { type: "idle" };

const attack = (move: MoveId): Action => ({
  type: "attack",
  move,
  band: "mid",
});

const THROW: Action = { type: "throw" };
const SWEEP: Action = { type: "sweep" };

// The 13 canonical techniques in frame-table order (sweep, the 11 attacks, then
// throw) — the documented contract the report's rows and tie-break follow.
const CANONICAL: readonly Technique[] = [
  "sweep",
  "kizami-zuki",
  "gyaku-zuki",
  "mae-geri",
  "mawashi-geri",
  "uraken",
  "shuto",
  "yoko-geri",
  "ushiro-geri",
  "empi",
  "hiza-geri",
  "tobi-geri",
  "throw",
];

// The action that commits a given technique — lets a fixture exercise any technique
// by name (throw / sweep are their own actions; the rest are attacks).
const techniqueAction = (t: Technique): Action =>
  t === "throw" ? THROW : t === "sweep" ? SWEEP : attack(t);

// `n` honoured commitments of technique `t` (fighter A commits, fighter B idles).
const commits = (t: Technique, n: number): FightEvent[] =>
  Array.from({ length: n }, () => ev(frame(techniqueAction(t)), frame(IDLE)));

const rowFor = <R extends { technique: Technique }>(
  report: { rows: readonly R[] },
  t: Technique,
): R => {
  const found = report.rows.find((r) => r.technique === t);

  if (found === undefined) throw new Error(`no row for technique ${t}`);

  return found;
};

const shareSum = (report: PooledReport): number =>
  report.rows.reduce((sum, r) => sum + r.share, 0);

describe("reduceUsage — pooled honoured-commitment histogram", () => {
  it("counts each committed technique, pooling both fighters across all fights", () => {
    const report = reduceUsage([
      fightOf([
        ev(frame(attack("gyaku-zuki")), frame(THROW)),
        ev(frame(attack("gyaku-zuki")), frame(IDLE)),
      ]),
      fightOf([ev(frame(SWEEP), frame(attack("gyaku-zuki")))]),
    ]);

    expect(rowFor(report, "gyaku-zuki").count).toBe(3); // 2 on side a + 1 on side b
    expect(rowFor(report, "throw").count).toBe(1);
    expect(rowFor(report, "sweep").count).toBe(1);
    expect(report.totalCommitments).toBe(5);
  });

  it("reports totalFights = the number of fights reduced (the histogram's fight denominator)", () => {
    const report = reduceUsage([
      fightOf([ev(frame(attack("gyaku-zuki")), frame(IDLE))]),
      fightOf([ev(frame(SWEEP), frame(IDLE))]),
      fightOf([ev(frame(IDLE), frame(IDLE))]), // a fight with no commitments still counts
    ]);

    expect(report.totalFights).toBe(3);
  });

  it("headlines effective-move-count = exp(Shannon) of the pooled distribution — uniform ⇒ the live count", () => {
    // 3 distinct techniques, one honoured commitment each ⇒ uniform over 3 ⇒ exp(ln 3) = 3.
    const report = reduceUsage([
      fightOf([
        ev(frame(attack("gyaku-zuki")), frame(attack("mae-geri"))),
        ev(frame(SWEEP), frame(IDLE)),
      ]),
    ]);

    expect(report.effectiveMoves).toBeCloseTo(3, 6);
  });

  it("collapses effective-move-count to 1.0 when a single technique carries everything", () => {
    const report = reduceUsage([
      fightOf([ev(frame(attack("gyaku-zuki")), frame(attack("gyaku-zuki")))]),
    ]);

    expect(report.effectiveMoves).toBe(1);
  });

  it("weights effective-move-count by skew, not just the live count", () => {
    // gyaku 3, throw 1 ⇒ shares .75/.25 ⇒ exp(-(.75·ln.75 + .25·ln.25)) ≈ 1.7547.
    const report = reduceUsage([
      fightOf([
        ev(frame(attack("gyaku-zuki")), frame(attack("gyaku-zuki"))),
        ev(frame(attack("gyaku-zuki")), frame(THROW)),
      ]),
    ]);

    expect(report.effectiveMoves).toBeCloseTo(1.7547, 3);
  });

  it("reports effective-move-count as null (never NaN) when there are no commitments", () => {
    const report = reduceUsage([fightOf([ev(frame(IDLE), frame(IDLE))])]);

    expect(report.effectiveMoves).toBe(null);
  });

  it("counts a technique committed only by fighter B (not just fighter A)", () => {
    const report = reduceUsage([
      fightOf([ev(frame(IDLE), frame(attack("mae-geri")))]),
    ]);

    expect(rowFor(report, "mae-geri").count).toBe(1);
    expect(report.totalCommitments).toBe(1);
  });

  it("excludes a degraded commitment — only honoured frames count", () => {
    // fighter A throws a gyaku that DEGRADES (never took effect); fighter B lands a
    // clean throw. Honoured-only ⇒ gyaku 0, throw 1.
    const report = reduceUsage([
      fightOf([ev(frame(attack("gyaku-zuki"), "inert"), frame(THROW))]),
    ]);

    expect(rowFor(report, "gyaku-zuki").count).toBe(0);
    expect(rowFor(report, "throw").count).toBe(1);
    expect(report.totalCommitments).toBe(1);
  });

  it("ignores non-committing actions (idle / move / block / crouch / jump / throw-break)", () => {
    const report = reduceUsage([
      fightOf([
        ev(
          frame({ type: "move", dir: 1 }),
          frame({ type: "block", band: "high" }),
        ),
        ev(frame({ type: "crouch" }), frame({ type: "jump", dir: 0 })),
        ev(frame(IDLE), frame({ type: "throw-break" })),
      ]),
    ]);

    expect(report.totalCommitments).toBe(0);
    expect(shareSum(report)).toBe(0);
  });

  it("computes each share as count / totalCommitments; raw shares sum to 1.0", () => {
    // 3 gyaku + 1 throw ⇒ total 4 ⇒ shares 0.75 / 0.25 (exact binary fractions).
    const report = reduceUsage([
      fightOf([
        ev(frame(attack("gyaku-zuki")), frame(attack("gyaku-zuki"))),
        ev(frame(attack("gyaku-zuki")), frame(THROW)),
      ]),
    ]);

    expect(rowFor(report, "gyaku-zuki").share).toBe(0.75);
    expect(rowFor(report, "throw").share).toBe(0.25);
    expect(shareSum(report)).toBe(1);
  });

  it("always renders all 13 techniques — a never-committed one is 0 count / 0 share, never omitted", () => {
    const report = reduceUsage([
      fightOf([ev(frame(attack("gyaku-zuki")), frame(attack("gyaku-zuki")))]),
    ]);

    expect(report.rows).toHaveLength(13);
    expect(
      report.rows
        .map((r) => r.technique)
        .slice()
        .sort(),
    ).toEqual(CANONICAL.slice().sort());
    // ushiro-geri never fired ⇒ present but empty.
    expect(rowFor(report, "ushiro-geri").count).toBe(0);
    expect(rowFor(report, "ushiro-geri").share).toBe(0);
  });

  it("guards the zero-total case: every share is 0 (never NaN) and no technique is dominant", () => {
    const report = reduceUsage([fightOf([ev(frame(IDLE), frame(IDLE))])]);

    expect(report.totalCommitments).toBe(0);

    for (const r of report.rows) {
      expect(r.share).toBe(0);
      expect(Number.isNaN(r.share)).toBe(false);
      expect(r.dominant).toBe(false);
    }
  });

  it("does not flag a technique at EXACTLY the 0.35 share boundary", () => {
    // total 20 ⇒ 7/20 = 0.35 exactly for both gyaku and throw, 6/20 for sweep.
    const gyaku = Array.from({ length: 7 }, () =>
      ev(frame(attack("gyaku-zuki")), frame(IDLE)),
    );

    const thrown = Array.from({ length: 7 }, () =>
      ev(frame(THROW), frame(IDLE)),
    );

    const swept = Array.from({ length: 6 }, () =>
      ev(frame(SWEEP), frame(IDLE)),
    );

    const report = reduceUsage([fightOf([...gyaku, ...thrown, ...swept])]);

    expect(rowFor(report, "gyaku-zuki").share).toBe(0.35);
    expect(rowFor(report, "gyaku-zuki").dominant).toBe(false);
    expect(rowFor(report, "throw").dominant).toBe(false);
  });

  it("flags a technique whose raw share is strictly above 0.35 as dominant", () => {
    // total 20 ⇒ 8/20 = 0.40 for gyaku (dominant), 6/20 each for throw + sweep.
    const gyaku = Array.from({ length: 8 }, () =>
      ev(frame(attack("gyaku-zuki")), frame(IDLE)),
    );

    const thrown = Array.from({ length: 6 }, () =>
      ev(frame(THROW), frame(IDLE)),
    );

    const swept = Array.from({ length: 6 }, () =>
      ev(frame(SWEEP), frame(IDLE)),
    );

    const report = reduceUsage([fightOf([...gyaku, ...thrown, ...swept])]);

    expect(rowFor(report, "gyaku-zuki").share).toBe(0.4);
    expect(rowFor(report, "gyaku-zuki").dominant).toBe(true);
    expect(rowFor(report, "throw").dominant).toBe(false);
  });

  it("sorts rows by share descending, breaking ties by canonical frame-table order", () => {
    // sweep 2, gyaku 2 (tie at 0.4), mae-geri 1 (0.2); the rest 0. Among the tie,
    // sweep (canonical index 0) precedes gyaku (index 2); zero-count techniques
    // follow in canonical order.
    const report = reduceUsage([
      fightOf([
        ev(frame(SWEEP), frame(SWEEP)),
        ev(frame(attack("gyaku-zuki")), frame(attack("gyaku-zuki"))),
        ev(frame(attack("mae-geri")), frame(IDLE)),
      ]),
    ]);

    expect(report.rows.map((r) => r.technique)).toEqual([
      "sweep",
      "gyaku-zuki",
      "mae-geri",
      "kizami-zuki",
      "mawashi-geri",
      "uraken",
      "shuto",
      "yoko-geri",
      "ushiro-geri",
      "empi",
      "hiza-geri",
      "tobi-geri",
      "throw",
    ]);
  });

  it("breaks a lone share-tie by canonical order even when every other technique has a distinct share", () => {
    // 11 techniques get strictly-decreasing distinct counts; only tobi-geri and
    // throw tie (1 each). With a single clean tie (no zero-share ties to muddy the
    // sort), tobi-geri (canonical index 11) must precede throw (index 12).
    const ranked: [Technique, number][] = [
      ["gyaku-zuki", 12],
      ["mawashi-geri", 11],
      ["kizami-zuki", 10],
      ["sweep", 9],
      ["uraken", 8],
      ["shuto", 7],
      ["yoko-geri", 6],
      ["ushiro-geri", 5],
      ["empi", 4],
      ["hiza-geri", 3],
      ["mae-geri", 2],
      ["tobi-geri", 1],
      ["throw", 1],
    ];

    const report = reduceUsage([
      fightOf(ranked.flatMap(([t, n]) => commits(t, n))),
    ]);

    expect(report.rows.map((r) => r.technique)).toEqual([
      "gyaku-zuki",
      "mawashi-geri",
      "kizami-zuki",
      "sweep",
      "uraken",
      "shuto",
      "yoko-geri",
      "ushiro-geri",
      "empi",
      "hiza-geri",
      "mae-geri",
      "tobi-geri",
      "throw",
    ]);
  });
});

// ─── driver fixtures: MOCK rules WITHOUT perception ⇒ no PRNG draws ⇒ each fight is
// seed-independent AND deterministic (the benchmark.test.ts pattern). Two attack
// moves configured so distinct bots commit distinct techniques. ────────────────
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
    "mae-geri": { startup: 4, active: 2, recovery: 6, score: 2, reach: 250000 },
  },
};

const bot = (name: string, dflt: Action): BotDoc => ({
  version: 1,
  name,
  rules: [],
  default: dflt,
});

const GYAKU_BOT = bot("gyaku-bot", {
  type: "attack",
  move: "gyaku-zuki",
  band: "mid",
});

const MAE_BOT = bot("mae-bot", {
  type: "attack",
  move: "mae-geri",
  band: "mid",
});

const varietyConfig = (o: Partial<VarietyConfig> = {}): VarietyConfig => ({
  population: [GYAKU_BOT, MAE_BOT],
  seeds: [1, 2],
  maxTicks: 30,
  rules: MOCK_RULES,
  ...o,
});

describe("runVariety — round-robin over the population", () => {
  it("pools honoured commitments from every bot across the both-sides round-robin", () => {
    const report = runVariety(varietyConfig());

    expect(rowFor(report, "gyaku-zuki").count).toBeGreaterThan(0);
    expect(rowFor(report, "mae-geri").count).toBeGreaterThan(0);
    // exactly those two techniques fire — nothing else leaks into the tally.
    expect(report.totalCommitments).toBe(
      rowFor(report, "gyaku-zuki").count + rowFor(report, "mae-geri").count,
    );
  });

  it("counts every round-robin fight in totalFights (ordered distinct pairs × seeds)", () => {
    // 2 bots ⇒ 2 ordered pairs (A-vs-B, B-vs-A); × 2 seeds = 4 fights.
    const report = runVariety(varietyConfig());

    expect(report.totalFights).toBe(4);
  });

  it("is deterministic — the same config reduces to an identical report", () => {
    expect(runVariety(varietyConfig())).toEqual(runVariety(varietyConfig()));
  });

  it("carries opener win-rates + a null-opener count from the round-robin", () => {
    // both bots attack from the start ⇒ each opens with its move (gyaku / mae), nobody
    // turtles ⇒ the opener table lists all 13 techniques and no null openers.
    const report = runVariety(varietyConfig());

    expect(report.openers).toHaveLength(13);
    expect(
      rowFor({ rows: report.openers }, "gyaku-zuki").opens,
    ).toBeGreaterThan(0);
    expect(rowFor({ rows: report.openers }, "mae-geri").opens).toBeGreaterThan(
      0,
    );
    expect(report.nullOpeners).toBe(0);
  });

  it("attributes per-bot adoption (k/N) to each committing bot and sets botCount = population size", () => {
    // GYAKU_BOT only ever lands gyaku-zuki, MAE_BOT only mae-geri ⇒ each move is
    // adopted by exactly one of the two bots; every other technique by none.
    const report = runVariety(varietyConfig());

    expect(report.botCount).toBe(2);
    expect(rowFor(report, "gyaku-zuki").adoptingBots).toBe(1);
    expect(rowFor(report, "mae-geri").adoptingBots).toBe(1);
    expect(rowFor(report, "throw").adoptingBots).toBe(0);
  });

  it("reports each technique's mean per-bot share, weighting every bot equally", () => {
    // each bot spends 100% of its own honoured commitments on its one move ⇒ across the
    // two bots the mean share of gyaku-zuki (and of mae-geri) is (1.0 + 0) / 2 = 0.5; an
    // unused technique is 0 (not null — both bots participate).
    const report = runVariety(varietyConfig());

    expect(rowFor(report, "gyaku-zuki").meanShare).toBe(0.5);
    expect(rowFor(report, "mae-geri").meanShare).toBe(0.5);
    expect(rowFor(report, "throw").meanShare).toBe(0);
  });

  it("plays no bot against itself — a single-bot population yields no fights", () => {
    const report = runVariety(varietyConfig({ population: [GYAKU_BOT] }));

    expect(report.totalCommitments).toBe(0);
    // one bot, no fights ⇒ nobody adopts anything and there is no arsenal distribution.
    expect(report.botCount).toBe(1);
    expect(rowFor(report, "gyaku-zuki").adoptingBots).toBe(0);
    expect(rowFor(report, "gyaku-zuki").meanShare).toBe(null);
  });
});

// A byte-identical clone of GYAKU_BOT: a DISTINCT object with the same content, so the
// skip is driven by `sameDoc` (JSON equality), not object-reference identity.
const GYAKU_CLONE = bot("gyaku-bot", {
  type: "attack",
  move: "gyaku-zuki",
  band: "mid",
});

describe("runVariety — self-mirror skip (a byte-identical dup never fights its clone)", () => {
  it("drops only the clone-vs-clone pairings from the round-robin", () => {
    // [GYAKU, GYAKU-clone, MAE]: 3 bots ⇒ 6 ordered pairs × 2 seeds = 12 without the
    // skip; the two GYAKU↔clone mirror pairings drop ⇒ 4 pairs × 2 seeds = 8.
    const report = runVariety(
      varietyConfig({ population: [GYAKU_BOT, GYAKU_CLONE, MAE_BOT] }),
    );

    expect(report.totalFights).toBe(8);
  });

  it("still fights a duplicated bot against every NON-clone opponent", () => {
    // the clone must still meet MAE on both sides — so both techniques fire; only the
    // meaningless clone-vs-clone bout is skipped, not the dup's real matchups.
    const report = runVariety(
      varietyConfig({ population: [GYAKU_BOT, GYAKU_CLONE, MAE_BOT] }),
    );

    expect(rowFor(report, "gyaku-zuki").count).toBeGreaterThan(0);
    expect(rowFor(report, "mae-geri").count).toBeGreaterThan(0);
  });

  it("does not skip distinct bots — two different docs fight both sides", () => {
    // sanity guard on the OR's sameDoc operand: distinct docs (sameDoc false) keep every
    // pairing (2 ordered pairs × 2 seeds = 4), so a non-dup is never mistaken for a mirror.
    const report = runVariety(
      varietyConfig({ population: [GYAKU_BOT, MAE_BOT] }),
    );

    expect(report.totalFights).toBe(4);
  });
});

// ─── reducePerBot: the bot-identity attribution the pooled reduceUsage can't do.
// Fed synthetic matchups ({a, b, fight}) so a bot's side (A vs B) and its per-fight /
// per-tick repetition are precisely controllable — the only way to isolate the
// side-attribution and count-once behaviours a constant-default bot can't express. ──
const matchup = (a: number, b: number, events: FightEvent[]): Matchup => ({
  a,
  b,
  fight: fightOf(events),
});

describe("reducePerBot — per-bot adoption + mean share", () => {
  it("counts a bot once for adoption no matter how many times it honours the move", () => {
    // bot 0 lands gyaku-zuki 5× (all in one fight); bot 1 idles.
    const attribution = reducePerBot(
      [matchup(0, 1, commits("gyaku-zuki", 5))],
      2,
    );

    expect(attribution("gyaku-zuki").adoptingBots).toBe(1);
  });

  it("credits both fighters — a technique only side B commits still counts its bot", () => {
    const attribution = reducePerBot(
      [
        matchup(0, 1, [
          ev(frame(attack("gyaku-zuki")), frame(attack("mae-geri"))),
        ]),
      ],
      2,
    );

    expect(attribution("gyaku-zuki").adoptingBots).toBe(1); // side A ⇒ bot 0
    expect(attribution("mae-geri").adoptingBots).toBe(1); // side B ⇒ bot 1
  });

  it("does not credit a degraded-only pick — adoption is honoured-only", () => {
    const attribution = reducePerBot(
      [matchup(0, 1, [ev(frame(attack("gyaku-zuki"), "inert"), frame(IDLE))])],
      2,
    );

    expect(attribution("gyaku-zuki").adoptingBots).toBe(0);
  });

  it("reports k of N adopters — 0 for an unused move, N for a universal one", () => {
    // bots 0 & 1 land gyaku; all three land sweep; nobody throws. (3 bots)
    const attribution = reducePerBot(
      [
        matchup(0, 1, [
          ev(frame(SWEEP), frame(SWEEP)),
          ev(frame(attack("gyaku-zuki")), frame(attack("gyaku-zuki"))),
        ]),
        matchup(2, 0, [ev(frame(SWEEP), frame(IDLE))]),
      ],
      3,
    );

    expect(attribution("sweep").adoptingBots).toBe(3); // universal ⇒ N/N
    expect(attribution("gyaku-zuki").adoptingBots).toBe(2); // k of N
    expect(attribution("throw").adoptingBots).toBe(0); // none ⇒ 0/N
  });

  it("weights mean per-bot share by bot, not by tempo (a spammer doesn't dominate)", () => {
    // bot 0 spams gyaku 10× (one fight); bot 1 splits gyaku 1 / mae 1. Pooled gyaku
    // share ≈ 11/12 ≈ 0.917, but the per-bot mean is (10/10 + 1/2) / 2 = 0.75.
    const attribution = reducePerBot(
      [
        matchup(0, 1, commits("gyaku-zuki", 10)),
        matchup(1, 0, [
          ev(frame(attack("gyaku-zuki")), frame(IDLE)),
          ev(frame(attack("mae-geri")), frame(IDLE)),
        ]),
      ],
      2,
    );

    expect(attribution("gyaku-zuki").meanShare).toBe(0.75);
    expect(attribution("mae-geri").meanShare).toBe(0.25);
    expect(attribution("throw").meanShare).toBe(0); // unused but participants exist ⇒ 0, not null
  });

  it("divides the mean by the participating bots, excluding one that never commits", () => {
    // bot 0 lands gyaku once; bot 1 never commits (total 0) ⇒ mean over participants
    // (just bot 0) = (1/1) / 1 = 1.0, NOT (1.0 + 0) / 2 = 0.5.
    const attribution = reducePerBot(
      [matchup(0, 1, [ev(frame(attack("gyaku-zuki")), frame(IDLE))])],
      2,
    );

    expect(attribution("gyaku-zuki").meanShare).toBe(1);
  });

  it("reports mean per-bot share as null (never NaN) when no bot commits anything", () => {
    const attribution = reducePerBot(
      [matchup(0, 1, [ev(frame(IDLE), frame(IDLE))])],
      2,
    );

    expect(attribution("gyaku-zuki").meanShare).toBe(null);
  });
});

// ─── reduceOpeners: opener (each fighter's FIRST honoured commitment) → that fighter's
// fight outcome. Fed synthetic matchups so both the opener technique per side AND the
// fight winner are precisely controllable — the outcome join a pooled reducer can't do. ─
const fightWon = (
  winner: FightResult["winner"],
  events: FightEvent[],
): FightResult => ({ ...fightOf(events), winner });

const opening = (
  a: number,
  b: number,
  winner: FightResult["winner"],
  events: FightEvent[],
): Matchup => ({ a, b, fight: fightWon(winner, events) });

// A matchup where side A opens with `t` (B idles ⇒ B is a null opener), decided by `winner`.
const openA = (t: Technique, winner: FightResult["winner"]): Matchup =>
  opening(0, 1, winner, [ev(frame(techniqueAction(t)), frame(IDLE))]);

describe("reduceOpeners — opener win-rate (first honoured commitment → outcome)", () => {
  it("takes the FIRST honoured commitment as the opener, not a later one", () => {
    // side A commits gyaku (honoured) then mae later ⇒ opener is gyaku; mae never opens.
    const { rows } = reduceOpeners([
      opening(0, 1, "A", [
        ev(frame(attack("gyaku-zuki")), frame(IDLE)),
        ev(frame(attack("mae-geri")), frame(IDLE)),
      ]),
    ]);

    expect(rowFor({ rows }, "gyaku-zuki").opens).toBe(1);
    expect(rowFor({ rows }, "mae-geri").opens).toBe(0);
  });

  it("skips a degraded opening pick — the opener is the first HONOURED commitment", () => {
    // side A's first frame commits gyaku but it DEGRADES; its first honoured commitment
    // is the later mae ⇒ mae opens, gyaku does not.
    const { rows } = reduceOpeners([
      opening(0, 1, "A", [
        ev(frame(attack("gyaku-zuki"), "inert"), frame(IDLE)),
        ev(frame(attack("mae-geri")), frame(IDLE)),
      ]),
    ]);

    expect(rowFor({ rows }, "mae-geri").opens).toBe(1);
    expect(rowFor({ rows }, "gyaku-zuki").opens).toBe(0);
  });

  it("credits the winner's opener a win and the loser's opener a loss", () => {
    // A opens gyaku, B opens mae, A wins ⇒ gyaku 1-0-0, mae 0-1-0.
    const { rows } = reduceOpeners([
      opening(0, 1, "A", [
        ev(frame(attack("gyaku-zuki")), frame(attack("mae-geri"))),
      ]),
    ]);

    const gyaku = rowFor({ rows }, "gyaku-zuki");
    const mae = rowFor({ rows }, "mae-geri");

    expect([gyaku.opens, gyaku.wins, gyaku.losses, gyaku.draws]).toEqual([
      1, 1, 0, 0,
    ]);
    expect([mae.opens, mae.wins, mae.losses, mae.draws]).toEqual([1, 0, 1, 0]);
    expect(gyaku.winRate).toBe(1);
    expect(mae.winRate).toBe(0);
  });

  it("counts a draw for BOTH openers — never a win, but kept in the denominator", () => {
    const { rows } = reduceOpeners([
      opening(0, 1, "draw", [
        ev(frame(attack("gyaku-zuki")), frame(attack("mae-geri"))),
      ]),
    ]);

    const gyaku = rowFor({ rows }, "gyaku-zuki");
    const mae = rowFor({ rows }, "mae-geri");

    expect([gyaku.opens, gyaku.wins, gyaku.draws]).toEqual([1, 0, 1]);
    expect([mae.opens, mae.wins, mae.draws]).toEqual([1, 0, 1]);
    expect(gyaku.winRate).toBe(0);
  });

  it("computes win-rate = wins / opens with draws in the denominator", () => {
    // gyaku opens 4× on side A: 2 wins (A), 1 loss (B), 1 draw ⇒ 2/4 = 0.5.
    // (draws-EXCLUDED would read 2/3 ≈ 0.667 — this fixture distinguishes the two.)
    const { rows } = reduceOpeners([
      openA("gyaku-zuki", "A"),
      openA("gyaku-zuki", "A"),
      openA("gyaku-zuki", "B"),
      openA("gyaku-zuki", "draw"),
    ]);

    const gyaku = rowFor({ rows }, "gyaku-zuki");

    expect([gyaku.opens, gyaku.wins, gyaku.losses, gyaku.draws]).toEqual([
      4, 2, 1, 1,
    ]);
    expect(gyaku.winRate).toBe(0.5);
  });

  it("counts a fighter with no honoured commitment as a null opener (excluded, tallied)", () => {
    // side A idles the whole fight ⇒ null opener; side B opens gyaku and wins.
    const { rows, nullOpeners } = reduceOpeners([
      opening(0, 1, "B", [ev(frame(IDLE), frame(attack("gyaku-zuki")))]),
    ]);

    expect(nullOpeners).toBe(1);
    expect(rowFor({ rows }, "gyaku-zuki").opens).toBe(1); // B's opener still counted
    expect(rowFor({ rows }, "gyaku-zuki").wins).toBe(1); // B won ⇒ its opener won
    // side A contributed no opener anywhere in the table.
    expect(rows.reduce((sum, r) => sum + r.opens, 0)).toBe(1);
  });

  it("guards the zero-open case: a never-opened technique has winRate null (÷0), not NaN", () => {
    const { rows } = reduceOpeners([
      opening(0, 1, "A", [ev(frame(attack("gyaku-zuki")), frame(IDLE))]),
    ]);

    const ushiro = rowFor({ rows }, "ushiro-geri");

    expect(ushiro.opens).toBe(0);
    expect(ushiro.winRate).toBe(null);
    expect(Number.isNaN(ushiro.winRate as unknown as number)).toBe(false);
  });

  it("lists all 13 techniques, sorted win% desc → opens desc → canonical, nulls last", () => {
    // kizami 1/1 = 1.0 (top). Then a 0.5 cluster: gyaku 2/4 (opens 4), sweep 1/2 and
    // mae 1/2 (opens 2 each). opens-desc floats gyaku above sweep/mae — the OPPOSITE of
    // canonical (sweep idx 0 < gyaku idx 2) — isolating the opens tie-break; sweep & mae
    // tie on win% AND opens ⇒ canonical breaks them (sweep idx 0 before mae idx 3). Every
    // other technique never opens ⇒ winRate null ⇒ sinks to the bottom in canonical order.
    const { rows } = reduceOpeners([
      openA("kizami-zuki", "A"),
      openA("gyaku-zuki", "A"),
      openA("gyaku-zuki", "A"),
      openA("gyaku-zuki", "B"),
      openA("gyaku-zuki", "B"),
      openA("sweep", "A"),
      openA("sweep", "B"),
      openA("mae-geri", "A"),
      openA("mae-geri", "B"),
    ]);

    expect(rows.map((r) => r.technique)).toEqual([
      "kizami-zuki",
      "gyaku-zuki",
      "sweep",
      "mae-geri",
      "mawashi-geri",
      "uraken",
      "shuto",
      "yoko-geri",
      "ushiro-geri",
      "empi",
      "hiza-geri",
      "tobi-geri",
      "throw",
    ]);
    // the tail is genuinely the null (0-open) rows.
    expect(rowFor({ rows }, "throw").winRate).toBe(null);
  });

  it("ranks a real 0%-win opener (has opens) above the never-opened (—) techniques", () => {
    // gyaku opened twice and LOST both ⇒ winRate 0.0 — a real rate with opens 2, NOT null.
    // It must lead the table (a 0.0 rate outranks the never-opened rows), which distinguishes
    // "opened and always lost" from "nobody ever opened with it".
    const { rows } = reduceOpeners([
      openA("gyaku-zuki", "B"),
      openA("gyaku-zuki", "B"),
    ]);

    expect(rowFor({ rows }, "gyaku-zuki").winRate).toBe(0); // real 0.0, not null
    expect(rowFor({ rows }, "gyaku-zuki").opens).toBe(2);
    expect(rows[0].technique).toBe("gyaku-zuki"); // above every never-opened (—) row
    expect(rows[1].winRate).toBe(null); // and the rest are the never-opened tail
  });
});

// `opens` matchups opening with `t` on side A: `wins` won by the opener, the rest lost ⇒
// the t-opener has opens=opens, wins=wins, winRate=wins/opens (side B idles ⇒ null opener).
const openN = (t: Technique, wins: number, opens: number): Matchup[] => [
  ...Array.from({ length: wins }, () => openA(t, "A")),
  ...Array.from({ length: opens - wins }, () => openA(t, "B")),
];

describe("reduceOpeners — sample-gated dominance flag (§P7 opener guard)", () => {
  it("flags an opener strictly above 60% with enough samples (opens ≥ 10)", () => {
    // 7/10 = 0.70 > 0.60, opens 10 = the sample floor ⇒ dominant.
    const { rows } = reduceOpeners(openN("gyaku-zuki", 7, 10));

    expect(rowFor({ rows }, "gyaku-zuki").opens).toBe(10);
    expect(rowFor({ rows }, "gyaku-zuki").dominant).toBe(true);
  });

  it("does not flag an opener at EXACTLY 60% (strict >, not >=)", () => {
    // 6/10 = 0.60 exactly, opens 10 ⇒ NOT dominant.
    const { rows } = reduceOpeners(openN("gyaku-zuki", 6, 10));

    expect(rowFor({ rows }, "gyaku-zuki").winRate).toBe(0.6);
    expect(rowFor({ rows }, "gyaku-zuki").dominant).toBe(false);
  });

  it("does not flag an over-60% opener below the sample floor (opens < 10)", () => {
    // 9/9 = 1.00 (well over 60%) but only 9 opens < 10 ⇒ NOT dominant. Kills the
    // 1-open-100% false alarm and pins the floor at 10 (not 9).
    const { rows } = reduceOpeners(openN("gyaku-zuki", 9, 9));

    expect(rowFor({ rows }, "gyaku-zuki").opens).toBe(9);
    expect(rowFor({ rows }, "gyaku-zuki").winRate).toBe(1);
    expect(rowFor({ rows }, "gyaku-zuki").dominant).toBe(false);
  });

  it("does not flag a never-opened technique (null win-rate) as dominant", () => {
    const { rows } = reduceOpeners(openN("gyaku-zuki", 7, 10));

    expect(rowFor({ rows }, "throw").winRate).toBe(null);
    expect(rowFor({ rows }, "throw").dominant).toBe(false);
  });
});
