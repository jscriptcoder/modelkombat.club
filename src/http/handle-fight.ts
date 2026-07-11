// The `/fight` orchestration seam — the request→gate→arena flow, extracted from
// `api/fight.ts` so the throne store and arena config are INJECTABLE (the S4
// dependency seam). `api/fight.ts` becomes a thin wrapper supplying production
// deps. Pure transport + orchestration over the deterministic engine (`benchmark`)
// and the platform-layer throne store — no DSL op, TCB untouched (invariant #2).
import { arenaStandings, pairIndices } from "./arena-standings.js";
import { championIdentity } from "./champion-identity.js";
import { problem, readValidatedBot } from "./envelope.js";
import { buildFightReport, toTitleFightReport } from "./fight-report.js";
import { rankArena, type Standing } from "./rank-arena.js";
import { lineageEntryOf } from "./throne-store.js";
import type {
  ArenaMember,
  ArenaRecord,
  ThroneRecord,
  ThroneStore,
} from "./throne-store.js";
import {
  benchmark,
  type BenchmarkConfig,
  type BenchmarkResult,
} from "../engine/benchmark.js";
import type { BotDoc } from "../engine/dsl.js";
import type { Rules } from "../engine/types.js";

// Everything the handler needs, injected: the arena (gauntlet + run config + the
// version key the throne is scoped to + the frozen top-N cap) and the throne store.
// Tests inject a small idle gauntlet + a fresh in-memory store; `api/fight.ts` supplies
// the frozen manifest + the production store.
export type FightDeps = {
  gauntlet: BotDoc[];
  gauntletNames: readonly string[];
  seeds: readonly number[];
  maxTicks: number;
  rules: Rules;
  match?: BenchmarkConfig["match"];
  version: string;
  store: ThroneStore;
  // The frozen per-version arena cap (D4, default 3). The arena keeps the top `n` contestants;
  // #1 is King. It changes only with a version bump (which starts a fresh empty ladder).
  n: number;
};

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

// The RFC 9457 detail for a lost placement race — the arena moved between a caller's read and its
// atomic commit. The resolution is to resubmit against whichever arena landed first; there is no
// server-side auto-retry in v1.
const THRONE_MOVED_DETAIL =
  "The throne advanced to a new champion before your crown landed; resubmit to challenge the current King.";

// Attempt an atomic arena commit. Returns the 409 problem to surface on a lost CAS race (the
// arena moved since `readArena`), or `undefined` when the commit landed and the caller should
// proceed. The "on moved → this 409" knowledge lives here once, shared by both commit sites
// (the empty-arena bootstrap and a ranked placement).
const commit = async (
  store: ThroneStore,
  version: string,
  expected: number | null,
  next: ArenaRecord,
): Promise<Response | undefined> => {
  const result = await store.commitArena(version, expected, next);

  return result.ok
    ? undefined
    : problem(409, "/problems/throne-moved", THRONE_MOVED_DETAIL);
};

// The author handle is a REQUIRED, opaque, unverified label: at most 64 characters and
// free of control characters (NUL/CR/LF never arrive — the Headers transport blocks them
// — but DEL and the other C0 controls pass through, so the guard is the handler's own).
// Every crowned King is attributed to a handle; there is no anonymous crown.
const HANDLE_MAX = 64;

const hasControlChar = (s: string): boolean =>
  [...s].some((c) => {
    const code = c.charCodeAt(0);

    return code < 0x20 || code === 0x7f;
  });

// Read the required `X-Author-Handle` header → the sanitized handle, or a `400` problem
// when it is absent/empty, over-length, or carries control characters. Runs before the
// gauntlet gate, so a missing or malformed handle is rejected cheaply and independently
// of whether the bot would clear.
const readHandle = (req: Request): Response | { handle: string } => {
  const raw = req.headers.get("x-author-handle");

  if (raw == null || raw === "") {
    return problem(
      400,
      "/problems/malformed-request",
      "The X-Author-Handle header is required — set it to the handle your fighter is credited under.",
    );
  }

  if (raw.length > HANDLE_MAX || hasControlChar(raw)) {
    return problem(
      400,
      "/problems/malformed-request",
      "The X-Author-Handle header must be at most 64 characters and contain no control characters.",
    );
  }

  return { handle: raw };
};

// The reigning champion's public identity — surfaced to a challenger so they can scout the King.
// Reuses the shared `championIdentity` shaper (identity only, never the doc; `model`/`handle`
// default to `null`) and drops the `generation`: the title block scouts the King, and the
// challenger has no use for the throne's CAS token.
const incumbentOf = (
  record: ThroneRecord,
): { name: string; model: string | null; handle: string | null } => {
  const { generation, ...identity } = championIdentity(record);

  return identity;
};

