import { describe } from "vitest";

import { runThroneStoreContract } from "./throne-store.contract.js";
import { inMemoryThroneStore } from "./throne-store.js";

// The in-memory fake must satisfy the shared throne-store contract. (The production Upstash
// adapter satisfies the SAME contract via the env-gated live smoke test.) The fake exposes its
// full lineage directly, so `readLineage` just wraps `lineage()`.
describe("inMemoryThroneStore — the version-scoped throne contract", () => {
  runThroneStoreContract(() => {
    const store = inMemoryThroneStore();

    return {
      store,
      readLineage: (version) => Promise.resolve(store.lineage(version)),
      versionA: "v19",
      versionB: "v20",
    };
  });
});
