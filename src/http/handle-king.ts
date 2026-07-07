// The `GET /king` orchestration seam — the version-scoped reigning-King read, extracted
// from `api/king.ts` so the throne store + version key are INJECTABLE (the S4 seam
// pattern). `api/king.ts` becomes a thin wrapper supplying production deps. Pure
// transport over the platform-layer throne store: an identity-only projection, no DSL
// op, TCB untouched (invariant #2). A stateless READ — it never touches the throne write
// path, so no CAS / lineage concern here.
import { championIdentity } from "./champion-identity.js";
import { problem } from "./envelope.js";
import type { ThroneStore } from "./throne-store.js";

// Injected: the throne store + the version the read is scoped to. `api/king.ts` supplies
// the production store (`selectThroneStore`) + `BENCHMARK_VERSION`; tests inject a fresh
// in-memory fake + a test version.
export type KingDeps = {
  store: ThroneStore;
  version: string;
};

// The King changes rarely — only a title-fight dethrone moves it — so a brief public
// cache spares the store on repeat views without meaningful staleness. Applied to the
// 200 reads only; failure/method responses are never cached.
const CACHE_CONTROL = "public, max-age=30";

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": CACHE_CONTROL,
    },
  });

export const handleKing = async (
  req: Request,
  deps: KingDeps,
): Promise<Response> => {
  if (req.method !== "GET") {
    return problem(
      405,
      "/problems/method-not-allowed",
      "Only GET is supported on /king.",
      undefined,
      { allow: "GET" },
    );
  }

  try {
    const record = await deps.store.read(deps.version);

    // Empty throne is a first-class SUCCESS (`current: null`), distinct from the 503
    // below — the caller renders "the throne awaits", not an error.
    return json({
      current: record === undefined ? null : championIdentity(record),
    });
  } catch {
    // The store threw (Upstash unreachable / error reply) — surface a 503, never a
    // silent empty throne (which would misreport an outage as "no King yet").
    return problem(
      503,
      "/problems/throne-unavailable",
      "The throne store is currently unreachable; try again shortly.",
    );
  }
};
