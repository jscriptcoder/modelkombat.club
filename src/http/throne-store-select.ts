// Composition-root wiring: choose the throne store from the environment. This is the ONE
// place that knows both concrete stores; the adapter and the fake stay unaware of each other.
import { upstashThroneStore } from "./throne-store-upstash.js";
import { inMemoryThroneStore, type ThroneStore } from "./throne-store.js";

// The environment map the pick reads (a subset of `process.env`), passed in by the API entry
// point (`api/fight.ts`) so this stays a pure, unit-testable function.
export type ThroneStoreEnv = Record<string, string | undefined>;

// The durable store needs a REST URL + full-access token. Vercel's Upstash Marketplace
// integration injects these under one of several naming schemes depending on the chosen
// env-var prefix, so we accept each — in precedence order, most explicit first:
//   1. the canonical names (an explicit / local override),
//   2. the prefixed names our Marketplace database actually emits, and
//   3. the default Vercel-KV names (a default-prefix re-provision).
const URL_KEYS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_KV_REST_API_URL",
  "KV_REST_API_URL",
];

const TOKEN_KEYS = [
  "UPSTASH_REDIS_REST_TOKEN",
  "UPSTASH_REDIS_REST_KV_REST_API_TOKEN",
  "KV_REST_API_TOKEN",
];

// First non-empty value among the candidate names (empty string counts as absent).
const resolve = (
  env: ThroneStoreEnv,
  keys: readonly string[],
): string | undefined =>
  keys.map((key) => env[key]).find((value): value is string => Boolean(value));

// Durable Upstash store when BOTH a URL and a token resolve (under any accepted scheme),
// otherwise the in-memory fake (the local / dev / test default). Partial or empty config falls
// back to the fake — never a half-configured adapter.
export const selectThroneStore = (env: ThroneStoreEnv): ThroneStore => {
  const url = resolve(env, URL_KEYS);
  const token = resolve(env, TOKEN_KEYS);

  if (url && token) return upstashThroneStore({ url, token });

  return inMemoryThroneStore();
};
