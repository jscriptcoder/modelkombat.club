// The `POST /fight` endpoint — a Vercel serverless function (Web-standard `fetch`
// handler). A THIN wrapper: it wires the production dependencies (the frozen
// gauntlet manifest + the throne store) and delegates the request→gate→throne flow
// to `handleFight` in `src/http/` — the injectable seam the S4 tests drive with a
// small idle gauntlet + a fresh in-memory store.
//
// Pure transport + orchestration over the canonical, deterministic engine
// (invariant #2 — no DSL op): the shared envelope gates the request, `benchmark()`
// runs the frozen manifest (fixed disclosed seeds), and — for a clearer — the
// version-scoped KotH throne is contested. The gauntlet is loaded once per cold
// start (same roster/files/version the CLI runner uses).
//
// The throne store is the in-memory fake for now (per-instance, non-durable); the
// real Upstash-Redis adapter lands in slice 5 and swaps in behind the same port
// via env config. Routing: `vercel.json` rewrites the public path -> `/api/fight`
// with `includeFiles: "bots/*.json"` so the gauntlet docs are in the bundle.
import { handleFight } from "../src/http/handle-fight.js";
import { inMemoryThroneStore } from "../src/http/throne-store.js";
import { loadGauntlet } from "../src/http/gauntlet.js";
import { CANONICAL_RULES } from "../src/engine/rules.js";
import {
  BENCHMARK_VERSION,
  GAUNTLET_NAMES,
  MATCH,
  MAX_TICKS,
  SEEDS,
} from "../src/engine/benchmark-config.js";

const gauntlet = loadGauntlet();
const store = inMemoryThroneStore();

export default {
  fetch(req: Request): Promise<Response> {
    return handleFight(req, {
      gauntlet,
      gauntletNames: GAUNTLET_NAMES,
      seeds: SEEDS,
      maxTicks: MAX_TICKS,
      rules: CANONICAL_RULES,
      match: MATCH,
      version: BENCHMARK_VERSION,
      store,
    });
  },
};
