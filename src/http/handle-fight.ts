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

  // Empty throne: crown the clearer as this version's first champion (the bootstrap).
  if (current === undefined) {
    await deps.store.compareAndSwap(deps.version, null, {
      champion: parsed.doc,
      generation: 1,
    });

    return json({ ...report, title: { outcome: "throne-empty-crowned" } });
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

  // Crown appends the challenger to the lineage at the next generation. The CAS result
  // is not consumed this slice; the "throne moved" → 409 race is slice 3.
  if (dethroned) {
    await deps.store.compareAndSwap(deps.version, current.generation, {
      champion: parsed.doc,
      generation: current.generation + 1,
    });
  }

  return json({
    ...report,
    title: {
      outcome: dethroned ? "crowned" : "king-retained",
      winRate: titleFight.winRate,
      seeds,
      bouts: titleFight.totalFights,
    },
  });
};
