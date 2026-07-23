import { describe, expect, it } from "vitest";

import { runThroneStoreContract } from "./throne-store.contract.js";
import { inMemoryThroneStore, type ReproRecord } from "./throne-store.js";
import type { BotDoc } from "../engine/dsl.js";

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

// A minimal idle champion (the store treats a document as opaque JSON).
const idleChamp = (name: string): BotDoc => ({
  version: 1,
  name,
  model: "test",
  rules: [],
  default: { type: "idle" },
});

// A NON-PLACER reproduction record (memberSeniority null ⇒ never pinned ⇒ always evictable).
const nonPlacer = (name: string): ReproRecord => ({
  challenger: idleChamp(name),
  defenders: [idleChamp("king")],
  seeds: [1, 2, 3, 4, 5],
  version: "v20",
  memberSeniority: null,
});

// The DEFAULT store (no injected K) is what the composition root ships — so its bound is the
// production retention window. The contract proves the bound-and-pin RULE at a small injected K;
// this pins the DEFAULT value the app actually runs with.
describe("inMemoryThroneStore — the shipped default retention window", () => {
  it("retains the newest 100 competes on a default-configured store, evicting older ones", async () => {
    const store = inMemoryThroneStore(); // no arg ⇒ DEFAULT_ARCHIVE_LIMIT
    const version = "v20";

    // A stable, unpinned arena member (seniority 999 ∉ any record's null pin key), so every record
    // is evictable. Commit 101 non-placer records over it — the oldest must age out.
    const king = [
      { champion: idleChamp("king"), handle: null, seniority: 999 },
    ];

    for (let i = 0; i <= 100; i += 1) {
      await store.commitArena(
        version,
        i === 0 ? null : i,
        { members: king, generation: i + 1, nextSeniority: 1000 },
        nonPlacer(`c${i}`),
      );
    }

    const names = (await store.readArchive(version)).map(
      (record) => record.challenger.name,
    );

    // c0 (oldest) aged out; the newest 100 survive, oldest-first — the production default is 100.
    expect(names).toHaveLength(100);
    expect(names).toEqual(Array.from({ length: 100 }, (_, k) => `c${k + 1}`));
  });
});
