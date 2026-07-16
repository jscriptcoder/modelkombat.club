// The `GET /replay` orchestration seam — the version-scoped read that turns the King's
// title-fight archive into WATCHABLE replays, extracted from `api/replay.ts` so the throne
// store + reconstruction params are INJECTABLE (the S4 seam pattern). `api/replay.ts` becomes
// a thin wrapper supplying production deps.
//
// Pure transport over the platform-layer throne store + the deterministic engine: it reads the
// reproduction archive (`readArchive`) and RECONSTRUCTS each requested fight's render tape on
// demand via `renderTape` (invariant #1 — a fight is never a stored tape; it is regenerated from
// the challenger doc + the exact defenders it fought + the frozen seed). No DSL op, TCB untouched
// (invariant #2). Doc-privacy (decision 1): every response carries motion + `name`/`model`
// identities ONLY — a champion's bot document (its `rules` DSL) never crosses the wire, so the
// King's competitive edge is preserved.
import { createHash } from "node:crypto";

import { sanitize } from "./champion-identity.js";
import { problem } from "./envelope.js";
import type { ReproRecord, ThroneStore } from "./throne-store.js";
import { renderTape, type FightConfig } from "../engine/sim.js";
import type { BotDoc } from "../engine/dsl.js";
import type { Rules } from "../engine/types.js";

// Injected: the throne store + the version the read is scoped to (current season only — decision 4)
// + the arena's FROZEN run params (`rules` / `maxTicks` / `match`), the exact inputs the title fight
// was decided under. A record supplies its own `seeds`; everything else must match the arena, so the
// reconstructed motion is byte-faithful to the fight that actually happened (reconstruction fidelity).
export type ReplayDeps = {
  store: ThroneStore;
  version: string;
  rules: Rules;
  maxTicks: number;
  match?: FightConfig["match"];
};

// The public identity of one fighter in a replay: name + model, NEVER the document. Reuses the
// shared `sanitize` (the control-strip every identity gets before the wire). Distinct from
// `memberIdentity` — that shapes a ranked ARENA MEMBER (adds the author handle); a replay archives
// raw `BotDoc`s with no handle, so this is its own shape over a bare doc.
type FighterIdentity = { name: string; model: string };

const fighterIdentity = (doc: BotDoc): FighterIdentity => ({
  name: sanitize(doc.name),
  model: sanitize(doc.model),
});

// A replay's two fighters, always in the same order: the challenger, then the King it fought
// (`defenders[0]` — the arena is rank-ordered, so slot 0 is the reigning champion). The headline
// bout (decision 2) is exactly this pairing.
const fightersOf = (
  record: ReproRecord,
): [FighterIdentity, FighterIdentity] => [
  fighterIdentity(record.challenger),
  fighterIdentity(record.defenders[0]),
];

// Recursively sort object keys so a record serializes identically regardless of the key ORDER it
// was built or deserialized with (the in-proc fake vs an Upstash JSON round-trip can differ) — the
// canonical form the content hash is taken over. Arrays keep their order (it is meaningful: defender
// rank, seed sequence); only object keys are normalized. The actual byte serialization is left to
// `JSON.stringify` (a well-tested built-in), so this owns only the key-sorting knowledge.
const canonicalize = (value: unknown): unknown => {
  if (value === null || typeof value !== "object") return value;

  if (Array.isArray(value)) return value.map(canonicalize);

  const obj = value as Record<string, unknown>;

  return Object.fromEntries(
    Object.keys(obj)
      .sort()
      .map((key) => [key, canonicalize(obj[key])]),
  );
};

// The content-addressed replay id: sha256 of the record's canonical JSON over the fight IDENTITY
// (`challenger + defenders + seeds + version`) — NOT `memberSeniority`, which is a mutable archive
// pin key, not part of what the fight IS. Eviction-proof + permalinkable: the same fight always
// hashes to the same id, so a link survives the record aging in/out of the bounded archive.
export const replayId = (record: ReproRecord): string =>
  createHash("sha256")
    .update(
      JSON.stringify(
        canonicalize({
          challenger: record.challenger,
          defenders: record.defenders,
          seeds: record.seeds,
          version: record.version,
        }),
      ),
    )
    .digest("hex");

// A watchable replay has at least one defender. A BOOTSTRAP crown (the version's first champion,
// which fought nobody) has `defenders: []` — there is no bout to watch, so it is filtered out of
// the list AND cannot resolve as an item (its id 404s).
const isWatchable = (record: ReproRecord): boolean =>
  record.defenders.length > 0;

// The list moves only when a fight is archived, so a brief public cache spares the store on repeat
// views (mirrors `/king`). A reconstructed replay is content-addressed, so it is immutable — safe to
// cache forever under its hash.
const LIST_CACHE = "public, max-age=30";
const REPLAY_CACHE = "public, max-age=31536000, immutable";

const json = (body: unknown, cache: string): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cache,
    },
  });

export const handleReplay = async (
  req: Request,
  deps: ReplayDeps,
): Promise<Response> => {
  if (req.method !== "GET") {
    return problem(
      405,
      "/problems/method-not-allowed",
      "Only GET is supported on /replay.",
      undefined,
      { allow: "GET" },
    );
  }

  // Post-rewrite, an item request arrives as `/api/replay?id=<hash>`; a bare list request has no
  // `id`. `get` returns null when the param is absent (list) and "" for a blank id (an item miss).
  const id = new URL(req.url).searchParams.get("id");

  let archive: ReproRecord[];

  try {
    archive = await deps.store.readArchive(deps.version);
  } catch {
    // The store threw (Upstash unreachable) — surface a 503, never a silent empty list (which would
    // misreport an outage as "no fights yet"). Same posture as `/king`.
    return problem(
      503,
      "/problems/throne-unavailable",
      "The throne store is currently unreachable; try again shortly.",
    );
  }

  const watchable = archive.filter(isWatchable);

  // List: the current version's watchable fights, NEWEST-FIRST (the archive is append-ordered, so
  // reverse it), identities only. An empty or bootstrap-only archive is a first-class `200 []`.
  if (id === null) {
    const list = [...watchable].reverse().map((record) => ({
      id: replayId(record),
      fighters: fightersOf(record),
    }));

    return json(list, LIST_CACHE);
  }

  // Item: resolve the content-hash id against the watchable archive. A miss — unknown, evicted,
  // malformed, or a bootstrap id — 404s BEFORE any fight is reconstructed (the lookup short-circuits).
  const record = watchable.find((candidate) => replayId(candidate) === id);

  if (record === undefined) {
    return problem(
      404,
      "/problems/replay-not-found",
      "No replay matches that id — it may have aged out of the archive, or never existed.",
    );
  }

  // Reconstruct the headline bout on demand: the challenger vs the King it fought, on the arena's
  // frozen rules/maxTicks/match and this record's frozen seed — byte-faithful to the title fight.
  const tape = renderTape({
    rules: deps.rules,
    botA: record.challenger,
    botB: record.defenders[0],
    maxTicks: deps.maxTicks,
    seed: record.seeds[0],
    match: deps.match,
  });

  return json({ tape, fighters: fightersOf(record) }, REPLAY_CACHE);
};
