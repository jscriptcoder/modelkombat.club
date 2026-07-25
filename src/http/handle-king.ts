// The `GET /king` orchestration seam — the version-scoped ranked-arena read, extracted
// from `api/king.ts` so the throne store + version key are INJECTABLE (the S4 seam
// pattern). `api/king.ts` becomes a thin wrapper supplying production deps. Pure
// transport over the platform-layer throne store: an identity-only projection of the
// ranked arena, no DSL op, TCB untouched (invariant #2). A stateless READ — it never
// touches the arena write path, so no CAS concern here.
//
// It reads TWO things: the arena (its subject — an unreachable one is a 503) and, best-effort, the
// reproduction archive, joined onto the arena by seniority so each champion carries the id of the
// fight that seated them (`replayId`). The archive is a nice-to-have here: losing it costs the
// road-to-the-throne links, never the champions.
import { memberIdentity } from "./champion-identity.js";
import { problem } from "./envelope.js";
import { boutReplayIds } from "./handle-replay.js";
import { readArenaOrSeed } from "./seed-arena.js";
import type {
  ArenaMember,
  ArenaRecord,
  ReproRecord,
  ThroneStore,
} from "./throne-store.js";

// Injected: the throne store + the version the read is scoped to + the House seed. `api/king.ts`
// supplies the production store (`selectThroneStore`) + `BENCHMARK_VERSION` + `buildSeedArena`;
// tests inject a fresh in-memory fake + a test version.
export type KingDeps = {
  store: ThroneStore;
  version: string;
  // The House seed surfaced when the store is empty (D5/D15). Optional: a caller that supplies none
  // keeps the pre-seed "empty → no King" behaviour; `api/king.ts` always injects `buildSeedArena`.
  seed?: ArenaRecord;
};

// The arena changes rarely — only a placing submission moves it — so a brief public cache
// spares the store on repeat views without meaningful staleness. Applied to the 200 reads
// only; failure/method responses are never cached.
const CACHE_CONTROL = "public, max-age=30";

// The road-to-the-throne index: every archived record's ENTRY bout id — the bout against the
// then-King, `boutReplayIds(record)[0]` — keyed by the seniority of the member that record seated.
//
// Seniority is the pin key: a strictly-increasing per-version counter, so at most one record can
// carry a given value and it does not matter which wins a (impossible) tie. Names are NOT unique
// and must never be joined on — a name-based join would silently resolve to the wrong fight with
// no way to detect it.
//
// Two record shapes resolve to nothing, and NEITHER needs a guard — the map is typed to absorb
// both, the same trick `retainArchive` uses on its pin set. A record that seated nobody
// (`memberSeniority: null`, a non-placer) lands under a null key, which is unhittable because a
// member's seniority is always a number; a bootstrap crown (`defenders: []`) captured no bouts, so
// its value is undefined, which the lookup coalesces to null exactly like an absent key.
type EntryBouts = Map<number | null, string | undefined>;

const entryBouts = (archive: readonly ReproRecord[]): EntryBouts =>
  new Map(
    archive.map((record) => [record.memberSeniority, boutReplayIds(record)[0]]),
  );

// Read the archive BEST-EFFORT. `/king` feeds the home page's King and Arena sections, so an
// archive outage must cost the road-to-the-throne links only — never the champions themselves,
// which a 503 would blank. An unreadable ARENA is a different matter (see the 503 below): that is
// the endpoint's actual subject.
const readEntryBouts = async (
  store: ThroneStore,
  version: string,
): Promise<EntryBouts> => {
  try {
    return entryBouts(await store.readArchive(version));
  } catch {
    return new Map();
  }
};

// A member's public projection: the shared identity shaper plus the id of the fight that seated
// them. Composed HERE rather than inside `memberIdentity`, which `/fight` also uses for its board
// rows — those carry their own `replayId` from the fight just fought, so widening the shared
// shaper would put an unresolvable field on `/fight`'s title block.
const memberProjection = (
  member: ArenaMember,
  entries: EntryBouts,
): ReturnType<typeof memberIdentity> & { replayId: string | null } => ({
  ...memberIdentity(member),
  replayId: entries.get(member.seniority) ?? null,
});

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
    // The ranked arena is the single source of truth: `members[0]` is the King, `members[1..]`
    // are the defenders-in-waiting in rank order (already capped at N by the store). Project
    // each identity-only — the champion's document (its `rules` DSL) is never surfaced.
    // Both reads in flight together — the archive join needs no arena data, so serializing them
    // would only add a round trip. `readEntryBouts` handles its own failure, so an arena rejection
    // here settles the pair without leaving an unhandled one behind.
    const [{ arena }, entries] = await Promise.all([
      readArenaOrSeed(deps.store, deps.version, deps.seed),
      readEntryBouts(deps.store, deps.version),
    ]);

    const [king, ...defenders] = arena?.members ?? [];

    // Empty arena is a first-class SUCCESS (`current: null`, `recent: []`), distinct from the
    // 503 below — the caller renders "the throne awaits", not an error.
    return json({
      current: king === undefined ? null : memberProjection(king, entries),
      recent: defenders.map((member) => memberProjection(member, entries)),
    });
  } catch {
    // The store threw (Upstash unreachable / error reply) — surface a 503, never a silent
    // empty throne (which would misreport an outage as "no King yet").
    return problem(
      503,
      "/problems/throne-unavailable",
      "The throne store is currently unreachable; try again shortly.",
    );
  }
};
