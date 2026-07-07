// The `GET /king` endpoint — a Vercel serverless function (Web-standard `fetch`
// handler). A THIN wrapper: it selects the throne store from the environment (the durable
// Upstash adapter in prod, else the per-instance in-memory fake) and delegates the
// version-scoped reigning-King read to `handleKing` in `src/http/` — the injectable seam
// the tests drive with a fresh in-memory store + a test version.
//
// Pure transport over the platform-layer throne store (invariant #2 — no DSL op): an
// identity-only projection of the reigning `ThroneRecord`, scoped to `BENCHMARK_VERSION`
// (a version bump is a throne reset / "season"). It reads the store only — no
// `bots/*.json`, so no `functions.includeFiles`. Routing: `vercel.json` rewrites public
// `/king` -> `/api/king`, kept ahead of the SPA fallback.
import { handleKing } from "../src/http/handle-king.js";
import { selectThroneStore } from "../src/http/throne-store-select.js";
import { BENCHMARK_VERSION } from "../src/engine/benchmark-config.js";

const store = selectThroneStore(process.env);

export default {
  fetch(req: Request): Promise<Response> {
    return handleKing(req, { store, version: BENCHMARK_VERSION });
  },
};
