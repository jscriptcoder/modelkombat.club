// The gauntlet-gate endpoint — `POST /fight`. A Vercel serverless function
// (Web-standard `fetch` handler) that scores a submitted bot against the frozen
// gauntlet and returns the compact egocentric report (decisions §API response
// contract). Stateless: no throne yet (that is S4).
//
// Pure transport + orchestration over the canonical, deterministic engine
// (invariant #2 — no DSL op): the shared `readValidatedBot` envelope gates the
// request, `benchmark()` runs the frozen manifest (fixed disclosed seeds), and
// `buildFightReport` reshapes the result. The gauntlet is loaded once per cold
// start — same roster/files/version the CLI runner uses.
//
// Routing: `vercel.json` rewrites the public path -> `/api/fight` and carries
// `includeFiles: "bots/*.json"` so the gauntlet docs are in the bundle. Not yet
// advertised in `GET /spec` — internal-only until the rate-limit lands (S3 S4).
import { readValidatedBot } from "../src/http/envelope.js";
import { buildFightReport } from "../src/http/fight-report.js";
import { loadGauntlet } from "../src/http/gauntlet.js";
import { benchmark } from "../src/engine/benchmark.js";
import { CANONICAL_RULES } from "../src/engine/rules.js";
import {
  BENCHMARK_VERSION,
  GAUNTLET_NAMES,
  MATCH,
  MAX_TICKS,
  SEEDS,
} from "../src/engine/benchmark-config.js";

const gauntlet = loadGauntlet();

export default {
  async fetch(req: Request): Promise<Response> {
    const parsed = await readValidatedBot(req, "/fight");

    if (parsed instanceof Response) return parsed;

    const result = benchmark({
      bot: parsed.doc,
      gauntlet,
      seeds: SEEDS,
      maxTicks: MAX_TICKS,
      rules: CANONICAL_RULES,
      match: MATCH,
    });

    const report = buildFightReport(result, {
      version: BENCHMARK_VERSION,
      seeds: SEEDS,
      gauntletNames: GAUNTLET_NAMES,
    });

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  },
};
