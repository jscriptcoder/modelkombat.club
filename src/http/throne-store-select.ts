// Composition-root wiring: choose the throne store from the environment. This is the ONE
// place that knows both concrete stores; the adapter and the fake stay unaware of each other.
import { upstashThroneStore } from "./throne-store-upstash.js";
import { inMemoryThroneStore, type ThroneStore } from "./throne-store.js";

// The env vars the durable Upstash store needs — BOTH required. Read from `process.env` by
// the API entry point (`api/fight.ts`) and passed in, so this stays a pure, unit-testable pick.
export type ThroneStoreEnv = {
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
};

// Durable Upstash store when BOTH connection vars are present (non-empty), otherwise the
// in-memory fake (the local / dev / test default). Partial or empty config falls back to the
// fake — never a half-configured adapter.
export const selectThroneStore = (env: ThroneStoreEnv): ThroneStore => {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) return upstashThroneStore({ url, token });

  return inMemoryThroneStore();
};
