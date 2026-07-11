// The `/fight` orchestration seam — the request→gate→throne flow, extracted from
// `api/fight.ts` so the throne store and arena config are INJECTABLE (the S4
// dependency seam). `api/fight.ts` becomes a thin wrapper supplying production
// deps. Pure transport + orchestration over the deterministic engine (`benchmark`)
// and the platform-layer throne store — no DSL op, TCB untouched (invariant #2).
import { championIdentity } from "./champion-identity.js";
import { problem, readValidatedBot } from "./envelope.js";
import { buildFightReport, toTitleFightReport } from "./fight-report.js";
import { rankArena } from "./rank-arena.js";
import { lineageEntryOf } from "./throne-store.js";
import type {
  ArenaMember,
  ArenaRecord,
  ThroneRecord,
  ThroneStore,
} from "./throne-store.js";
import { benchmark, type BenchmarkConfig } from "../engine/benchmark.js";
import type { BotDoc } from "../engine/dsl.js";
import type { Rules } from "../engine/types.js";

// Everything the handler needs, injected: the arena (gauntlet + run config + the
// version key the throne is scoped to) and the throne store. Tests inject a small
// idle gauntlet + a fresh in-memory store; `api/fight.ts` supplies the frozen
// manifest + the production store.
export type FightDeps = {
  gauntlet: BotDoc[];
  gauntletNames: readonly string[];
  seeds: readonly number[];
  maxTicks: number;
  rules: Rules;
  match?: BenchmarkConfig["match"];
  version: string;
  store: ThroneStore;
  // The title fight's fresh seeds. Prod draws 10 from Web Crypto (CSPRNG — API-layer
  // entropy OUTSIDE the pure sim, invariant #1 intact); tests inject a fixed list for
  // determinism. Recorded in the `title` block so the title fight replays byte-identically.
  freshSeeds: () => readonly number[];
};

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

// The RFC 9457 detail for a lost crowning race — the throne moved between a caller's read
// and its atomic swap. The resolution is to resubmit against whichever King landed first;
// there is no server-side auto-retry in v1.
const THRONE_MOVED_DETAIL =
  "The throne advanced to a new champion before your crown landed; resubmit to challenge the current King.";

// Attempt an atomic arena commit. Returns the 409 problem to surface on a lost CAS race (the
// arena moved since `readArena`), or `undefined` when the commit landed and the caller should
// proceed. The "on moved → this 409" knowledge lives here once, shared by both commit sites
// (the empty-arena bootstrap and a title-fight placement).
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

// The reigning champion's public identity — surfaced to a title challenger so they can
// scout the King. Reuses the shared `championIdentity` shaper (identity only, never the
// doc; `model`/`handle` default to `null`) and drops the `generation`: the title block
// scouts the King, and the challenger has no use for the throne's CAS token.
const incumbentOf = (
  record: ThroneRecord,
): { name: string; model: string | null; handle: string | null } => {
  const { generation, ...identity } = championIdentity(record);

  return identity;
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

  // Failed the gate: plain gauntlet report, no title, throne untouched (S3 behaviour).
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

    return (
      moved ?? json({ ...report, title: { outcome: "throne-empty-crowned" } })
    );
  }

  // Occupied arena: contest a fresh-seeded title fight against the reigning champion (arena #1).
  const seeds = deps.freshSeeds();
  const king = arena.members[0];

  const titleFight = benchmark({
    bot: parsed.doc,
    gauntlet: [king.champion],
    seeds,
    maxTicks: deps.maxTicks,
    rules: deps.rules,
    match: deps.match,
  });

  // Rank the challenger against the arena and keep the top N (N=1). It crowns iff it beat the
  // King strictly > 0.5; a level (= 0.5) or losing fight — including a mirror `benchmark` skips
  // to winRate 0 — retains the King. The entrant is stamped with the next seniority.
  const challenger: ArenaMember = {
    champion: parsed.doc,
    handle,
    seniority: arena.nextSeniority,
  };

  const ranked = rankArena({
    arena: arena.members,
    challenger,
    winRates: [titleFight.winRate],
  });

  // A placement commits the new arena at the next generation. A CAS race (the arena moved since
  // our read) surfaces as 409 throne-moved; the loser resubmits against the new arena.
  if (ranked.placed) {
    const moved = await commit(deps.store, deps.version, arena.generation, {
      members: ranked.members,
      generation: arena.generation + 1,
      nextSeniority: arena.nextSeniority + 1,
    });

    if (moved) return moved;
  }

  return json({
    ...report,
    title: {
      outcome: ranked.placed ? "crowned" : "king-retained",
      // Full championship-bout telemetry at gauntlet fidelity (net / win-loss-draw /
      // endReasons / degrade) so a challenger can diagnose WHY it lost the crown rather
      // than guess from a lone win-rate and regress its 6/6 gauntlet clearance.
      ...toTitleFightReport(titleFight),
      seeds,
      // Scout the King you fought (identity only, never the doc) — arena #1 as a
      // ThroneRecord (via `lineageEntryOf`) feeds the shared identity shaper.
      incumbent: incumbentOf(lineageEntryOf(arena)),
    },
  });
};
