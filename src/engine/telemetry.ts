// ============================================================================
// Variety telemetry — the pure read-only reduction that answers "is the arsenal
// broadly used, or collapsing onto a few moves?" Given the fights already produced
// by the deterministic engine (`runFight`'s `FightResult[]`), it pools every
// HONOURED technique commitment — both fighters, every tick — into a per-technique
// usage histogram over the 13 canonical techniques.
//
// READ-ONLY over the engine: it consumes `FightResult.events` and computes; it
// changes no DSL op, no `CANONICAL_RULES`, no outcome path. Nothing here can flip
// `INPUT_HASH` or the benchmark version — a fight's bytes are identical whether or
// not this reducer ever runs over them. PURE + deterministic: no I/O, no clock, no
// randomness; the same fights always reduce to the same report.
//
// A HONOURED commitment (grill #1) = a frame whose action commits to a technique
// (`attack` / `throw` / `sweep`) AND took effect (`degrade === null`). A degraded
// commitment — the move never happened — contributes nothing; a non-technique
// action (`idle` / `move` / `block` / `crouch` / `jump` / `throw-break`) is not a
// commitment at all.
// ============================================================================
import type { Action, MoveId, Rules } from "./types.js";
import {
  runFight,
  type DegradeReason,
  type FightConfig,
  type FightResult,
  type FighterFrame,
} from "./sim.js";
import type { BotDoc } from "./dsl.js";
import { sameDoc } from "./benchmark.js";

// A committed technique: one of the 11 attack moves, or a throw / sweep.
export type Technique = MoveId | "throw" | "sweep";

