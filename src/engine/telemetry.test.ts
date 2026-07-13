import { describe, it, expect } from "vitest";
import {
  FAILURE_REASONS,
  reduceDegrades,
  reduceOccupancy,
  reduceOpeners,
  reducePerBot,
  reduceScoring,
  reduceUsage,
  runVariety,
  type Matchup,
  type OccupancyRow,
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

  it("carries per-technique start-failure rows from the round-robin", () => {
    // MOCK_RULES has no band / stamina / air gate, so every mid attack is honoured ⇒ both
    // bots' moves have start attempts but zero gate failures ⇒ a real 0.0 rate (not null).
    const report = runVariety(varietyConfig());

    expect(report.degrades).toHaveLength(13);
    expect(
      rowFor({ rows: report.degrades }, "gyaku-zuki").attempts,
    ).toBeGreaterThan(0);
    expect(rowFor({ rows: report.degrades }, "gyaku-zuki").failedStarts).toBe(
      0,
    );
    expect(rowFor({ rows: report.degrades }, "gyaku-zuki").rate).toBe(0);
  });

  it("carries reach-zone occupancy rows from the round-robin", () => {
    // startGap 200000 (the 'hand' tier) — the fighters begin in hand range and close in, so
    // real ticks accrue across the near tiers; every tick is bucketed into exactly one zone.
    const report = runVariety(varietyConfig());

    expect(report.occupancy).toHaveLength(5);
    expect(report.occupancy.map((r) => r.zone)).toEqual([
      "clinch",
      "hand",
      "kick",
      "poke",
      "out",
    ]);
    const totalFrames = report.occupancy.reduce((sum, r) => sum + r.frames, 0);
    expect(totalFrames).toBeGreaterThan(0);
    expect(
      report.occupancy.reduce((sum, r) => sum + (r.share ?? 0), 0),
    ).toBeCloseTo(1, 10);
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

// A frame where side A CHOOSES technique `t` with degrade `d` (null = honoured), B idles.
// `started(t, null)` = an honoured start; `started(t, "out-of-band")` = a gate failure;
// `started(t, "locked")` = a busy-fighter frame (excluded from the rate).
const started = (t: Technique, d: DegradeReason | null): FightEvent =>
  ev(frame(techniqueAction(t), d), frame(IDLE));

// ─── reduceDegrades: per-technique START-FAILURE rate. Over every frame, a chosen
// technique that was honoured OR gate-failed (out-of-band / unaffordable / wrong-context
// / inert) is a start attempt; the gate-failures are the numerator. A `locked` frame — a
// busy fighter's ignored input while committed to an already-honoured move — is dropped
// from BOTH numerator and denominator. Fed plain fights (no bot identity needed). ───────
describe("reduceDegrades — per-technique start-failure rate", () => {
  it("counts honoured and gate-failed frames as start attempts, but excludes locked", () => {
    // mae-geri chosen 5×: 3 honoured, 1 out-of-band (a failed start), 1 locked (busy on an
    // already-honoured move ⇒ excluded from BOTH the numerator and the denominator).
    const rows = reduceDegrades([
      fightOf([
        ev(frame(attack("mae-geri")), frame(IDLE)),
        ev(frame(attack("mae-geri")), frame(IDLE)),
        ev(frame(attack("mae-geri")), frame(IDLE)),
        ev(frame(attack("mae-geri"), "out-of-band"), frame(IDLE)),
        ev(frame(attack("mae-geri"), "locked"), frame(IDLE)),
      ]),
    ]);

    const mae = rowFor({ rows }, "mae-geri");

    expect(mae.attempts).toBe(4); // 3 honoured + 1 out-of-band; the locked frame is excluded
    expect(mae.failedStarts).toBe(1); // the out-of-band frame only
    expect(mae.rate).toBe(0.25); // 1 / 4
    expect(mae.reasons["out-of-band"]).toBe(1);
  });

  it("splits failedStarts across all four reasons in their own buckets, summing to failedStarts", () => {
    // gyaku fails via each gate a DISTINCT number of times (oob 1, unaff 2, wctx 3, inert 4)
    // plus 2 honoured ⇒ attempts 12, fail 10. Distinct counts pin each reason to its own
    // bucket (a swapped or dropped bucket, or a mis-keyed count, changes an assertion).
    const rows = reduceDegrades([
      fightOf([
        started("gyaku-zuki", null),
        started("gyaku-zuki", null),
        started("gyaku-zuki", "out-of-band"),
        started("gyaku-zuki", "unaffordable"),
        started("gyaku-zuki", "unaffordable"),
        started("gyaku-zuki", "wrong-context"),
        started("gyaku-zuki", "wrong-context"),
        started("gyaku-zuki", "wrong-context"),
        started("gyaku-zuki", "inert"),
        started("gyaku-zuki", "inert"),
        started("gyaku-zuki", "inert"),
        started("gyaku-zuki", "inert"),
      ]),
    ]);

    const gyaku = rowFor({ rows }, "gyaku-zuki");

    expect(gyaku.attempts).toBe(12);
    expect(gyaku.failedStarts).toBe(10);
    expect(gyaku.rate).toBeCloseTo(10 / 12, 10); // 0.8333…
    expect(gyaku.reasons["out-of-band"]).toBe(1);
    expect(gyaku.reasons.unaffordable).toBe(2);
    expect(gyaku.reasons["wrong-context"]).toBe(3);
    expect(gyaku.reasons.inert).toBe(4);
    // the per-reason buckets sum to failedStarts (a dropped bucket breaks this).
    expect(FAILURE_REASONS.reduce((s, r) => s + gyaku.reasons[r], 0)).toBe(10);
  });

  it("counts a failed start on either fighter — side B, not just side A", () => {
    const rows = reduceDegrades([
      fightOf([ev(frame(IDLE), frame(attack("mae-geri"), "out-of-band"))]),
    ]);

    const mae = rowFor({ rows }, "mae-geri");

    expect(mae.attempts).toBe(1);
    expect(mae.failedStarts).toBe(1);
  });

  it("guards attempts == 0 — a never-chosen OR locked-only technique reads rate null, all-0", () => {
    // gyaku appears ONLY while locked (busy) ⇒ 0 start attempts; ushiro never appears.
    const rows = reduceDegrades([
      fightOf([
        started("gyaku-zuki", "locked"),
        started("gyaku-zuki", "locked"),
      ]),
    ]);

    const gyaku = rowFor({ rows }, "gyaku-zuki");

    expect(gyaku.attempts).toBe(0); // locked frames are not start attempts
    expect(gyaku.failedStarts).toBe(0);
    expect(gyaku.rate).toBe(null); // ÷0 guard, never NaN
    expect(Number.isNaN(gyaku.rate as unknown as number)).toBe(false);
    expect(gyaku.reasons["out-of-band"]).toBe(0);

    const ushiro = rowFor({ rows }, "ushiro-geri");

    expect(ushiro.attempts).toBe(0);
    expect(ushiro.rate).toBe(null);
  });

  it("always lists all 13 techniques, even ones never chosen", () => {
    const rows = reduceDegrades([
      fightOf([started("gyaku-zuki", "out-of-band")]),
    ]);

    expect(rows).toHaveLength(13);
    expect(
      rows
        .map((r) => r.technique)
        .slice()
        .sort(),
    ).toEqual(CANONICAL.slice().sort());
  });

  it("reconciles with the usage histogram: honoured (attempts − failedStarts) = the usage count", () => {
    // 2 honoured gyaku + 1 out-of-band gyaku ⇒ degrade attempts 3, fail 1 ⇒ honoured 2;
    // reduceUsage counts only the 2 honoured. The two sections agree on `honoured`.
    const fights = [
      fightOf([
        started("gyaku-zuki", null),
        started("gyaku-zuki", null),
        started("gyaku-zuki", "out-of-band"),
      ]),
    ];

    const gyaku = rowFor({ rows: reduceDegrades(fights) }, "gyaku-zuki");

    expect(gyaku.attempts - gyaku.failedStarts).toBe(
      rowFor(reduceUsage(fights), "gyaku-zuki").count,
    );
    expect(rowFor(reduceUsage(fights), "gyaku-zuki").count).toBe(2);
  });

  it("reads a chosen-but-always-fails move as 100% here yet 0 in the usage histogram", () => {
    // gyaku chosen twice, both out-of-band, never honoured ⇒ rate 1.0 / usage 0 — the
    // S1a-9 payoff: a usage-0 means "attempted but never executed", explained here.
    const fights = [
      fightOf([
        started("gyaku-zuki", "out-of-band"),
        started("gyaku-zuki", "out-of-band"),
      ]),
    ];

    const gyaku = rowFor({ rows: reduceDegrades(fights) }, "gyaku-zuki");

    expect(gyaku.attempts).toBe(2);
    expect(gyaku.rate).toBe(1);
    expect(rowFor(reduceUsage(fights), "gyaku-zuki").count).toBe(0);
  });

  it("sorts rows by rate desc → attempts desc → canonical, with 0-attempt (—) rows last", () => {
    // kizami 1/1 = 1.0 (top). Then a 0.5 cluster: gyaku 2/4 (attempts 4), sweep 1/2 and
    // mae 1/2 (attempts 2 each). attempts-desc floats gyaku above sweep/mae — the OPPOSITE
    // of canonical (sweep idx 0 < gyaku idx 2) — isolating the attempts tie-break; sweep &
    // mae tie on rate AND attempts ⇒ canonical breaks them (sweep idx 0 before mae idx 3).
    // Every other technique has 0 attempts ⇒ rate null ⇒ sinks to the bottom, canonical.
    const rows = reduceDegrades([
      fightOf([
        started("kizami-zuki", "out-of-band"), // 1/1 = 1.0
        started("gyaku-zuki", null),
        started("gyaku-zuki", null),
        started("gyaku-zuki", "out-of-band"),
        started("gyaku-zuki", "out-of-band"), // 2/4 = 0.5
        started("sweep", null),
        started("sweep", "out-of-band"), // 1/2 = 0.5
        started("mae-geri", null),
        started("mae-geri", "out-of-band"), // 1/2 = 0.5
      ]),
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
    // the tail is genuinely the null (0-attempt) rows.
    expect(rowFor({ rows }, "throw").rate).toBe(null);
  });
});

// ─── reduceOccupancy: reach-zone occupancy over inter-fighter distance. Each tick contributes
// ONE sample — |a.x − b.x| (symmetric) — bucketed into 5 half-open reach tiers at the reach
// ladder's cut points (throw 120k / reverse 240k / roundhouse 300k / ushiro 330k). Reads only
// `x`; a distance ON a cut lands in the HIGHER tier; a distance beyond the last cut is `out`. ──

// A frame at horizontal position `x` (occupancy reads only x; action/degrade are inert here).
const at = (x: number): FighterFrame => ({
  x,
  y: 0,
  action: IDLE,
  points: 0,
  stamina: 0,
  degrade: null,
});

// An event whose fighters sit `d` sub-units apart (a at 0, b at d ⇒ |a.x − b.x| = d).
const apart = (d: number): FightEvent => ev(at(0), at(d));

const zoneFor = (
  rows: readonly OccupancyRow[],
  zone: OccupancyRow["zone"],
): OccupancyRow => {
  const found = rows.find((r) => r.zone === zone);

  if (found === undefined) throw new Error(`no row for zone ${zone}`);

  return found;
};

describe("reduceOccupancy — reach-zone occupancy over inter-fighter distance", () => {
  it("buckets each tick's |a.x − b.x| into its half-open reach tier — a boundary lands in the higher tier", () => {
    // two ticks in each tier, the lower of each pair sitting just below the cut, the upper ON
    // the cut (which belongs to the HIGHER tier), plus the ring ceiling in the top tier.
    const rows = reduceOccupancy([
      fightOf([
        apart(0), // clinch
        apart(119999), // clinch (just below the 120k cut)
        apart(120000), // hand   (the 120k cut → the HIGHER tier)
        apart(239999), // hand
        apart(240000), // kick   (the 240k cut)
        apart(299999), // kick
        apart(300000), // poke   (the 300k cut)
        apart(329999), // poke
        apart(330000), // out    (the 330k cut)
        apart(600000), // out    (the ring ceiling)
      ]),
    ]);

    expect(zoneFor(rows, "clinch").frames).toBe(2);
    expect(zoneFor(rows, "hand").frames).toBe(2);
    expect(zoneFor(rows, "kick").frames).toBe(2);
    expect(zoneFor(rows, "poke").frames).toBe(2);
    expect(zoneFor(rows, "out").frames).toBe(2);
  });

  it("counts ONE distance sample per tick, not one per fighter", () => {
    // 3 ticks, all at a 'kick'-range gap ⇒ kick 3 (NOT 6), and the grand total is 3 ticks.
    const rows = reduceOccupancy([
      fightOf([apart(250000), apart(250000), apart(250000)]),
    ]);

    expect(zoneFor(rows, "kick").frames).toBe(3);
    expect(rows.reduce((sum, r) => sum + r.frames, 0)).toBe(3);
  });

  it("measures the absolute gap regardless of which fighter leads", () => {
    // a ahead of b, then b ahead of a — both a 200k gap ⇒ both land in 'hand' (drops abs ⇒ fails).
    const rows = reduceOccupancy([
      fightOf([ev(at(300000), at(100000)), ev(at(100000), at(300000))]),
    ]);

    expect(zoneFor(rows, "hand").frames).toBe(2);
  });

  it("computes each zone's share as frames / total ticks", () => {
    // 12 ticks: 3 in 'kick', 9 in 'clinch' ⇒ 0.25 and 0.75.
    const rows = reduceOccupancy([
      fightOf([
        ...Array.from({ length: 3 }, () => apart(250000)),
        ...Array.from({ length: 9 }, () => apart(0)),
      ]),
    ]);

    expect(zoneFor(rows, "kick").share).toBe(0.25);
    expect(zoneFor(rows, "clinch").share).toBe(0.75);
  });

  it("lists an unoccupied tier with 0 frames / 0 share — never omitted", () => {
    const rows = reduceOccupancy([fightOf([apart(0), apart(0)])]); // all clinch

    expect(rows).toHaveLength(5);
    expect(zoneFor(rows, "poke").frames).toBe(0);
    expect(zoneFor(rows, "poke").share).toBe(0);
  });

  it("guards the zero-total case: every share is null (never NaN) when no tick occurs", () => {
    const rows = reduceOccupancy([]); // no fights ⇒ no frames

    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.frames === 0)).toBe(true);
    expect(rows.every((r) => r.share === null)).toBe(true);
  });

  it("partitions every tick into exactly one tier — frames sum to the tick count, raw shares to 1.0", () => {
    const rows = reduceOccupancy([
      fightOf([
        apart(0),
        apart(119999),
        apart(120000),
        apart(239999),
        apart(240000),
        apart(299999),
        apart(300000),
        apart(329999),
        apart(330000),
        apart(600000),
      ]),
    ]);

    expect(rows.reduce((sum, r) => sum + r.frames, 0)).toBe(10);
    expect(rows.reduce((sum, r) => sum + (r.share ?? 0), 0)).toBeCloseTo(1, 10);
  });

  it("keeps rows in fixed near→far order even when a far tier dominates", () => {
    // 'poke' carries the most frames, but the rows must still read clinch → out.
    const rows = reduceOccupancy([
      fightOf([apart(0), apart(310000), apart(310000), apart(310000)]),
    ]);

    expect(rows.map((r) => r.zone)).toEqual([
      "clinch",
      "hand",
      "kick",
      "poke",
      "out",
    ]);
  });
});

// ─── reduceScoring (S4): scoring attribution. Joins each positive scoreboard delta
// (frame[i].points − frame[i−1].points > 0, per fighter side) to the honoured-start
// whose absolute [i+startup, i+startup+active−1] window covers the delta index — one
// event per tick means the array index IS the tick, so windows are index ranges. A
// covered delta is that move's `pts` (counter bonuses ride inside the whole delta); an
// UNCOVERED positive delta is a jogai/passivity penalty (+1 to the opponent), summed
// into `excludedPenaltyPts`. Reads only .action/.degrade/.points + per-technique
// startup/active from `rules` — NO fouls read (reconciliation is a test-level cross-
// check between the delta-derived excluded total and FightResult.fouls). ───────────────

// A frame carrying an explicit scoreboard `points` (the S4 attribution axis) — the usage
// `frame` factory pins points to 0, so scoring needs its own. Honoured by default.
const pf = (
  action: Action,
  points: number,
  degrade: DegradeReason | null = null,
): FighterFrame => ({ x: 0, y: 0, action, points, stamina: 0, degrade });

// Zip equal-length per-side frame arrays into a fight, tick == array index (the engine
// records one event per tick from 0), carrying explicit final scores + fouls. The
// reducer's window axis is the array index, so tick == index keeps the fixture faithful.
const scoringFight = (
  aFrames: FighterFrame[],
  bFrames: FighterFrame[],
  scores: { a: number; b: number },
  fouls: FightResult["fouls"] = {
    a: { jogai: 0, passivity: 0 },
    b: { jogai: 0, passivity: 0 },
  },
): FightResult => ({
  winner: "draw",
  ticks: aFrames.length,
  scores,
  events: aFrames.map((a, i) => ({ tick: i, a, b: bFrames[i] })),
  endReason: "time",
  fouls,
});

// Fixture rules for scoring: mae-geri carries a WIDE window (startup 9, active 3 ⇒ a
// start at index 0 covers [9, 11]) to pin the window off-by-one; every other move is a
// unit window (startup 1, active 1 ⇒ a start at index i covers [i+1]) so `startScoring`
// can compose arbitrary (starts, pts). The reducer reads only startup/active from here
// (knockdownClass is a fixed named set — sweep + hiza-geri — not read off the spec).
const SW = { startup: 1, active: 1, recovery: 1, reach: 250000 };

const SCORING_RULES: Rules = {
  tickRate: 60,
  walkSpeed: 4000,
  ring: { width: 600000 },
  startGap: 200000,
  moves: {
    "gyaku-zuki": { ...SW, score: 1 },
    "kizami-zuki": { ...SW, score: 1 },
    "mae-geri": { startup: 9, active: 3, recovery: 6, score: 2, reach: 250000 },
    "mawashi-geri": { ...SW, score: 2 },
    uraken: { ...SW, score: 1 },
    shuto: { ...SW, score: 1 },
    "yoko-geri": { ...SW, score: 2 },
    "ushiro-geri": { ...SW, score: 2 },
    empi: { ...SW, score: 2 },
    "hiza-geri": { ...SW, score: 0, knockdown: true },
    "tobi-geri": { ...SW, score: 1, air: true },
    sweep: { ...SW, score: 0, knockdown: true },
  },
  throw: { ...SW, score: 3 },
};

// One fight: side A honour-starts unit-window `t` at index 0 and scores `pts` at index 1
// (its window [1, 1]); `pts === 0` ⇒ a whiff (a start that never lands). Side B idles.
// Points reset per fight, so pooling many composes arbitrary (starts, pts). NOT for
// mae-geri (its window is [9, 11], not [1, 1]).
const startScoring = (t: Technique, pts: number): FightResult =>
  scoringFight(
    [pf(techniqueAction(t), 0), pf(IDLE, pts)],
    [pf(IDLE, 0), pf(IDLE, 0)],
    { a: pts, b: 0 },
  );

// The penalty points a fight awards = Σ over fighters of max(0, foulCount − 1) (each
// jogai/passivity foul beyond the first gives the OPPONENT +1). The reconciliation target
// for excludedPenaltyPts — derived from FightResult.fouls, a source the reducer never reads.
const foulPts = (r: FightResult): number =>
  Math.max(0, r.fouls.a.jogai + r.fouls.a.passivity - 1) +
  Math.max(0, r.fouls.b.jogai + r.fouls.b.passivity - 1);

describe("reduceScoring — per-technique scoring attribution (window join)", () => {
  it("attributes points only inside the move's [startup, startup+active−1] window (both bounds load-bearing)", () => {
    // mae-geri (startup 9, active 3) starts at index 0 ⇒ window [9, 11]. Points gain +1 at
    // index 8 (BEFORE), +2 at index 9 (at lo), +3 at index 11 (at hi), +1 at index 12 (AFTER).
    // Only the +2 and +3 are mae's (pts 5); a ±1 slip of EITHER bound adds an adjacent +1 or
    // drops an edge gain — changing 5 — so startup AND active are both pinned.
    const aPoints = [0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 6, 7];

    const fight = scoringFight(
      aPoints.map((p, i) =>
        pf(i === 0 ? techniqueAction("mae-geri") : IDLE, p),
      ),
      aPoints.map(() => pf(IDLE, 0)),
      { a: 7, b: 0 },
    );

    const mae = rowFor(reduceScoring([fight], SCORING_RULES), "mae-geri");

    expect(mae.starts).toBe(1);
    expect(mae.land).toBe(1);
    expect(mae.pts).toBe(5); // the +2 (at lo) and +3 (at hi); not the before/after +1s
  });

  it("does not count a zero delta in the window as a land (strict > 0, not >= 0)", () => {
    // gyaku starts at index 0 (window [1, 1]) but points stay flat ⇒ delta 0 at index 1.
    const gyaku = rowFor(
      reduceScoring([startScoring("gyaku-zuki", 0)], SCORING_RULES),
      "gyaku-zuki",
    );

    expect(gyaku.starts).toBe(1);
    expect(gyaku.land).toBe(0);
    expect(gyaku.pts).toBe(0);
  });

  it("counts a landing start once (binary land) while summing its points", () => {
    // one gyaku start, one +2 delta in its window ⇒ land 1 (not 2), pts 2 — distinguishes
    // `land += 1` from `land += delta` / `land = pts`.
    const gyaku = rowFor(
      reduceScoring([startScoring("gyaku-zuki", 2)], SCORING_RULES),
      "gyaku-zuki",
    );

    expect(gyaku.land).toBe(1);
    expect(gyaku.pts).toBe(2);
  });

  it("credits an attributed delta to the committing move on EITHER side (not just side A)", () => {
    // side B honour-starts gyaku at index 0 (window [1, 1]) and scores +1 at index 1.
    const fight = scoringFight(
      [pf(IDLE, 0), pf(IDLE, 0)],
      [pf(techniqueAction("gyaku-zuki"), 0), pf(IDLE, 1)],
      { a: 0, b: 1 },
    );

    const gyaku = rowFor(reduceScoring([fight], SCORING_RULES), "gyaku-zuki");

    expect(gyaku.starts).toBe(1);
    expect(gyaku.land).toBe(1);
    expect(gyaku.pts).toBe(1);
  });

  it("attributes points to a throw start's window (throw reads rules.throw, not moves)", () => {
    // throw honour-starts at index 0 ⇒ window [1, 1] (SCORING_RULES.throw startup 1 active 1);
    // +3 lands at index 1. A moves[...] lookup would find no throw window ⇒ throw would score 0.
    const fight = scoringFight(
      [pf(THROW, 0), pf(IDLE, 3)],
      [pf(IDLE, 0), pf(IDLE, 0)],
      {
        a: 3,
        b: 0,
      },
    );

    const thrown = rowFor(reduceScoring([fight], SCORING_RULES), "throw");

    expect(thrown.starts).toBe(1);
    expect(thrown.land).toBe(1);
    expect(thrown.pts).toBe(3);
  });

  it("catches a point on the commit tick itself for a startup-0 move (window opens at frame 0)", () => {
    // A startup-0, active-1 move committed at index 0 has window [0, 0]; a point scored on that
    // tick (points[0] = 1) is its gain from the pre-fight scoreboard baseline (0). Pins the
    // baseline read at the very first frame.
    const rules0: Rules = {
      ...SCORING_RULES,
      moves: {
        ...SCORING_RULES.moves,
        uraken: { startup: 0, active: 1, recovery: 1, score: 1, reach: 250000 },
      },
    };

    const fight = scoringFight(
      [pf(techniqueAction("uraken"), 1)],
      [pf(IDLE, 0)],
      {
        a: 1,
        b: 0,
      },
    );

    const uraken = rowFor(reduceScoring([fight], rules0), "uraken");

    expect(uraken.starts).toBe(1);
    expect(uraken.land).toBe(1);
    expect(uraken.pts).toBe(1);
  });

  it("is safe when a start's window runs past the final frame (no out-of-bounds points read)", () => {
    // gyaku (startup 1 active 1) honour-starts at the ONLY frame of a 1-frame fight, so its
    // window [1, 1] lies beyond the recorded frames. The scoreboard is flat after the fight
    // ends ⇒ the window catches 0 — pts stays a real number, never NaN from an OOB read.
    const fight = scoringFight(
      [pf(techniqueAction("gyaku-zuki"), 0)],
      [pf(IDLE, 0)],
      {
        a: 0,
        b: 0,
      },
    );

    const gyaku = rowFor(reduceScoring([fight], SCORING_RULES), "gyaku-zuki");

    expect(gyaku.starts).toBe(1);
    expect(gyaku.pts).toBe(0);
    expect(Number.isNaN(gyaku.pts)).toBe(false);
  });

  it("guards a fight with no recorded frames (empty events) — a real number total, never NaN", () => {
    const scoring = reduceScoring(
      [scoringFight([], [], { a: 0, b: 0 })],
      SCORING_RULES,
    );

    expect(scoring.excludedPenaltyPts).toBe(0);
    expect(Number.isNaN(scoring.excludedPenaltyPts)).toBe(false);
  });

  it("still counts a honoured start whose technique the rules don't configure (reconciles with usage), but it never lands", () => {
    // An engine-impossible frame (an unconfigured pick degrades to `inert`, never honoured) —
    // but the reducer stays well-defined: the start counts (so `starts` tracks the usage count)
    // yet has no window, so it catches nothing and its point falls to the penalty residual
    // rather than being fabricated onto the move.
    const noEmpi: Rules = {
      ...SCORING_RULES,
      moves: { ...SCORING_RULES.moves, empi: undefined },
    };

    const fight = scoringFight(
      [pf(techniqueAction("empi"), 0), pf(IDLE, 1)],
      [pf(IDLE, 0), pf(IDLE, 0)],
      { a: 1, b: 0 },
    );

    const scoring = reduceScoring([fight], noEmpi);
    const empi = rowFor(scoring, "empi");

    expect(empi.starts).toBe(1); // counted, matching the usage predicate
    expect(empi.land).toBe(0); // no window ⇒ never lands
    expect(empi.pts).toBe(0);
    expect(scoring.excludedPenaltyPts).toBe(1); // the point falls to the residual, not onto empi
  });

  it("reports `starts` identical to the S1a usage count (same honoured-start predicate)", () => {
    // gyaku honoured 2× + degraded 1× (inert, never honoured), mae honoured 1×.
    const fights = [
      scoringFight(
        [
          pf(techniqueAction("gyaku-zuki"), 0),
          pf(techniqueAction("gyaku-zuki"), 0),
          pf(techniqueAction("gyaku-zuki"), 0, "inert"),
          pf(techniqueAction("mae-geri"), 0),
        ],
        [pf(IDLE, 0), pf(IDLE, 0), pf(IDLE, 0), pf(IDLE, 0)],
        { a: 0, b: 0 },
      ),
    ];

    const scoring = reduceScoring(fights, SCORING_RULES);
    const usage = reduceUsage(fights);

    expect(rowFor(scoring, "gyaku-zuki").starts).toBe(
      rowFor(usage, "gyaku-zuki").count,
    );
    expect(rowFor(scoring, "gyaku-zuki").starts).toBe(2);
    expect(rowFor(scoring, "mae-geri").starts).toBe(
      rowFor(usage, "mae-geri").count,
    );
  });

  it("lists all 13 techniques; a never-started move is present with null rates (÷0 guard)", () => {
    const scoring = reduceScoring(
      [startScoring("gyaku-zuki", 1)],
      SCORING_RULES,
    );

    expect(scoring.rows).toHaveLength(13);
    expect(
      scoring.rows
        .map((r) => r.technique)
        .slice()
        .sort(),
    ).toEqual(CANONICAL.slice().sort());

    const ushiro = rowFor(scoring, "ushiro-geri");

    expect(ushiro.starts).toBe(0);
    expect(ushiro.land).toBe(0);
    expect(ushiro.pts).toBe(0);
    expect(ushiro.landRate).toBe(null);
    expect(ushiro.ptsPerStart).toBe(null);
    expect(ushiro.knockdownClass).toBe(false);
  });

  it("computes landRate = land/starts and ptsPerStart = pts/starts for a live move", () => {
    // gyaku starts 4: 3 land 1 pt each, 1 whiffs ⇒ land 3, pts 3 ⇒ landRate 0.75, pts/start 0.75.
    const scoring = reduceScoring(
      [
        startScoring("gyaku-zuki", 1),
        startScoring("gyaku-zuki", 1),
        startScoring("gyaku-zuki", 1),
        startScoring("gyaku-zuki", 0),
      ],
      SCORING_RULES,
    );

    const gyaku = rowFor(scoring, "gyaku-zuki");

    expect(gyaku.starts).toBe(4);
    expect(gyaku.land).toBe(3);
    expect(gyaku.pts).toBe(3);
    expect(gyaku.landRate).toBe(0.75);
    expect(gyaku.ptsPerStart).toBe(0.75);
  });

  it("guards the zero-total case: every rate null (never NaN), no excluded points", () => {
    const scoring = reduceScoring(
      [scoringFight([pf(IDLE, 0)], [pf(IDLE, 0)], { a: 0, b: 0 })],
      SCORING_RULES,
    );

    for (const r of scoring.rows) {
      expect(r.landRate).toBe(null);
      expect(r.ptsPerStart).toBe(null);
      expect(Number.isNaN(r.landRate as unknown as number)).toBe(false);
    }

    expect(scoring.excludedPenaltyPts).toBe(0);
  });

  it("sorts rows by pts desc → starts desc → canonical order", () => {
    // uraken 4pts (top). Then a 2-pt cluster: mawashi (starts 4), kizami (starts 2), gyaku
    // (starts 2). starts-desc floats mawashi (idx 4) above kizami/gyaku — OPPOSITE canonical
    // — isolating the starts tie-break; kizami & gyaku tie on pts AND starts ⇒ canonical
    // breaks them (kizami idx 1 before gyaku idx 2). The pts-0 tail is canonical order.
    const scoring = reduceScoring(
      [
        ...Array.from({ length: 4 }, () => startScoring("uraken", 1)),
        ...Array.from({ length: 2 }, () => startScoring("mawashi-geri", 1)),
        ...Array.from({ length: 2 }, () => startScoring("mawashi-geri", 0)),
        ...Array.from({ length: 2 }, () => startScoring("kizami-zuki", 1)),
        ...Array.from({ length: 2 }, () => startScoring("gyaku-zuki", 1)),
      ],
      SCORING_RULES,
    );

    expect(scoring.rows.map((r) => r.technique)).toEqual([
      "uraken",
      "mawashi-geri",
      "kizami-zuki",
      "gyaku-zuki",
      "sweep",
      "mae-geri",
      "shuto",
      "yoko-geri",
      "ushiro-geri",
      "empi",
      "hiza-geri",
      "tobi-geri",
      "throw",
    ]);
  });
});

describe("reduceScoring — score-0 knockdown moves (okizeme finish, S4-3)", () => {
  it("flags sweep + hiza-geri as knockdownClass and keeps the finish points on the finisher", () => {
    // sweep starts at index 0 (its own window [1, 1] catches nothing — sweep scores 0, it
    // DOWNS). The gyaku okizeme finisher starts at index 2 (window [3, 3]) and scores +3.
    const fight = scoringFight(
      [
        pf(techniqueAction("sweep"), 0),
        pf(IDLE, 0),
        pf(techniqueAction("gyaku-zuki"), 0),
        pf(IDLE, 3),
      ],
      [pf(IDLE, 0), pf(IDLE, 0), pf(IDLE, 0), pf(IDLE, 0)],
      { a: 3, b: 0 },
    );

    const scoring = reduceScoring([fight], SCORING_RULES);
    const sweep = rowFor(scoring, "sweep");
    const gyaku = rowFor(scoring, "gyaku-zuki");

    expect(sweep.knockdownClass).toBe(true);
    expect(sweep.starts).toBe(1);
    expect(sweep.pts).toBe(0); // scores via the finisher, not directly
    expect(gyaku.pts).toBe(3); // the okizeme 3 lands on gyaku, not sweep
    expect(gyaku.knockdownClass).toBe(false);

    // hiza-geri is knockdown-class even unused here; tobi-geri (a scoring air move) and throw
    // (which scores its grab directly) are NOT — only the two okizeme setups blank to "—".
    expect(rowFor(scoring, "hiza-geri").knockdownClass).toBe(true);
    expect(rowFor(scoring, "tobi-geri").knockdownClass).toBe(false);
    expect(rowFor(scoring, "throw").knockdownClass).toBe(false);
  });
});

describe("reduceScoring — penalty exclusion + reconciliation (S4-4/S4-5)", () => {
  // A lands 2 gyaku (index-0 start → +1 at index 1; index-2 start → +1 at index 3); B never
  // commits but gains +1 at index 4 — a jogai penalty (A fouled twice ⇒ opponent +1). The
  // penalty delta is uncovered by any honoured-start ⇒ excluded, never mis-attributed.
  const penaltyFight = scoringFight(
    [
      pf(techniqueAction("gyaku-zuki"), 0),
      pf(IDLE, 1),
      pf(techniqueAction("gyaku-zuki"), 1),
      pf(IDLE, 2),
      pf(IDLE, 2),
    ],
    [pf(IDLE, 0), pf(IDLE, 0), pf(IDLE, 0), pf(IDLE, 0), pf(IDLE, 1)],
    { a: 2, b: 1 },
    { a: { jogai: 2, passivity: 0 }, b: { jogai: 0, passivity: 0 } },
  );

  it("excludes the uncovered penalty delta from every technique and reconciles it to the fouls", () => {
    const scoring = reduceScoring([penaltyFight], SCORING_RULES);

    expect(rowFor(scoring, "gyaku-zuki").pts).toBe(2); // both combat lands, not the +1 penalty
    expect(rowFor(scoring, "gyaku-zuki").land).toBe(2);
    // no technique absorbs the penalty ⇒ Σ pts is exactly the combat points.
    expect(scoring.rows.reduce((sum, r) => sum + r.pts, 0)).toBe(2);
    // the excluded total equals Σ max(0, foulCount − 1) — the independent fouls-derived target.
    expect(scoring.excludedPenaltyPts).toBe(1);
    expect(scoring.excludedPenaltyPts).toBe(foulPts(penaltyFight));
  });

  it("upholds the master sum invariant: Σ pts + excluded == Σ final scores", () => {
    const scoring = reduceScoring([penaltyFight], SCORING_RULES);
    const attributed = scoring.rows.reduce((sum, r) => sum + r.pts, 0);

    expect(attributed + scoring.excludedPenaltyPts).toBe(
      penaltyFight.scores.a + penaltyFight.scores.b,
    );
  });
});
