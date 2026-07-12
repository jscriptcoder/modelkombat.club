// The production `ThroneStore` adapter: Upstash Redis over the REST API, via raw `fetch` (no SDK —
// keeps `dependencies` empty). One atomic Lua `EVAL` performs compare-generation + set-arena
// together, so an arena commit can never tear. Platform layer (transport + storage) — the engine
// and its TCB stay untouched.
import { DEFAULT_ARCHIVE_LIMIT } from "./throne-store.js";
import type {
  ArenaCasResult,
  ArenaRecord,
  ReproRecord,
  ThroneStore,
} from "./throne-store.js";

// The `fetch` seam: injected so the adapter is unit-testable with a double. Global
// `fetch` (Node 24 default) satisfies it; production passes it implicitly.
export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

// Connection config, injected — this adapter never reads `process.env`. The composition
// root (`api/fight.ts`) reads the env and constructs the store, keeping this unit-testable.
export type UpstashConfig = { url: string; token: string };

const arenaKey = (version: string): string => `arena:${version}`;
const archiveKey = (version: string): string => `archive:${version}`;

// The shape of every Upstash REST call: POST the command array as JSON with bearer auth.
const restRequest = (
  config: UpstashConfig,
  command: unknown[],
): { url: string; init: RequestInit } => ({
  url: config.url,
  init: {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  },
});

// The atomic arena commit + archive append + K-bounded eviction. KEYS = [arena pointer, archive
// list]; ARGV = [expectedGeneration, nextArenaJson, reproRecordJson, archiveLimitK]. The stored
// generation is read out of the pointer record; ARGV[1] is the empty-string sentinel to mean "expect
// the arena empty". On a generation match: set the pointer to the new arena, and — when a record is
// supplied (ARGV[3] non-empty) — append it and re-bound the archive, all one indivisible step. On a
// mismatch, report "moved" (a lost CAS race → 409) BEFORE any write, so nothing tears.
//
// Eviction keeps the newest K (ARGV[4]) records PLUS any record still PINNED to a member of the just
// committed arena (its `memberSeniority` is among `next.members[].seniority`). Pinned records survive
// however old; a member's record un-pins the instant it relegates. Implemented by rewriting the list
// (LRANGE → filter in Lua → DEL → RPUSH the survivors) — cheap at K + N.
export const COMMIT_ARENA_SCRIPT = [
  "local ptr = redis.call('GET', KEYS[1])",
  "local current = ''",
  "if ptr then current = tostring(cjson.decode(ptr)['generation']) end",
  "if current ~= ARGV[1] then return 'moved' end",
  "redis.call('SET', KEYS[1], ARGV[2])",
  "if ARGV[3] ~= '' then",
  "  redis.call('RPUSH', KEYS[2], ARGV[3])",
  "  local limit = tonumber(ARGV[4])",
  "  local pinned = {}",
  "  local nextArena = cjson.decode(ARGV[2])",
  "  if nextArena['members'] then",
  "    for _, m in ipairs(nextArena['members']) do pinned[m['seniority']] = true end",
  "  end",
  "  local all = redis.call('LRANGE', KEYS[2], 0, -1)",
  "  local total = #all",
  "  local keep = {}",
  "  for i, rec in ipairs(all) do",
  "    local sen = cjson.decode(rec)['memberSeniority']",
  "    if i > total - limit or pinned[sen] then keep[#keep + 1] = rec end",
  "  end",
  "  redis.call('DEL', KEYS[2])",
  "  if #keep > 0 then redis.call('RPUSH', KEYS[2], unpack(keep)) end",
  "end",
  "return 'ok'",
].join("\n");

// Pure: build the Upstash REST request to read the current arena record (a `GET` of the pointer).
export const buildReadArenaRequest = (
  config: UpstashConfig,
  version: string,
): { url: string; init: RequestInit } =>
  restRequest(config, ["GET", arenaKey(version)]);

// Pure: build the Upstash REST request to read the whole reproduction archive (an `LRANGE 0 -1` of
// the version's archive list, oldest first). A missing list LRANGEs to an empty array.
export const buildReadArchiveRequest = (
  config: UpstashConfig,
  version: string,
): { url: string; init: RequestInit } =>
  restRequest(config, ["LRANGE", archiveKey(version), "0", "-1"]);

