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
// The throne store is chosen from the environment: the durable Upstash-Redis adapter when
// `UPSTASH_REDIS_REST_URL` / `_TOKEN` are set (production), else the in-memory fake
// (per-instance, non-durable — local/dev/preview). Both sit behind the same `ThroneStore`
// port. Routing: `vercel.json` rewrites the public path -> `/api/fight` with
// `includeFiles: "bots/*.json"` so the gauntlet docs are in the bundle.
import { handleFight } from "../src/http/handle-fight.js";
import { selectThroneStore } from "../src/http/throne-store-select.js";
import { loadGauntlet } from "../src/http/gauntlet.js";
import { buildSeedArena } from "../src/http/seed-arena.js";
import { CANONICAL_RULES } from "../src/engine/rules.js";
import {
  BENCHMARK_VERSION,
  MATCH,
  MAX_TICKS,
  SEEDS,
} from "../src/engine/benchmark-config.js";

const gauntlet = loadGauntlet();
const store = selectThroneStore(process.env);

// The House seed (D5/D15): the three strongest gauntlet bots, contested when the version's store is
// physically empty (a fresh season). Built once per cold start from the same frozen docs the gauntlet
// gate uses — a pure pick-and-order, no runtime fights (determinism invariant).
const seed = buildSeedArena(gauntlet);

// The frozen top-N arena cap (D4): the ladder keeps the top 3 champions; #1 is King. Frozen per
// version — changing it requires a version bump (which starts a fresh empty ladder), so it never
// mutates a live competition. The arena round-robin reuses the frozen gauntlet `SEEDS` (D-A: a
// deterministic tournament graph, no fresh entropy), so a resubmission is idempotent.
const ARENA_N = 3;

export default {
  fetch(req: Request): Promise<Response> {
    return handleFight(req, {
      seeds: SEEDS,
      maxTicks: MAX_TICKS,
      rules: CANONICAL_RULES,
      match: MATCH,
      version: BENCHMARK_VERSION,
      store,
      n: ARENA_N,
      seed,
    });
  },
};
