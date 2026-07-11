// The production `ThroneStore` adapter: Upstash Redis over the REST API, via raw `fetch` (no SDK —
// keeps `dependencies` empty). One atomic Lua `EVAL` performs compare-generation + set-arena
// together, so an arena commit can never tear. Platform layer (transport + storage) — the engine
// and its TCB stay untouched.
import type {
  ArenaCasResult,
  ArenaRecord,
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

// The atomic arena commit. KEYS = [arena pointer]; ARGV = [expectedGeneration, nextArenaJson].
// The stored generation is read out of the pointer record; ARGV[1] is the empty-string sentinel to
// mean "expect the arena empty". On a match: set the pointer to the new arena and succeed;
// otherwise report "moved" (a lost CAS race → 409).
export const COMMIT_ARENA_SCRIPT = [
  "local ptr = redis.call('GET', KEYS[1])",
  "local current = ''",
  "if ptr then current = tostring(cjson.decode(ptr)['generation']) end",
  "if current ~= ARGV[1] then return 'moved' end",
  "redis.call('SET', KEYS[1], ARGV[2])",
  "return 'ok'",
].join("\n");

// Pure: build the Upstash REST request to read the current arena record (a `GET` of the pointer).
export const buildReadArenaRequest = (
  config: UpstashConfig,
  version: string,
): { url: string; init: RequestInit } =>
  restRequest(config, ["GET", arenaKey(version)]);

// Pure: build the Upstash REST request for an atomic arena commit EVAL. `expected` is stringified
// (null ⇒ "" = "expect empty arena"); ARGV[2] is the next arena JSON.
export const buildCommitArenaRequest = (
  config: UpstashConfig,
  version: string,
  expected: number | null,
  next: ArenaRecord,
): { url: string; init: RequestInit } => {
  const expectedArg = expected === null ? "" : String(expected);

  return restRequest(config, [
    "EVAL",
    COMMIT_ARENA_SCRIPT,
    "1",
    arenaKey(version),
    expectedArg,
    JSON.stringify(next),
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
// `readArena` GETs the arena pointer; `commitArena` runs the atomic commit EVAL.
export const upstashThroneStore = (
  config: UpstashConfig,
  fetchImpl: FetchLike = fetch,
): ThroneStore => ({
  readArena: async (version) => {
    const { url, init } = buildReadArenaRequest(config, version);

    return interpretReadArenaReply(await post(fetchImpl, url, init));
  },

  commitArena: async (version, expected, next) => {
    const { url, init } = buildCommitArenaRequest(
      config,
      version,
      expected,
      next,
    );

    return interpretCommitArenaReply(await post(fetchImpl, url, init), next);
  },
});
