// The `/fight` orchestration seam — the request→gate→throne flow, extracted from
// `api/fight.ts` so the throne store and arena config are INJECTABLE (the S4
// dependency seam). `api/fight.ts` becomes a thin wrapper supplying production
// deps. Pure transport + orchestration over the deterministic engine (`benchmark`)
// and the platform-layer throne store — no DSL op, TCB untouched (invariant #2).
import { readValidatedBot } from "./envelope.js";
import { buildFightReport } from "./fight-report.js";
import type { ThroneStore } from "./throne-store.js";
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
};

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export const handleFight = async (
  req: Request,
  deps: FightDeps,
): Promise<Response> => {
  const parsed = await readValidatedBot(req, "/fight");

  if (parsed instanceof Response) return parsed;

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

  // Occupied throne: the title fight is slice 2. For now a clearer against an
  // occupied throne gets the plain report (no title block yet).
  if (current !== undefined) return json(report);

  // Empty throne: crown the clearer as this version's first champion.
  await deps.store.compareAndSwap(deps.version, null, {
    champion: parsed.doc,
    generation: 1,
  });

  return json({ ...report, title: { outcome: "throne-empty-crowned" } });
};
