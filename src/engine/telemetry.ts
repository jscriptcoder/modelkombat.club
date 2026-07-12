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
  type FightConfig,
  type FightResult,
  type FighterFrame,
} from "./sim.js";
import type { BotDoc } from "./dsl.js";

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
// + mean share on every row) and the population size (the N each row's adoption is out of).
export type VarietyReport = Omit<PooledReport, "rows"> & {
  rows: UsageRow[];
  botCount: number; // population size — the denominator of every row's adoption k/N
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

// Run the both-sides round-robin over the population — every ordered distinct-index
// pair (`a ≠ b`, so each matchup plays with each bot on each side; a bot is never
// fought against itself) at every seed — then reduce the fights to the pooled usage
// histogram AND attribute per-bot adoption / mean share. Pure over `runFight`: no I/O,
// deterministic per config.
export const runVariety = (cfg: VarietyConfig): VarietyReport => {
  const matchups = cfg.population.flatMap((botA, a) =>
    cfg.population.flatMap((botB, b) =>
      a === b
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

  const pooled = reduceUsage(matchups.map((m) => m.fight));
  const attributionOf = reducePerBot(matchups, cfg.population.length);

  return {
    ...pooled,
    botCount: cfg.population.length,
    rows: pooled.rows.map((r) => ({ ...r, ...attributionOf(r.technique) })),
  };
};