// The 13 techniques in canonical frame-table order — the spec's frame table
// (`sweep`, then the 11 attacks) with the `throw` grapple appended. This order is
// the report's tie-break: rows are built in this order, then a STABLE sort by share
// descending leaves equal-share techniques in it.
const TECHNIQUES: readonly Technique[] = [
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

// A technique whose pooled share strictly exceeds this fraction is flagged as
// dominant (the §P7 "no move > ~35% usage" balance target). Exported so the CLI's
// legend names the same threshold the reducer flags against — no drift.
export const USAGE_FLAG_THRESHOLD = 0.35;

// A pooled (bot-identity-free) row — what reduceUsage produces from a set of fights.
export type PooledRow = {
  technique: Technique;
  count: number; // honoured commitments of this technique, pooled over both fighters
  share: number; // count / totalCommitments (raw fraction in [0, 1]); 0 when total is 0
  dominant: boolean; // share strictly > USAGE_FLAG_THRESHOLD
};

// An enriched row — a pooled row plus the per-bot attribution the driver can add once it
// knows which bot authored each commitment (which a bare FightResult does not carry).
export type UsageRow = PooledRow & {
  adoptingBots: number; // distinct population bots that honoured this technique ≥once (the k in the k/N adoption)
  meanShare: number | null; // mean, over participating bots, of each bot's own share of this technique; null when no bot committed anything
};

// The pooled histogram over a set of fights — no bot identity, so no adoption / mean share.
export type PooledReport = {
  rows: PooledRow[]; // all 13 techniques, sorted share-desc then canonical order
  totalCommitments: number; // Σ counts — the histogram denominator
  totalFights: number; // number of fights reduced — the report header's fight denominator
  effectiveMoves: number | null; // exp(Shannon entropy) of the pooled shares (Hill q=1) — "N of 13 in rotation"; null when totalCommitments is 0
};

// The full variety report — the pooled histogram enriched with per-bot attribution (adoption
// + mean share on every row) and the population size (the N each row's adoption is out of),
// plus the opener win-rates (the second DESIGN §P7 dial) and the null-opener count.
export type VarietyReport = Omit<PooledReport, "rows"> & {
  rows: UsageRow[];
  botCount: number; // population size — the denominator of every row's adoption k/N
  openers: OpenerRow[]; // per-opener win-rates, sorted win% desc → opens desc → canonical
  nullOpeners: number; // (fighter, fight) observations that opened with no honoured commitment
  degrades: DegradeRow[]; // per-technique start-failure rates, sorted rate desc → attempts desc → canonical
  occupancy: OccupancyRow[]; // reach-zone distance occupancy, in fixed near→far order (S3b)
};

// The technique a frame's action commits to, or null when the action is not a
// technique commitment (idle / move / block / crouch / jump / throw-break).
const techniqueOf = (action: Action): Technique | null => {
  if (action.type === "attack") return action.move;
  if (action.type === "throw") return "throw";
  if (action.type === "sweep") return "sweep";

  return null;
};

// The technique a frame HONOURED this tick: its committed technique when the action
// took effect (`degrade === null`), else null (a degraded or non-committing frame).
const honouredTechnique = (frame: FighterFrame): Technique | null =>
  frame.degrade === null ? techniqueOf(frame.action) : null;

export const reduceUsage = (fights: readonly FightResult[]): PooledReport => {
  // Every honoured commitment across every fight, both fighters, flattened.
  const honoured = fights.flatMap((fight) =>
    fight.events.flatMap((event) =>
      [event.a, event.b].flatMap((frame) => {
        const technique = honouredTechnique(frame);

        return technique === null ? [] : [technique];
      }),
    ),
  );

  const totalCommitments = honoured.length;

  const rows = TECHNIQUES.map((technique) => {
    const count = honoured.filter((t) => t === technique).length;
    const share = totalCommitments === 0 ? 0 : count / totalCommitments;

    return { technique, count, share, dominant: share > USAGE_FLAG_THRESHOLD };
  });

  // Effective-move-count = exp(Shannon entropy) of the pooled distribution (Hill q=1):
  // "how many of the 13 techniques are effectively in rotation" (even 13-way ⇒ 13, total
  // collapse ⇒ 1). The `share > 0` guard skips the 0·ln0 term (= 0); with no commitments
  // there is no distribution, so the count is null (not 0, not NaN).
  const entropy = rows.reduce(
    (h, r) => (r.share > 0 ? h - r.share * Math.log(r.share) : h),
    0,
  );

  const effectiveMoves = totalCommitments === 0 ? null : Math.exp(entropy);

  // `rows` is already in canonical (frame-table) order, so a STABLE sort by share
  // descending keeps equal-share techniques in canonical order — the tie-break comes
  // for free, with no index arithmetic to get wrong.
  return {
    rows: [...rows].sort((a, b) => b.share - a.share),
    totalCommitments,
    totalFights: fights.length,
    effectiveMoves,
  };
};

// The reference population + run parameters for a variety sweep. `population` is the
// roster whose usage we profile (the 6 frozen gauntlet bots by default; a wider
// override arrives with S1b). The seeds / tick cap / rules / match mode thread
// straight into `runFight`, exactly as the benchmark manifest supplies them.
export type VarietyConfig = {
  population: readonly BotDoc[];
  seeds: readonly number[];
  maxTicks: number;
  rules: Rules;
  match?: FightConfig["match"];
};

// A single round-robin matchup: the two population indices that fought (`a` on side A,
// `b` on side B) and the resulting fight. Carries the bot identity a bare `FightResult`
// lacks, so per-bot attribution can credit each honoured commitment to the bot that made it.
export type Matchup = {
  a: number;
  b: number;
  fight: FightResult;
};

// Per-technique per-bot attribution: how many distinct bots adopted the technique, and the
// mean — over participating bots — of each bot's own share of it.
export type Attribution = {
  adoptingBots: number;
  meanShare: number | null;
};

// Reduce the bot-attributed matchups to a per-technique attribution lookup. A bot ADOPTS a
// technique if it honoured it ≥once across all its fights — counted once, tempo-blind (a
// spammer and a one-time user both count as one adopter). The MEAN SHARE weights every
// participating bot equally: the mean of each bot's own fraction of its honoured commitments
// spent on the technique. A bot that never commits has no arsenal distribution and is
// excluded from the mean (null when nobody committed anything). Pure + honoured-only.
export const reducePerBot = (
  matchups: readonly Matchup[],
  botCount: number,
): ((technique: Technique) => Attribution) => {
  // Every honoured commitment as (bot index, technique) — both fighters, every fight;
  // frames that honoured nothing (technique null) drop out.
  const commitments = matchups.flatMap(({ a, b, fight }) =>
    fight.events.flatMap((event) =>
      [
        { bot: a, technique: honouredTechnique(event.a) },
        { bot: b, technique: honouredTechnique(event.b) },
      ].filter(
        (c): c is { bot: number; technique: Technique } => c.technique !== null,
      ),
    ),
  );

  // Each bot's own honoured commitments (its arsenal distribution), indexed by position.
  const perBot = Array.from({ length: botCount }, (_, bot) => {
    const mine = commitments.filter((c) => c.bot === bot);

    return {
      total: mine.length,
      countOf: (technique: Technique) =>
        mine.filter((c) => c.technique === technique).length,
    };
  });

  return (technique) => {
    const adoptingBots = perBot.filter(
      (pb) => pb.countOf(technique) > 0,
    ).length;

    const participating = perBot.filter((pb) => pb.total > 0);

    const meanShare =
      participating.length === 0
        ? null
        : participating.reduce(
            (sum, pb) => sum + pb.countOf(technique) / pb.total,
            0,
          ) / participating.length;

    return { adoptingBots, meanShare };
  };
};

// An opener whose win-rate strictly exceeds this fraction is a §P7 dominance candidate
// (the "no opener > ~60% win" balance target) — but only once it clears the sample floor.
export const OPENER_FLAG_THRESHOLD = 0.6;

// The minimum opens an opener needs before its win-rate can be flagged. Over a small
// hand-authored population a move opened once and won reads 100%; gating the flag on a
// sample floor keeps that noise from tripping a false alarm. A retunable named constant.
export const MIN_OPENER_SAMPLE = 10;

// A per-opener row: the win/loss/draw split of the fights a technique OPENED (was a
// fighter's first honoured commitment in), the resulting win-rate, and whether it is a
// sample-gated §P7 dominance candidate.
export type OpenerRow = {
  technique: Technique;
  opens: number; // (fighter, fight) observations that opened with this technique
  wins: number;
  losses: number;
  draws: number;
  winRate: number | null; // wins / opens (raw fraction in [0, 1]); null when opens === 0 (÷0 guard)
  dominant: boolean; // winRate > OPENER_FLAG_THRESHOLD AND opens >= MIN_OPENER_SAMPLE
};

// The opener reduction: the per-technique rows (all 13, sorted) + the count of
// (fighter, fight) observations that had no opener at all (a pure turtle).
export type OpenerReport = {
  rows: OpenerRow[];
  nullOpeners: number;
};

type Outcome = "win" | "loss" | "draw";

// The outcome for the fighter on `side` of a fight: win when it is the winner, draw when
// the bout was level, else loss — the per-fighter view of `FightResult.winner`.
const outcomeFor = (winner: FightResult["winner"], side: "A" | "B"): Outcome =>
  winner === "draw" ? "draw" : winner === side ? "win" : "loss";

// The technique a fighter OPENED a fight with: its FIRST honoured commitment across the
// fight's frames, or null when it never honoured one (a pure turtle — no opener).
const openerOf = (frames: readonly FighterFrame[]): Technique | null =>
  frames.map(honouredTechnique).find((t) => t !== null) ?? null;

// Reduce the bot-attributed matchups to per-opener win-rates. Each fight yields two
// observations — one per fighter — pairing that fighter's opener (its first honoured
// commitment, `openerOf`) with its outcome (`outcomeFor`). Turtles that honour nothing
// have a NULL opener: excluded from every row, counted in `nullOpeners`. A draw is never
// a win but stays in each opener's denominator. Pure + honoured-only.
export const reduceOpeners = (matchups: readonly Matchup[]): OpenerReport => {
  const observations = matchups.flatMap(({ fight }) => [
    {
      opener: openerOf(fight.events.map((e) => e.a)),
      outcome: outcomeFor(fight.winner, "A"),
    },
    {
      opener: openerOf(fight.events.map((e) => e.b)),
      outcome: outcomeFor(fight.winner, "B"),
    },
  ]);

  const nullOpeners = observations.filter((o) => o.opener === null).length;

  // One row per technique, in canonical order. A null-opener observation matches no
  // technique here (its opener is null), so it is excluded from every row and lives only
  // in `nullOpeners` above — no separate pre-filter needed.
  const rows = TECHNIQUES.map((technique) => {
    const mine = observations.filter((o) => o.opener === technique);
    const opens = mine.length;
    const wins = mine.filter((o) => o.outcome === "win").length;
    const losses = mine.filter((o) => o.outcome === "loss").length;
    const draws = mine.filter((o) => o.outcome === "draw").length;
    const winRate = opens === 0 ? null : wins / opens;

    return {
      technique,
      opens,
      wins,
      losses,
      draws,
      winRate,
      // Sample floor FIRST so the short-circuit guards the divide — a below-floor (incl.
      // 0-open) technique never evaluates `wins / opens`, so no ÷0 and no null to test.
      dominant:
        opens >= MIN_OPENER_SAMPLE && wins / opens > OPENER_FLAG_THRESHOLD,
    };
  });

  // Row order: the LIVE openers (a real win-rate) first — win-rate descending, ties broken
  // by opens descending (better-sampled first), then canonical order (the filter keeps
  // TECHNIQUES order and the sort is stable). Then the never-opened techniques (`winRate
  // null`, opens 0) in canonical order. Splitting live from dead keeps every branch load-
  // bearing (the row count + order pin it) and needs no null sentinel in the comparator.
  const live = rows
    .filter((r): r is OpenerRow & { winRate: number } => r.winRate !== null)
    .sort((a, b) => b.winRate - a.winRate || b.opens - a.opens);

  const dead = rows.filter((r) => r.winRate === null);

  return { rows: [...live, ...dead], nullOpeners };
};

// The four DegradeReasons that count as a START FAILURE — a neutral fighter chose a
// technique but a legality / affordability / context gate refused it (`sim.ts:508` — the
// move never starts, degrading to idle). `locked` is deliberately NOT here: it is a busy
// fighter's ignored input while committed to an already-honoured move (`sim.ts:512`), not
// a failed pick, so it is excluded from the whole rate. `satisfies` keeps the tuple honest
// — if `sim.ts` adds a reason, it surfaces as a compile error to classify (gate-failure vs
// commitment-artifact), never a silent drop. The tuple order is the report's column order.
export const FAILURE_REASONS = [
  "out-of-band",
  "unaffordable",
  "wrong-context",
  "inert",
] as const satisfies readonly DegradeReason[];

export type FailureReason = (typeof FAILURE_REASONS)[number];

// A per-technique start-failure row: how often choosing the move as a neutral START
// bounced off a gate, and via which gate. `attempts = honoured + failedStarts` (both
// exclude `locked`); `honoured` equals reduceUsage's count, so the two sections reconcile.
export type DegradeRow = {
  technique: Technique;
  attempts: number; // honoured(X) + failedStarts(X); `locked` frames excluded
  failedStarts: number; // frames X chosen & gate-failed with a FailureReason
  rate: number | null; // failedStarts / attempts (raw fraction in [0, 1]); null when attempts === 0
  reasons: Record<FailureReason, number>; // per-reason failedStarts; sums to failedStarts
};

// Reduce a set of fights to per-technique start-failure rows. For each technique, a START
// attempt is a frame that CHOSE it and was not `locked` (a busy fighter's ignored input —
// excluded from BOTH numerator and denominator); a non-null degrade on such a frame is a
// gate FAILURE (keyed by reason). Filtering per technique (rather than an intermediate
// observation list) keeps both guards load-bearing on the counts: `techniqueOf === X`
// naturally drops non-committing frames, and `!== "locked"` directly moves `attempts`.
// Pure — no bot identity or outcome needed.
export const reduceDegrades = (
  fights: readonly FightResult[],
): DegradeRow[] => {
  const frames = fights.flatMap((fight) =>
    fight.events.flatMap((event) => [event.a, event.b]),
  );

  const rows = TECHNIQUES.map((technique) => {
    // Frames that CHOSE this technique and were not `locked` — the start attempts.
    const attemptFrames = frames.filter(
      (f) => techniqueOf(f.action) === technique && f.degrade !== "locked",
    );

    const attempts = attemptFrames.length;

    // A gate FAILURE is a non-null degrade (`locked` already excluded above). Counted
    // independently of the per-reason split, so the "sums to failedStarts" invariant is a
    // real cross-check (a dropped reason bucket breaks it).
    const failedStarts = attemptFrames.filter((f) => f.degrade !== null).length;

    const count = (r: FailureReason) =>
      attemptFrames.filter((f) => f.degrade === r).length;

    const reasons: Record<FailureReason, number> = {
      "out-of-band": count("out-of-band"),
      unaffordable: count("unaffordable"),
      "wrong-context": count("wrong-context"),
      inert: count("inert"),
    };

    return {
      technique,
      attempts,
      failedStarts,
      rate: attempts === 0 ? null : failedStarts / attempts,
      reasons,
    };
  });

  // Row order (mirrors reduceOpeners): the LIVE rows (a real rate — attempts > 0) first,
  // rate descending, ties broken by attempts descending (better-sampled first), then
  // canonical order (the filter keeps TECHNIQUES order and the sort is stable). Then the
  // never-attempted techniques (`rate null`) in canonical order. Splitting live from dead
  // keeps every branch load-bearing (row count + order pin it) with no null sentinel in
  // the comparator.
  const live = rows
    .filter((r): r is DegradeRow & { rate: number } => r.rate !== null)
    .sort((a, b) => b.rate - a.rate || b.attempts - a.attempts);

  const dead = rows.filter((r) => r.rate === null);

  return [...live, ...dead];
};

// S3b: reach-zone occupancy. Inter-fighter distance (|a.x − b.x|, sub-units) is partitioned
// into 5 coarse tiers, listed in this FIXED near→far order — the render honours it (no
// share-sort: the distance axis is intrinsically ordered).
export const REACH_ZONES = ["clinch", "hand", "kick", "poke", "out"] as const;
export type ReachZone = (typeof REACH_ZONES)[number];

// The four cut points partitioning distance into the five REACH_ZONES: a distance
// < ZONE_UPPER[i] (and ≥ the prior cut) is REACH_ZONES[i]; one ≥ the last cut (330k) is
// `out` (beyond all reach). Half-open [lo, hi): a distance ON a cut lands in the HIGHER tier.
// The cuts are the throw / reverse-punch / roundhouse+startGap / ushiro reach rungs (rules.ts)
// — the reach ladder, not magic literals.
const ZONE_UPPER = [120000, 240000, 300000, 330000] as const;

// The reach tier a distance falls in: the first tier whose cut it is below; a distance at or
// beyond the last cut is the open-ended `out` tier.
const zoneOf = (distance: number): ReachZone => {
  const i = ZONE_UPPER.findIndex((upper) => distance < upper);

  return i === -1 ? "out" : REACH_ZONES[i];
};

export type OccupancyRow = {
  zone: ReachZone; // one of the 5 tiers — all always present, in fixed near→far order
  frames: number; // ticks whose |a.x − b.x| fell in this tier
  share: number | null; // frames / totalFrames (raw); null when totalFrames === 0 (÷0 → "n/a")
};

// Reduce the fights to reach-zone distance occupancy. ONE sample per tick — |a.x − b.x| is
// symmetric, so a tick contributes a single distance (NOT one per fighter), and the
// denominator is the total tick count. All frames count (a forced yame-reset or okizeme
// position is genuine spacing). Pure over `runFight`, reading only `.x`.
export const reduceOccupancy = (
  fights: readonly FightResult[],
): OccupancyRow[] => {
  const distances = fights.flatMap((fight) =>
    fight.events.map((event) => Math.abs(event.a.x - event.b.x)),
  );

  const totalFrames = distances.length;

  return REACH_ZONES.map((zone) => {
    const frames = distances.filter((d) => zoneOf(d) === zone).length;

    return {
      zone,
      frames,
      share: totalFrames === 0 ? null : frames / totalFrames,
    };
  });
};

// Run the both-sides round-robin over the population — each ordered pair of NON-mirror
// bots plays with each on each side, at every seed — then reduce the fights to the pooled
// usage histogram AND attribute per-bot adoption / mean share. Pure over `runFight`: no
// I/O, deterministic per config.
//
// A pairing is skipped when the two docs are byte-identical (`sameDoc`): that subsumes a
// bot against itself (a doc trivially equals its own) AND against any duplicate a supplied
// population might hold — a clone-vs-clone bout is a meaningless mirror that only pads the
// histogram, so a dup fights every NON-clone opponent but never a byte-identical twin.
export const runVariety = (cfg: VarietyConfig): VarietyReport => {
  const matchups = cfg.population.flatMap((botA, a) =>
    cfg.population.flatMap((botB, b) =>
      sameDoc(botA, botB)
        ? []
        : cfg.seeds.map((seed) => ({
            a,
            b,
            fight: runFight({
              rules: cfg.rules,
              botA,
              botB,
              maxTicks: cfg.maxTicks,
              seed,
              match: cfg.match,
            }),
          })),
    ),
  );

  const fights = matchups.map((m) => m.fight);
  const pooled = reduceUsage(fights);
  const attributionOf = reducePerBot(matchups, cfg.population.length);
  const openers = reduceOpeners(matchups);

  return {
    ...pooled,
    botCount: cfg.population.length,
    rows: pooled.rows.map((r) => ({ ...r, ...attributionOf(r.technique) })),
    openers: openers.rows,
    nullOpeners: openers.nullOpeners,
    degrades: reduceDegrades(fights),
    occupancy: reduceOccupancy(fights),
  };
};
