// The production `ThroneStore` adapter (S4 slice 5): Upstash Redis over the REST API,
// via raw `fetch` (no SDK — keeps `dependencies` empty). One atomic Lua `EVAL` performs
// compare-generation + set-pointer + append-lineage together, so a crown can never tear.
// Platform layer (transport + storage) — the engine and its TCB stay untouched.
import type { CasResult, ThroneRecord, ThroneStore } from "./throne-store.js";

// The `fetch` seam: injected so the adapter is unit-testable with a double. Global
// `fetch` (Node 24 default) satisfies it; production passes it implicitly.
export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

// Connection config, injected — this adapter never reads `process.env`. The composition
// root (`api/fight.ts`) reads the env and constructs the store, keeping this unit-testable.
export type UpstashConfig = { url: string; token: string };

const throneKey = (version: string): string => `throne:${version}`;
const lineageKey = (version: string): string => `champions:${version}`;

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

// The atomic crown. KEYS = [pointer, lineage]; ARGV = [expectedGeneration, nextRecordJson].
// The reigning generation is read out of the pointer record; ARGV[1] is the empty-string
// sentinel to mean "expect the throne empty". On a match: set the pointer to the new record
// AND RPUSH it onto the append-only lineage; otherwise report "moved" (a lost CAS race → 409).
export const CROWN_SCRIPT = [
  "local ptr = redis.call('GET', KEYS[1])",
  "local current = ''",
  "if ptr then current = tostring(cjson.decode(ptr)['generation']) end",
  "if current ~= ARGV[1] then return 'moved' end",
  "redis.call('SET', KEYS[1], ARGV[2])",
  "redis.call('RPUSH', KEYS[2], ARGV[2])",
  "return 'ok'",
].join("\n");

// Pure: build the Upstash REST request for an atomic compareAndSwap EVAL. `expected` is
// stringified (null ⇒ "" = "expect empty"); the next record is JSON for both the pointer
// and its lineage entry.
export const buildCrownRequest = (
  config: UpstashConfig,
  version: string,
  expected: number | null,
  next: ThroneRecord,
): { url: string; init: RequestInit } => {
  const expectedArg = expected === null ? "" : String(expected);

  return restRequest(config, [
    "EVAL",
    CROWN_SCRIPT,
    "2",
    throneKey(version),
    lineageKey(version),
    expectedArg,
    JSON.stringify(next),
  ]);
};

// Pure: build the Upstash REST request to read the reigning record (a `GET` of the pointer).
export const buildReadRequest = (
  config: UpstashConfig,
  version: string,
): { url: string; init: RequestInit } =>
  restRequest(config, ["GET", throneKey(version)]);

// Pure: build the Upstash REST request for the recent lineage tail. `LRANGE key -limit -1`
// returns the last `limit` entries of the append-only list, oldest-first within the tail
// (Redis clamps when fewer exist), so the read is always bounded by `limit`.
export const buildRecentRequest = (
  config: UpstashConfig,
  version: string,
  limit: number,
): { url: string; init: RequestInit } =>
  restRequest(config, ["LRANGE", lineageKey(version), String(-limit), "-1"]);

// The Upstash REST reply: exactly one of `result` (success) or `error` (failure).
export type UpstashReply = { result: unknown } | { error: unknown };

// Interpret a pointer `GET` reply: `null` ⇒ empty throne (undefined); a JSON string ⇒ the
// stored record. An error is thrown, NEVER read as empty — a transient failure must not let
// a challenger bootstrap-crown over a live king.
export const interpretReadReply = (
  reply: UpstashReply,
): ThroneRecord | undefined => {
  if ("error" in reply) {
    throw new Error(`Upstash read failed: ${String(reply.error)}`);
  }

  if (reply.result === null) return undefined;

  // Trust-boundary parse of a record this adapter itself wrote (round-trip of our own JSON).
  const parsed: unknown = JSON.parse(String(reply.result));

  return parsed as ThroneRecord;
};

// Interpret an `LRANGE` reply: a list of JSON record strings ⇒ the lineage tail, oldest-first
// (each parsed back into a `ThroneRecord`); an empty list ⇒ `[]`. An error is thrown, NEVER
// read as an empty lineage — a transient failure must not misreport an outage as "no champions".
export const interpretRecentReply = (reply: UpstashReply): ThroneRecord[] => {
  if ("error" in reply) {
    throw new Error(`Upstash recent read failed: ${String(reply.error)}`);
  }

  // Trust-boundary parse of records this adapter itself wrote (round-trip of our own JSON).
  const entries = reply.result as unknown[];

  return entries.map((entry) => JSON.parse(String(entry)) as ThroneRecord);
};

// Interpret a crown `EVAL` reply: 'ok' ⇒ the crown landed (carrying the crowned record),
// 'moved' ⇒ a lost CAS race. An error, or any other result, throws (a contract violation is
// never silently treated as a successful crown).
export const interpretCrownReply = (
  reply: UpstashReply,
  next: ThroneRecord,
): CasResult => {
  if ("error" in reply) {
    throw new Error(`Upstash crown failed: ${String(reply.error)}`);
  }

  if (reply.result === "ok") return { ok: true, record: next };

  if (reply.result === "moved") return { ok: false, reason: "moved" };

  throw new Error(`Unexpected Upstash crown reply: ${String(reply.result)}`);
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

// The durable `ThroneStore`: the same port the in-memory fake implements, backed by
// Upstash Redis. `read` GETs the pointer; `compareAndSwap` runs the atomic crown EVAL.
export const upstashThroneStore = (
  config: UpstashConfig,
  fetchImpl: FetchLike = fetch,
): ThroneStore => ({
  read: async (version) => {
    const { url, init } = buildReadRequest(config, version);

    return interpretReadReply(await post(fetchImpl, url, init));
  },

  recent: async (version, limit) => {
    const { url, init } = buildRecentRequest(config, version, limit);

    return interpretRecentReply(await post(fetchImpl, url, init));
  },

  compareAndSwap: async (version, expected, next) => {
    const { url, init } = buildCrownRequest(config, version, expected, next);

    return interpretCrownReply(await post(fetchImpl, url, init), next);
  },
});
