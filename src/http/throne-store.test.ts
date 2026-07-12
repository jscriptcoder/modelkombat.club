import { describe } from "vitest";

import { runThroneStoreContract } from "./throne-store.contract.js";
import { inMemoryThroneStore } from "./throne-store.js";

// The in-memory fake must satisfy the shared throne-store contract. (The production Upstash
// adapter satisfies the SAME contract via the env-gated live smoke test.)
describe("inMemoryThroneStore — the version-scoped arena contract", () => {
  // A small archive limit (3) so the eviction spec proves the bound with a handful of commits.
  runThroneStoreContract(() => ({
    store: inMemoryThroneStore(3),
    versionA: "v19",
    versionB: "v20",
    archiveLimit: 3,
  }));
});
