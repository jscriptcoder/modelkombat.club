// The `/fight` orchestration seam — the request→gate→throne flow, extracted from
// `api/fight.ts` so the throne store and arena config are INJECTABLE (the S4
// dependency seam). `api/fight.ts` becomes a thin wrapper supplying production
// deps. Pure transport + orchestration over the deterministic engine (`benchmark`)
// and the platform-layer throne store — no DSL op, TCB untouched (invariant #2).
import { championIdentity } from "./champion-identity.js";
import { problem, readValidatedBot } from "./envelope.js";
import { buildFightReport, toTitleFightReport } from "./fight-report.js";
import type { ThroneRecord, ThroneStore } from "./throne-store.js";
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

// Attempt an atomic crown. Returns the 409 problem to surface on a lost CAS race (the
// throne moved since `read`), or `undefined` when the crown landed and the caller should
// proceed. The "on moved → this 409" knowledge lives here once, shared by both crown
// sites (the empty-throne bootstrap and the title-fight dethrone).
const crown = async (
  store: ThroneStore,
  version: string,
  expected: number | null,
  next: ThroneRecord,
): Promise<Response | undefined> => {
  const result = await store.compareAndSwap(version, expected, next);

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

  const current = await deps.store.read(deps.version);

  // Empty throne: crown the clearer as this version's first champion (the bootstrap).
  if (current === undefined) {
    const moved = await crown(deps.store, deps.version, null, {
      champion: parsed.doc,
      generation: 1,
      handle,
    });

    return (
      moved ?? json({ ...report, title: { outcome: "throne-empty-crowned" } })
    );
  }

  // Occupied throne: contest a fresh-seeded title fight against the reigning champion.
  const seeds = deps.freshSeeds();

  const titleFight = benchmark({
    bot: parsed.doc,
    gauntlet: [current.champion],
    seeds,
    maxTicks: deps.maxTicks,
    rules: deps.rules,
    match: deps.match,
  });

  // Dethrone strictly on > 0.5. A level (= 0.5) or losing fight — including a mirror,
  // which `benchmark` skips to winRate 0 — leaves the King on the throne.
  const dethroned = titleFight.winRate > 0.5;

  // A win crowns the challenger at the next generation. A CAS race (the throne moved since
  // our read) surfaces as 409 throne-moved; the loser resubmits against the new King.
  if (dethroned) {
    const moved = await crown(deps.store, deps.version, current.generation, {
      champion: parsed.doc,
      generation: current.generation + 1,
      handle,
    });

    if (moved) return moved;
  }

  return json({
    ...report,
    title: {
      outcome: dethroned ? "crowned" : "king-retained",
      // Full championship-bout telemetry at gauntlet fidelity (net / win-loss-draw /
      // endReasons / degrade) so a challenger can diagnose WHY it lost the crown rather
      // than guess from a lone win-rate and regress its 6/6 gauntlet clearance.
      ...toTitleFightReport(titleFight),
      seeds,
      // Scout the King you fought (identity only, never the doc).
      incumbent: incumbentOf(current),
    },
  });
};