// Run the arena round-robin on the frozen version seeds (D-A: a deterministic tournament graph —
// each pair one permanent verdict) and reduce it to each contestant's Copeland win-count + Σ
// net-points (`arenaStandings`, the pure tally). The challenger fights every defender directly, and
// the King fight (defender #0) doubles as the title telemetry (D-C); the defenders' mutual fights
// (`pairIndices`) settle their order. Recompute-every-submission; the edge cache is deferred
// (cheap at N=3).
const roundRobin = (
  defenders: readonly ArenaMember[],
  challenger: ArenaMember,
  deps: FightDeps,
): {
  defenderStandings: Standing[];
  challengerStanding: Standing;
  kingFight: BenchmarkResult;
} => {
  const fight = (bot: BotDoc, opp: BotDoc): BenchmarkResult =>
    benchmark({
      bot,
      gauntlet: [opp],
      seeds: deps.seeds,
      maxTicks: deps.maxTicks,
      rules: deps.rules,
      match: deps.match,
    });

  // The challenger vs each defender (challenger as the bot) — direct win rate / net.
  const challengerFights = defenders.map((d) =>
    fight(challenger.champion, d.champion),
  );

  // Each unordered defender pair (i < j), with `i` as the bot.
  const defenderPairs = pairIndices(defenders.length).map(([i, j]) => ({
    i,
    j,
    result: fight(defenders[i].champion, defenders[j].champion),
  }));

  const { defenderStandings, challengerStanding } = arenaStandings({
    defenders,
    challenger,
    challengerFights,
    defenderPairs,
  });

  return {
    defenderStandings,
    challengerStanding,
    kingFight: challengerFights[0],
  };
};

export const handleFight = async (
  req: Request,
  deps: FightDeps,
): Promise<Response> => {
  const parsed = await readValidatedBot(req, "/fight");

  if (parsed instanceof Response) return parsed;

  // Reject a malformed author handle up front — before the (costlier) benchmark and
  // independently of whether the bot would clear the gate.
  const handleResult = readHandle(req);

  if (handleResult instanceof Response) return handleResult;

  const { handle } = handleResult;

  const result = benchmark({
    bot: parsed.doc,
    gauntlet: deps.gauntlet,
    seeds: deps.seeds,
    maxTicks: deps.maxTicks,
    rules: deps.rules,
    match: deps.match,
  });

  const report = buildFightReport(result, {
    version: deps.version,
    seeds: deps.seeds,
    gauntletNames: deps.gauntletNames,
  });

  // Failed the gate: plain gauntlet report, no title, arena untouched.
  if (!report.cleared) return json(report);

  const arena = await deps.store.readArena(deps.version);

  // Empty arena: bootstrap-crown the clearer as this version's first champion (arena #1 at
  // generation 1, seniority 1). `commitArena` also appends it to the crowning lineage.
  if (arena === undefined) {
    const challenger: ArenaMember = {
      champion: parsed.doc,
      handle,
      seniority: 1,
    };

    const moved = await commit(deps.store, deps.version, null, {
      members: [challenger],
      generation: 1,
      nextSeniority: 2,
    });

    return moved ?? json({ ...report, title: { outcome: "crowned", rank: 1 } });
  }

  // Full arena: unplaced placeholder — a clearer against a full arena does not place, and the arena
  // is untouched (no fight, no commit). Relegation-once-full is S2.2 (the D-D placeholder).
  if (arena.members.length >= deps.n) {
    return json({ ...report, title: { outcome: "unplaced" } });
  }

  // Non-full arena (C2 join-if-room): rank the challenger against the current defenders via a
  // round-robin, keep the top N (all of them while filling), #1 is King. The entrant is stamped
  // with the next per-version seniority.
  const challenger: ArenaMember = {
    champion: parsed.doc,
    handle,
    seniority: arena.nextSeniority,
  };

  const { defenderStandings, challengerStanding, kingFight } = roundRobin(
    arena.members,
    challenger,
    deps,
  );

  const placement = rankArena({
    defenders: defenderStandings,
    challenger: challengerStanding,
  });

  // Every filling placement mutates the arena at the next generation. A CAS race (the arena moved
  // since our read) surfaces as 409 throne-moved; the loser resubmits against the new arena.
  const moved = await commit(deps.store, deps.version, arena.generation, {
    members: placement.members,
    generation: arena.generation + 1,
    nextSeniority: arena.nextSeniority + 1,
  });

  if (moved) return moved;

  return json({
    ...report,
    title: {
      outcome: placement.outcome,
      rank: placement.rank,
      // Full championship-bout telemetry vs the reigning King (arena #1 you fought) at gauntlet
      // fidelity (net / win-loss-draw / endReasons / degrade) so a challenger can diagnose its
      // placement rather than guess from a lone win-rate. The full per-defender board is S4.
      ...toTitleFightReport(kingFight),
      // Scout the King you fought (identity only, never the doc) — arena #1 at read time.
      incumbent: incumbentOf(lineageEntryOf(arena)),
    },
  });
};
