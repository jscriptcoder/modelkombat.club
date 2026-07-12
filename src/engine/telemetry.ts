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

export type UsageRow = {
  technique: Technique;
  count: number; // honoured commitments of this technique, pooled over both fighters
  share: number; // count / totalCommitments (raw fraction in [0, 1]); 0 when total is 0
  dominant: boolean; // share strictly > USAGE_FLAG_THRESHOLD
};

export type VarietyReport = {
  rows: UsageRow[]; // all 13 techniques, sorted share-desc then canonical order
  totalCommitments: number; // Σ counts — the histogram denominator
  totalFights: number; // number of fights reduced — the report header's fight denominator
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

export const reduceUsage = (fights: readonly FightResult[]): VarietyReport => {
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

  // `rows` is already in canonical (frame-table) order, so a STABLE sort by share
  // descending keeps equal-share techniques in canonical order — the tie-break comes
  // for free, with no index arithmetic to get wrong.
  return {
    rows: [...rows].sort((a, b) => b.share - a.share),
    totalCommitments,
    totalFights: fights.length,
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

// Run the both-sides round-robin over the population — every ordered distinct-index
// pair (`i ≠ j`, so each matchup plays with each bot on each side; a bot is never
// fought against itself) at every seed — and reduce the resulting fights to the
// pooled usage histogram. Pure over `runFight`: no I/O, deterministic per config.
export const runVariety = (cfg: VarietyConfig): VarietyReport => {
  const fights = cfg.population.flatMap((botA, i) =>
    cfg.population.flatMap((botB, j) =>
      i === j
        ? []
        : cfg.seeds.map((seed) =>
            runFight({
              rules: cfg.rules,
              botA,
              botB,
              maxTicks: cfg.maxTicks,
              seed,
              match: cfg.match,
            }),
          ),
    ),
  );

  return reduceUsage(fights);
};