// Pure: build the Upstash REST request for an atomic arena-swap + archive-append + evict EVAL.
// `expected` is stringified (null ⇒ "" = "expect empty arena"); ARGV[2] is the next arena JSON;
// ARGV[3] is the reproduction record JSON, or "" (the sentinel that skips the append/evict) when no
// record is supplied; ARGV[4] is the archive bound K.
export const buildCommitArenaRequest = (
  config: UpstashConfig,
  version: string,
  expected: number | null,
  next: ArenaRecord,
  record?: ReproRecord,
  archiveLimit: number = DEFAULT_ARCHIVE_LIMIT,
): { url: string; init: RequestInit } => {
  const expectedArg = expected === null ? "" : String(expected);
  const recordArg = record === undefined ? "" : JSON.stringify(record);

  return restRequest(config, [
    "EVAL",
    COMMIT_ARENA_SCRIPT,
    "2",
    arenaKey(version),
    archiveKey(version),
    expectedArg,
    JSON.stringify(next),
    recordArg,
    String(archiveLimit),
  ]);
};

// The Upstash REST reply: exactly one of `result` (success) or `error` (failure).
export type UpstashReply = { result: unknown } | { error: unknown };

// Interpret an arena pointer `GET` reply: `null` ⇒ empty arena (undefined); a JSON string ⇒ the
// stored arena. An error is thrown, NEVER read as empty — a transient failure must not let a
// challenger bootstrap-crown over a live arena.
export const interpretReadArenaReply = (
  reply: UpstashReply,
): ArenaRecord | undefined => {
  if ("error" in reply) {
    throw new Error(`Upstash arena read failed: ${String(reply.error)}`);
  }

  if (reply.result === null) return undefined;

  // Trust-boundary parse of a record this adapter itself wrote (round-trip of our own JSON).
  const parsed: unknown = JSON.parse(String(reply.result));

  return parsed as ArenaRecord;
};

// Interpret an archive `LRANGE` reply: each element is a stored record JSON string, parsed back into
// a `ReproRecord`, oldest first. A missing list LRANGEs to `[]`. An error is thrown, NEVER read as an
// empty archive — a transient failure must not masquerade as "no history."
export const interpretReadArchiveReply = (
  reply: UpstashReply,
): ReproRecord[] => {
  if ("error" in reply) {
    throw new Error(`Upstash archive read failed: ${String(reply.error)}`);
  }

  // Trust-boundary parse of records this adapter itself wrote (round-trip of our own JSON).
  const rows = reply.result as unknown[];

  return rows.map((row) => JSON.parse(String(row)) as ReproRecord);
};

// Interpret an arena commit `EVAL` reply: 'ok' ⇒ the commit landed (carrying the committed arena),
// 'moved' ⇒ a lost CAS race. An error, or any other result, throws (a contract violation is never
// silently treated as a successful commit).
export const interpretCommitArenaReply = (
  reply: UpstashReply,
  next: ArenaRecord,
): ArenaCasResult => {
  if ("error" in reply) {
    throw new Error(`Upstash arena commit failed: ${String(reply.error)}`);
  }

  if (reply.result === "ok") return { ok: true, record: next };

  if (reply.result === "moved") return { ok: false, reason: "moved" };

  throw new Error(
    `Unexpected Upstash arena commit reply: ${String(reply.result)}`,
  );
};

// POST one REST command to Upstash and decode its JSON reply.
const post = async (
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
): Promise<UpstashReply> => {
  const res = await fetchImpl(url, init);
  const body: unknown = await res.json();

  return body as UpstashReply;
};

// The durable `ThroneStore`: the same port the in-memory fake implements, backed by Upstash Redis.
// `readArena` GETs the arena pointer; `readArchive` LRANGEs the archive list; `commitArena` runs the
// atomic swap-arena + append-record EVAL.
export const upstashThroneStore = (
  config: UpstashConfig,
  fetchImpl: FetchLike = fetch,
  archiveLimit: number = DEFAULT_ARCHIVE_LIMIT,
): ThroneStore => ({
  readArena: async (version) => {
    const { url, init } = buildReadArenaRequest(config, version);

    return interpretReadArenaReply(await post(fetchImpl, url, init));
  },

  readArchive: async (version) => {
    const { url, init } = buildReadArchiveRequest(config, version);

    return interpretReadArchiveReply(await post(fetchImpl, url, init));
  },

  commitArena: async (version, expected, next, record) => {
    const { url, init } = buildCommitArenaRequest(
      config,
      version,
      expected,
      next,
      record,
      archiveLimit,
    );

    return interpretCommitArenaReply(await post(fetchImpl, url, init), next);
  },
});
