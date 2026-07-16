// The `GET /replay` endpoint — a Vercel serverless function (Web-standard `fetch` handler). A
// THIN wrapper: it selects the throne store from the environment (the durable Upstash adapter in
// prod, else the per-instance in-memory fake) and delegates the archive read + on-demand fight
// reconstruction to `handleReplay` in `src/http/` — the injectable seam the tests drive with a
// fresh in-memory store + a test version.
//
// It wires the SAME frozen run params the arena fights on — `CANONICAL_RULES` / `MAX_TICKS` /
// `MATCH`, scoped to `BENCHMARK_VERSION` (the current season) — so a reconstructed title fight is
// byte-faithful to the bout that actually happened (reconstruction fidelity: no re-derivation, no
// drift). Pure transport over the platform-layer throne store (invariant #2 — no DSL op): it reads
// the store only — champion docs come from the archive, never `bots/*.json`, so no
// `functions.includeFiles`. Routing: `vercel.json` rewrites public `/replay` -> `/api/replay`
// (list) and `/replay/{id}` -> `/api/replay?id=$1` (item), kept ahead of the SPA fallback.
import { handleReplay } from "../src/http/handle-replay.js";
import { selectThroneStore } from "../src/http/throne-store-select.js";
import { CANONICAL_RULES } from "../src/engine/rules.js";
import {
  BENCHMARK_VERSION,
  MATCH,
  MAX_TICKS,
} from "../src/engine/benchmark-config.js";

const store = selectThroneStore(process.env);

export default {
  fetch(req: Request): Promise<Response> {
    return handleReplay(req, {
      store,
      version: BENCHMARK_VERSION,
      rules: CANONICAL_RULES,
      maxTicks: MAX_TICKS,
      match: MATCH,
    });
  },
};
